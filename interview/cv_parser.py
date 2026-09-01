import os
import re
import uuid
import json
import PyPDF2
import docx

from typing import Dict, List
from dotenv import load_dotenv

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_openai import AzureChatOpenAI,AzureOpenAIEmbeddings

import azure_env

load_dotenv()

# Resolved against this file, not the process CWD, so the index location does
# not move when the app is launched from the repo root or a container.
FAISS_INDEX_PATH = os.path.join(os.path.dirname(__file__), "faiss_index")


class CVParser:

    def __init__(self):
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=50
        )

        self.embeddings = AzureOpenAIEmbeddings(
            azure_deployment=azure_env.embedding_deployment(),
            azure_endpoint=azure_env.embedding_endpoint(),
            api_key=azure_env.embedding_key(),
            api_version=azure_env.embedding_api_version(),
        )

        self.llm = AzureChatOpenAI(
            azure_deployment=azure_env.chat_deployment(),
            api_version=azure_env.api_version(),
            azure_endpoint=azure_env.openai_endpoint(),
            api_key=azure_env.openai_key(),
        )

        if os.path.exists(FAISS_INDEX_PATH):
            print(f"Loading existing FAISS index from '{FAISS_INDEX_PATH}'...")
            self.vector_store = FAISS.load_local(
                FAISS_INDEX_PATH,
                self.embeddings,
                allow_dangerous_deserialization=True
            )
        else:
            print("No existing FAISS index found. Will create on first parse.")
            self.vector_store = None

    def extract_pdf(self, path):
        text = ""
        with open(path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    text += t
        return text

    def extract_docx(self, path):
        doc = docx.Document(path)
        return "\n".join([p.text for p in doc.paragraphs])

    def extract_email(self, text):
        result = re.findall(
            r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]+",
            text
        )
        return result[0] if result else ""

    def extract_phone(self, text):
        result = re.findall(
            r"[\+\(]?[1-9][0-9 .\-\(\)]{8,}[0-9]",
            text
        )
        return result[0] if result else ""

    def extract_skills(self, text):
        skills = [
            "python", "java", "javascript", "typescript",
            "c++", "react", "node", "docker", "kubernetes",
            "azure", "aws", "gcp", "sql", "mongodb",
            "machine learning", "deep learning"
        ]
        t = text.lower()
        return [s for s in skills if s in t]

    def structured_resume(self, text):
        prompt = f"""
        Extract structured information from the following resume.

        You MUST output ONLY valid JSON. Absolutely no other text, no intro, no markdown blocks.
        Use exactly this schema:

        {{
        "name": "",
        "contact": {{
            "email": "",
            "phone": "",
            "github": "",
            "linkedin": ""
        }},
        "education": [],
        "experience": [],
        "projects": [],
        "skills": {{
            "languages": [],
            "tools": [],
            "concepts": []
        }},
        "achievements": [],
        "activities": []
        }}

        Resume:
        {text}
        """
        try:
            llm_with_json = self.llm.bind(response_format={"type": "json_object"})
            response = llm_with_json.invoke(prompt)
        except Exception as e:
            print(f"Failed JSON mode, falling back to standard: {e}")
            response = self.llm.invoke(prompt)

        content = response.content.strip()
        content = content.replace("```json", "").replace("```", "")

        try:
            return json.loads(content)
        except Exception:
            match = re.search(r'\{[\s\S]*\}', content)
            if match:
                try:
                    return json.loads(match.group(0))
                except Exception:
                    pass
            print("LLM returned invalid JSON")
            print(content)
            return {}

    def parse_cv(self, file_path):
        if file_path.endswith(".pdf"):
            text = self.extract_pdf(file_path)
        elif file_path.endswith(".docx"):
            text = self.extract_docx(file_path)
        else:
            with open(file_path) as f:
                text = f.read()

        data = self.structured_resume(text)

        chunks = self.splitter.split_text(text)
        metadatas = [{"source": file_path, "chunk": i} for i in range(len(chunks))]

        if self.vector_store is None:
            self.vector_store = FAISS.from_texts(
                texts=chunks,
                embedding=self.embeddings,
                metadatas=metadatas
            )
        else:
            self.vector_store.add_texts(
                texts=chunks,
                metadatas=metadatas
            )

        self.vector_store.save_local(FAISS_INDEX_PATH)
        print(f"{len(chunks)} chunks stored in FAISS index at '{FAISS_INDEX_PATH}'")

        return data

    def search(self, query):
        if self.vector_store is None:
            print("No FAISS index loaded. Run parse_cv() first.")
            return

        docs = self.vector_store.similarity_search(query, k=3)
        if not docs:
            print("No results found")
            return

        context = "\n\n".join([d.page_content for d in docs])
        prompt = f"""
        Answer the question based on this CV context using minimal tokens.
        Question: {query}
        Context:
        {context}
        """
        response = self.llm.invoke(prompt)
        print("\n--- Retrieved Context ---\n")
        print(context)
        print("\n--- LLM Answer ---\n")
        print(response.content)


if __name__ == "__main__":
    parser = CVParser()

    cv = parser.parse_cv(r"C:\Users\Aditya Pratap Singh\Desktop\check_MS\sde_aditya_pratap_singh.pdf")



    parser.search("How would u rate him on 10 for his skills ?")