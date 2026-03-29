import os
import re
import uuid
import json
import PyPDF2
import docx

from typing import Dict, List
from dotenv import load_dotenv, dotenv_values

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_openai import AzureChatOpenAI,AzureOpenAIEmbeddings

load_dotenv()
env = dotenv_values(".env")

FAISS_INDEX_PATH = "faiss_index"


class CVParser:

    def __init__(self):
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=50
        )

        # Free local embeddings via HuggingFace — no API key needed
        # Replace HuggingFaceEmbeddings with this
        self.embeddings = AzureOpenAIEmbeddings(
            azure_deployment=env.get("AZURE_EMBEDDING_DEPLOYMENT"),   # text-embedding-3-small
            azure_endpoint=env.get("AZURE_EMBEDDING_ENDPOINT"),       # https://aiserives.openai.azure.com/
            api_key=env.get("AZURE_EMBEDDING_API_KEY"),
            api_version=env.get("AZURE_EMBEDDING_API_VERSION"),       # 2024-02-01
        )

        # Azure OpenAI LLM (kept as is)
        self.llm = AzureChatOpenAI(
            azure_deployment=os.getenv("DEPLOYMENT_NAME", "gpt-4o-mini"),
            api_version="2024-02-01",
            azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
        )

        # Load existing FAISS index if it exists, else set to None
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

        # Structured parse via LLM
        data = self.structured_resume(text)

        # Chunk and embed into FAISS
        chunks = self.splitter.split_text(text)
        metadatas = [{"source": file_path, "chunk": i} for i in range(len(chunks))]

        if self.vector_store is None:
            # First time — create the index
            self.vector_store = FAISS.from_texts(
                texts=chunks,
                embedding=self.embeddings,
                metadatas=metadatas
            )
        else:
            # Index exists — add to it
            self.vector_store.add_texts(
                texts=chunks,
                metadatas=metadatas
            )

        # Persist to disk
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

    # with open("parsed_cv.json", "w", encoding="utf-8") as f:
    #     json.dump(cv, f, indent=4)

    # print("Parsed CV saved to parsed_cv.json")

    parser.search("How would u rate him on 10 for his skills ?")