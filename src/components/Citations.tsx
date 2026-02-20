/**
 * Citations component
 * Shows which document chunks were used to generate an AI response
 */

import { useStore } from '../store/useStore';
import './Citations.css';
import type { DocumentChunk } from '../types/index';

interface CitationsProps {
  chunks: DocumentChunk[];
}

export default function Citations({ chunks }: CitationsProps) {
  const { setHighlightedChunks, scrollToChunk } = useStore();

  if (chunks.length === 0) {
    return null;
  }

  const handleCitationClick = (chunkId: string) => {
    setHighlightedChunks([chunkId]);
    scrollToChunk(chunkId);
  };

  const handleShowAll = () => {
    setHighlightedChunks(chunks.map(c => c.id));
    if (chunks.length > 0) {
      scrollToChunk(chunks[0].id);
    }
  };

  return (
    <div className="citations">
      <div className="citations-header">
        <span className="citations-label">📚 Sources ({chunks.length})</span>
        <button className="citations-show-all" onClick={handleShowAll}>
          Show all
        </button>
      </div>
      <div className="citations-list">
        {chunks.map((chunk, idx) => (
          <button
            key={chunk.id}
            className="citation-item"
            onClick={() => handleCitationClick(chunk.id)}
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
