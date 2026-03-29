from dotenv import load_dotenv
import os
from langchain_openai import AzureChatOpenAI

load_dotenv()

llm=None

def get_llm(agent_type: str):
    # Azure OpenAI Configuration
    azure_config = {
        "azure_deployment": os.getenv("DEPLOYMENT_NAME", "gpt-4o-mini"),
        "api_version": "2024-02-01",
        "azure_endpoint": os.getenv("AZURE_OPENAI_ENDPOINT"),
        "api_key": os.getenv("AZURE_OPENAI_API_KEY"),
    }
    llm =AzureChatOpenAI(**azure_config,temperature=0.7)
    return llm
