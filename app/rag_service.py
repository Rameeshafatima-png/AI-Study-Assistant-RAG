from pathlib import Path
from uuid import uuid4

from .config import CHUNK_SIZE, CHUNK_OVERLAP, PDF_DIR, TOP_K
from .pdf_processor import extract_pdf_pages, chunk_text
from .vector_store import VectorStore
from .groq_service import GroqService

class RAGService:
    def __init__(self):
        self.store = VectorStore()
        self.groq = GroqService()

    def build_index(self, pdf_paths):
        self.store.reset()

        all_documents = []
        pdf_count = 0
        page_count = 0

        for pdf_path in pdf_paths:
            pdf_path = Path(pdf_path)
            if pdf_path.suffix.lower() != ".pdf":
                continue

            pages = extract_pdf_pages(pdf_path)
            pdf_count += 1
            page_count += len(pages)

            for page in pages:
                chunks = chunk_text(
                    page["text"],
                    chunk_size=CHUNK_SIZE,
                    overlap=CHUNK_OVERLAP,
                )

                for chunk_index, chunk in enumerate(chunks):
                    all_documents.append({
                        "id": str(uuid4()),
                        "text": chunk,
                        "metadata": {
                            "source": page["source"],
                            "page": page["page"],
                            "chunk": chunk_index + 1,
                        },
                    })

        chunks_added = self.store.add_documents(all_documents)

        return {
            "pdfs": pdf_count,
            "pages": page_count,
            "chunks": chunks_added,
            "stats": self.store.stats(),
        }

    def query(self, question, top_k=None):
        top_k = top_k or TOP_K
        retrieved = self.store.search(question, top_k=top_k)

        if not retrieved:
            return {
                "answer": "No indexed content is available. Upload five Python PDFs and build the knowledge base first.",
                "sources": [],
            }

        answer = self.groq.answer(question, retrieved)

        sources = [
            {
                "source": item["source"],
                "page": item["page"],
                "distance": item["distance"],
            }
            for item in retrieved
        ]

        return {
            "answer": answer,
            "sources": sources,
        }

    def stats(self):
        return self.store.stats()
