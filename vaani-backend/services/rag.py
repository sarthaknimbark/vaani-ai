import os
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings

# Initialize embeddings
embedding = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-mpnet-base-v2"
)

# Load or create FAISS index
db = None
try:
    if os.path.exists("faiss_index"):
        db = FAISS.load_local(
            "faiss_index",
            embedding,
            allow_dangerous_deserialization=True
        )
        print("FAISS index loaded successfully")
    else:
        print("Warning: FAISS index not found at 'faiss_index'")
except Exception as e:
    print(f"Error loading FAISS index: {e}")

def get_context(query):
    """Retrieve context from FAISS vector database"""
    try:
        if db is None:
            print("FAISS database not initialized, returning generic context")
            return "Restaurant knowledge base not available. Please try again."
        
        docs = db.similarity_search(query, k=2)
        
        if not docs:
            print("No documents found for query:", query)
            return "No specific information found for your query."
        
        context = " ".join([d.page_content for d in docs])
        print(f"Retrieved context ({len(context)} chars) for query: {query}")
        return context
    except Exception as e:
        print(f"Error retrieving context: {e}")
        import traceback
        traceback.print_exc()
        return f"Error retrieving information: {str(e)}"