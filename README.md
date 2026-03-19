# Document Workspace

A browser-based document workspace for uploading, organizing, and querying PDF documents using AI. Built with React and TypeScript.

## Features

- **PDF Upload and Parsing** -- Upload PDF files which are parsed into text chunks and stored locally in IndexedDB
- **Document Groups** -- Organize documents into color-coded groups with drag-and-drop support
- **AI-Powered Chat** -- Ask questions about your documents using OpenAI or Anthropic APIs with relevant chunks retrieved via semantic or keyword search
- **Clickable Citations** -- Chat responses include source citations that scroll to and highlight the referenced text
- **PDF Preview** -- View the original PDF with chunk highlighting overlaid on the text layer (grey for all chunks, yellow for referenced chunks)
- **Plain Text View** -- Read document content as plain text with chunk boundaries and page numbers
- **Annotations** -- Highlight and annotate text within documents
- **Semantic Search** -- Uses embeddings for vector similarity search with keyword search fallback
- **Settings** -- Configure chunk size, overlap, API keys, and other preferences
- **Dark/Light Theme** -- Supports system, dark, and light themes
- **Fully Client-Side** -- All document data is stored in the browser via IndexedDB; nothing is sent to a server except API calls for AI responses and embeddings

## Tech Stack

- React 19
- TypeScript
- Vite
- Zustand (state management)
- IndexedDB via idb (local storage)
- PDF.js / react-pdf (PDF rendering)
- Framer Motion (animations)
- Lucide React (icons)
- React Markdown (chat rendering)

## Getting Started

### Prerequisites

- Node.js 18+
- An OpenAI or Anthropic API key (for AI chat and semantic search)

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Opens at `http://localhost:5173`.

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
src/
  components/       UI components (PDFPreview, Settings, Citations, etc.)
  features/         Feature modules (documents, AI, annotations, embeddings)
  services/         Core services (PDF parsing, DB, AI, search, embeddings)
  store/            Zustand global state
  types/            TypeScript type definitions
  styles/           Global styles and CSS variables
  hooks/            Custom React hooks
  utils/            Utility functions
```

## Usage

1. Open the app and enter your API key in the settings or the prompt that appears on first load
2. Upload a PDF using the upload button in the sidebar
3. Documents are automatically parsed into chunks and stored locally
4. Select a document or group to view its contents
5. Use the chat panel to ask questions -- the AI will find relevant chunks and respond with citations
6. Click on citations to jump to the referenced text
7. Switch between Plain View and PDF Preview using the tabs above the document content
