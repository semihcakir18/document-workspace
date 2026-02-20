/**
 * Document viewer component
 * Displays the selected PDF document with text highlighting support
 */

import { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { getChunksByDocument } from '../../services/db';
import type { DocumentChunk } from '../../types/index';

export default function DocumentViewer() {
  const { selectedDocument, highlightedChunkIds } = useStore();
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedDocument) {
      loadDocumentChunks();
    }
  }, [selectedDocument]);

  const loadDocumentChunks = async () => {
    if (!selectedDocument) return;

    setLoading(true);
    try {
      const docChunks = await getChunksByDocument(selectedDocument.id);

      // Sort chunks by page number, then by start index
      const sortedChunks = docChunks.sort((a, b) => {
        if (a.pageNumber !== b.pageNumber) {
          return a.pageNumber - b.pageNumber;
        }
        return a.startIndex - b.startIndex;
      });

      setChunks(sortedChunks);
    } catch (error) {
      console.error('Failed to load document chunks:', error);
    } finally {
      setLoading(false);
    }
  };

  // Remove overlapping text from chunks for display purposes
  const getDisplayText = (chunk: DocumentChunk, index: number): string => {
    if (index === 0) {
      return chunk.text;
    }

    const prevChunk = chunks[index - 1];

    // Only remove overlap if chunks are from the same page
    if (prevChunk.pageNumber !== chunk.pageNumber) {
      return chunk.text;
    }

    // Find overlap by comparing the end of previous chunk with start of current chunk
    const prevText = prevChunk.text;
    const currText = chunk.text;

    // Look for overlap up to 300 characters (max overlap size)
    const maxOverlap = Math.min(300, prevText.length, currText.length);

    for (let overlapLen = maxOverlap; overlapLen > 20; overlapLen--) {
      const prevEnd = prevText.slice(-overlapLen);
      const currStart = currText.slice(0, overlapLen);

      // If we find a match, remove the overlapping portion
      if (prevEnd === currStart) {
        return currText.slice(overlapLen).trim();
      }
    }

    // If no overlap found, return original text
    return currText;
  };

  if (!selectedDocument) {
    return null;
  }

  if (loading) {
    return (
      <div className="viewer-loading">
        <div className="spinner"></div>
        <p>Loading document...</p>
      </div>
    );
  }

  return (
    <div className="document-viewer">
      <div className="document-header">
        <h2>{selectedDocument.name}</h2>
        <div className="document-meta">
          {selectedDocument.pageCount && (
            <span>{selectedDocument.pageCount} pages</span>
          )}
        </div>
      </div>

      <div className="document-content">
        {chunks.length === 0 ? (
          <div className="empty-message">
            <p>No content available</p>
            <p className="text-muted">The document may still be processing</p>
          </div>
        ) : (
          <div className="text-content">
            {chunks.map((chunk, index) => {
              const displayText = getDisplayText(chunk, index);
              // Only show chunk if it has non-overlapping content
              if (!displayText) return null;

              const isHighlighted = highlightedChunkIds.includes(chunk.id);

              return (
                <div
                  key={chunk.id}
                  className={`text-chunk ${isHighlighted ? 'highlighted' : ''}`}
                  data-chunk-id={chunk.id}
                >
                  <span className="page-number">Page {chunk.pageNumber}</span>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{displayText}</p>
                  {isHighlighted && <div className="highlight-badge">Referenced</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
