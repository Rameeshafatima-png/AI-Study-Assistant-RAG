from pathlib import Path

from app.config import PDF_DIR
from app.rag_service import RAGService

def main():
    pdfs = sorted(PDF_DIR.glob("*.pdf"))

    if len(pdfs) != 5:
        print(f"Found {len(pdfs)} PDFs. Put exactly 5 Python chapter PDFs in: {PDF_DIR}")
        return

    service = RAGService()
    result = service.build_index(pdfs)

    print("\nKnowledge base created successfully.")
    print(f"PDFs:   {result['pdfs']}")
    print(f"Pages:  {result['pages']}")
    print(f"Chunks: {result['chunks']}")
    print(f"Chroma: {result['stats']['database_path']}")

if __name__ == "__main__":
    main()
