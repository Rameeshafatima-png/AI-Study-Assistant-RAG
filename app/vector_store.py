from pathlib import Path
import chromadb
from sentence_transformers import SentenceTransformer

from .config import CHROMA_DIR, COLLECTION_NAME, EMBEDDING_MODEL

class VectorStore:
    def __init__(self):
        self.client = chromadb.PersistentClient(path=str(CHROMA_DIR))
        self.collection = self.client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
        self.embedding_model = SentenceTransformer(EMBEDDING_MODEL)

    def embed(self, texts):
        vectors = self.embedding_model.encode(
            texts,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return vectors.tolist()

    def reset(self):
        try:
            self.client.delete_collection(COLLECTION_NAME)
        except Exception:
            pass

        self.collection = self.client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )

    def add_documents(self, documents):
        if not documents:
            return 0

        texts = [item["text"] for item in documents]
        ids = [item["id"] for item in documents]
        metadatas = [item["metadata"] for item in documents]

        embeddings = self.embed(texts)

        self.collection.add(
            ids=ids,
            documents=texts,
            metadatas=metadatas,
            embeddings=embeddings,
        )
        return len(documents)

    def search(self, query, top_k=5):
        if self.collection.count() == 0:
            return []

        query_embedding = self.embed([query])[0]
        result = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            include=["documents", "metadatas", "distances"],
        )

        documents = result.get("documents", [[]])[0]
        metadatas = result.get("metadatas", [[]])[0]
        distances = result.get("distances", [[]])[0]

        output = []
        for doc, metadata, distance in zip(documents, metadatas, distances):
            output.append({
                "text": doc,
                "source": metadata.get("source", "Unknown"),
                "page": metadata.get("page", 0),
                "distance": round(float(distance), 4),
            })
        return output

    def stats(self):
        return {
            "chunks": self.collection.count(),
            "collection": COLLECTION_NAME,
            "embedding_model": EMBEDDING_MODEL,
            "database_path": str(CHROMA_DIR),
        }
