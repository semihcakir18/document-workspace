/**
 * Citations component
 * Shows which document chunks were used to generate an AI response
 */

import { BookOpen } from 'lucide-react';
import { useStore } from '../store/useStore';
import { getDocument } from '../services/db';
import './Citations.css';
import type { DocumentChunk } from '../types/index';

interface CitationsProps {
  chunks: DocumentChunk[];
}

export default function Citations({ chunks }: CitationsProps) {
  const { setHighlightedChunks, scrollToChunk, setSelectedDocument, selectedDocument } = useStore();

  if (chunks.length === 0) {
    return null;
  }

  const handleCitationClick = async (chunk: DocumentChunk) => {
    // Only fetch and set document if it's not already selected
    if (!selectedDocument || selectedDocument.id !== chunk.documentId) {
      const document = await getDocument(chunk.documentId);
      if (document) {
        setSelectedDocument(document);
      }
    }

    // Highlight and scroll to the chunk
    setHighlightedChunks([chunk.id]);

    // Small delay to ensure document loads before scrolling (only needed if document changed)
    const delay = !selectedDocument || selectedDocument.id !== chunk.documentId ? 100 : 0;
    setTimeout(() => {
      scrollToChunk(chunk.id);
    }, delay);
  };

  const handleShowAll = async () => {
    // Open the document containing the first chunk
    if (chunks.length > 0) {
      // Only fetch and set document if it's not already selected
      if (!selectedDocument || selectedDocument.id !== chunks[0].documentId) {
        const document = await getDocument(chunks[0].documentId);
        if (document) {
          setSelectedDocument(document);
        }
      }

      setHighlightedChunks(chunks.map(c => c.id));

      const delay = !selectedDocument || selectedDocument.id !== chunks[0].documentId ? 100 : 0;
      setTimeout(() => {
        scrollToChunk(chunks[0].id);
      }, delay);
    }
  };

  return (
    <div className="citations">
      <div className="citations-header">
        <div className="citations-label">
          <BookOpen className="citations-icon" />
          <span>Sources ({chunks.length})</span>
        </div>
        <button className="citations-show-all" onClick={handleShowAll}>
          Show all
        </button>
      </div>
      <div className="citations-list">
        {chunks.map((chunk, idx) => (
          <button
            key={chunk.id}
            className="citation-item"
            onClick={() => handleCitationClick(chunk)}
            title={chunk.text.slice(0, 100) + '...'}
          >
            <span className="citation-number">{idx + 1}</span>
            <span className="citation-page">Page {chunk.pageNumber}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
