from pathlib import Path
import fitz

def extract_pdf_pages(pdf_path: Path):
    """Extract text page-by-page so source/page metadata is preserved."""
    pages = []
    document = fitz.open(pdf_path)
    try:
        for page_number, page in enumerate(document):
            text = page.get_text("text").strip()
            if text:
                pages.append({
                    "source": pdf_path.name,
                    "page": page_number + 1,
                    "text": text,
                })
    finally:
        document.close()
    return pages


def chunk_text(text: str, chunk_size: int = 900, overlap: int = 150):
    """Character-based chunking with overlap, keeping the implementation simple."""
    text = " ".join(text.split())
    if not text:
        return []

    if overlap >= chunk_size:
        overlap = max(0, chunk_size // 5)

    chunks = []
    start = 0
    text_length = len(text)

    while start < text_length:
        end = min(start + chunk_size, text_length)
        chunk = text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        if end >= text_length:
            break

        start = end - overlap

    return chunks
