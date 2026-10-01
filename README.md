# AI Study Assistant using RAG

A FastAPI-based AI Study Assistant that answers questions from five Python programming PDF chapters using Retrieval-Augmented Generation (RAG).

The project extracts PDF text, splits it into chunks, creates local sentence embeddings, stores those vectors in ChromaDB, retrieves the most relevant chunks for a question, and sends the retrieved context to Groq for the final answer.

## Assignment Requirements Covered

- Upload 5 PDF files
- Extract text from all PDFs
- Split text into chunks
- Generate embeddings for all chunks
- Save embeddings locally using ChromaDB
- Ask questions through a FastAPI web interface
- Retrieve relevant chunks using RAG
- Send retrieved context to Groq
- Display the final AI-generated answer
- Show retrieved source files and pages

## Technology Stack

- Python
- FastAPI
- Jinja2
- PyMuPDF
- Sentence Transformers
- ChromaDB
- Groq API
- HTML
- CSS
- JavaScript

## Project Structure

```text
AI_Study_Assistant_RAG/
│
├── app/
│   ├── __init__.py
│   ├── config.py
│   ├── groq_service.py
│   ├── main.py
│   ├── pdf_processor.py
│   ├── rag_service.py
│   └── vector_store.py
│
├── data/
│   ├── pdfs/
│   │   ├── chapter_01_introduction.pdf
│   │   ├── chapter_02_variables_data_types.pdf
│   │   ├── chapter_03_conditionals.pdf
│   │   ├── chapter_04_loops.pdf
│   │   └── chapter_05_functions.pdf
│   └── uploads/
│
├── chroma_db/
├── static/
│   ├── app.js
│   └── style.css
│
├── templates/
│   └── index.html
│
├── .env.example
├── .gitignore
├── ingest.py
├── requirements.txt
└── README.md
```

## 1. Create a Virtual Environment

Windows PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\activate
```

## 2. Install Dependencies

```powershell
pip install -r requirements.txt
```

The first embedding run may download the `all-MiniLM-L6-v2` model.

## 3. Configure Groq

Create a `.env` file from `.env.example`:

```powershell
Copy-Item .env.example .env
```

Then open `.env` and add your Groq API key:

```env
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-120b
EMBEDDING_MODEL=all-MiniLM-L6-v2
CHUNK_SIZE=900
CHUNK_OVERLAP=150
TOP_K=5
```

Do not commit `.env` to GitHub.

## 4. Run the Application

```powershell
uvicorn app.main:app --reload
```

Open:

```text
http://127.0.0.1:8000
```

## 5. Use the Web Interface

### Step 1 — Upload PDFs

Select exactly five PDF chapters.

### Step 2 — Build Knowledge Base

The application will:

1. Extract text with PyMuPDF
2. Split the text into overlapping chunks
3. Generate sentence embeddings
4. Store the embeddings and metadata in ChromaDB

### Step 3 — Ask Questions

Try:

- What are Python variables?
- Explain the difference between a list and a tuple.
- What is a for loop?
- How do functions work in Python?
- What are conditional statements?

The application retrieves relevant chunks and sends only those chunks to Groq.

## Optional CLI Indexing

The included sample PDFs can also be indexed without using the upload UI:

```powershell
python ingest.py
```

Then start FastAPI and ask questions from the browser.

## RAG Flow

```text
5 Python PDFs
      |
      v
Text Extraction
      |
      v
Text Chunking
      |
      v
Sentence Embeddings
      |
      v
Local ChromaDB
      |
      |  User Question
      v
Query Embedding
      |
      v
Similarity Search
      |
      v
Top-K Relevant Chunks
      |
      v
Groq LLM
      |
      v
Final Study Answer
```

## Notes

The included PDFs are original sample Python study notes created for testing the assignment workflow. They can be replaced with other educational Python PDFs.

For scanned/image-only PDFs, OCR is not included in this version. The PDF should contain selectable text for PyMuPDF extraction to work correctly.

## Screenshots for Submission

Capture these screens for the assignment:

1. Five PDF files selected/uploaded
2. Embedding creation / knowledge-base completion
3. ChromaDB indexed chunk count
4. At least three different AI question/answer results
5. The deployed application

## GitHub

Before pushing, verify that `.env` and `chroma_db/` are ignored.

```powershell
git init
git add .
git commit -m "Build AI Study Assistant using RAG"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```
