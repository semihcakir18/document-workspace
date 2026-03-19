/**
 * PDF Preview component with chunk highlighting
 * Renders actual PDF with highlighted chunks overlaid
 */

import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { DocumentChunk } from '../types/index';
import './PDFPreview.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFPreviewProps {
  fileUrl: string;
  chunks: DocumentChunk[];
}

export default function PDFPreview({ fileUrl, chunks }: PDFPreviewProps) {
  const { highlightedChunkIds } = useStore();
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [pageWidth, setPageWidth] = useState<number>(0);
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set());

  // Get chunks for current page (define early so useEffect can use it)
  const pageChunks = chunks.filter(chunk => chunk.pageNumber === pageNumber);

  useEffect(() => {
    // Auto-scroll to page with highlighted chunk
    if (highlightedChunkIds.length > 0) {
      const highlightedChunk = chunks.find(c => highlightedChunkIds.includes(c.id));
      if (highlightedChunk) {
        setPageNumber(highlightedChunk.pageNumber);
      }
    }
  }, [highlightedChunkIds, chunks]);

  // Apply highlights to text layer after page renders
  useEffect(() => {
    const timer = setTimeout(() => {
      applyTextHighlights();
    }, 300); // Wait for text layer to render

    return () => clearTimeout(timer);
  }, [pageNumber, chunks, highlightedChunkIds]);

  const applyTextHighlights = () => {
    console.log('Applying text highlights...');

    // Find the text layer in the DOM
    const textLayer = document.querySelector('.react-pdf__Page__textContent') as HTMLElement;
    if (!textLayer) {
      console.log('Text layer not found!');
      return;
    }

    console.log('Text layer found:', textLayer);

    // Reset existing highlights
    textLayer.querySelectorAll('span').forEach(el => {
      (el as HTMLElement).style.backgroundColor = '';
    });

    // Get all text spans in the text layer
    const textSpans = Array.from(textLayer.querySelectorAll('span')) as HTMLElement[];
    console.log('Found text spans:', textSpans.length);

    if (textSpans.length === 0) {
      console.log('No text spans found, retrying...');
      setTimeout(applyTextHighlights, 500);
      return;
    }

    // Strip ALL whitespace for matching (eliminates all spacing differences)
    const stripWs = (s: string) => s.toLowerCase().replace(/\s+/g, '');

    // Build a stripped version of the text layer text
    // For each char in the stripped version, track which span it belongs to
    const strippedChars: Array<{ spanIdx: number }> = [];
    let strippedCombined = '';
    textSpans.forEach((span, spanIdx) => {
      const text = span.textContent || '';
      for (let c = 0; c < text.length; c++) {
        const ch = text[c];
        if (!/\s/.test(ch)) {
          strippedChars.push({ spanIdx });
          strippedCombined += ch.toLowerCase();
        }
      }
    });

    // Compute de-overlapped display text for each chunk (same as sidebar/Plain View)
    const displayTexts = pageChunks.map((chunk, index) => {
      let displayText = chunk.text;
      if (index > 0) {
        const prevChunk = pageChunks[index - 1];
        const prevText = prevChunk.text;
        const maxOverlap = Math.min(300, prevText.length, displayText.length);
        for (let overlapLen = maxOverlap; overlapLen > 20; overlapLen--) {
          if (prevText.slice(-overlapLen) === displayText.slice(0, overlapLen)) {
            displayText = displayText.slice(overlapLen).trim();
            break;
          }
        }
      }
      return displayText;
    });

    // Determine highlight for each span: yellow > grey > none
    const spanHighlights: Array<{ type: 'none' | 'grey' | 'yellow'; opacity: number }> =
      textSpans.map(() => ({ type: 'none' as const, opacity: 0 }));

    pageChunks.forEach((chunk, chunkIndex) => {
      const isReferenced = highlightedChunkIds.includes(chunk.id);
      const opacity = 0.15 + (chunkIndex * 0.05);
      const displayText = displayTexts[chunkIndex];
      if (!displayText) return;

      const chunkStripped = stripWs(displayText);

      // Find the start of this chunk in the stripped combined text
      const idx = strippedCombined.indexOf(chunkStripped.substring(0, Math.min(80, chunkStripped.length)));
      if (idx === -1) {
        console.log(`Chunk ${chunkIndex + 1}: not found`);
        return;
      }

      // Find the end
      const endSearch = chunkStripped.substring(Math.max(0, chunkStripped.length - 80));
      const endIdx = strippedCombined.indexOf(endSearch, idx);
      const end = endIdx !== -1 ? endIdx + endSearch.length : idx + chunkStripped.length;

      console.log(`Chunk ${chunkIndex + 1}: stripped ${idx}-${end} (of ${strippedCombined.length})`);

      // Mark the spans
      for (let c = idx; c < Math.min(end, strippedChars.length); c++) {
        const { spanIdx } = strippedChars[c];
        if (isReferenced) {
          spanHighlights[spanIdx] = { type: 'yellow', opacity: 0.4 };
        } else if (spanHighlights[spanIdx].type !== 'yellow') {
          spanHighlights[spanIdx] = { type: 'grey', opacity };
        }
      }
    });

    // Apply highlights directly as background-color on the spans themselves
    for (let i = 0; i < textSpans.length; i++) {
      const h = spanHighlights[i];
      if (h.type === 'none') {
        textSpans[i].style.backgroundColor = '';
        continue;
      }
      textSpans[i].style.backgroundColor = h.type === 'yellow'
        ? 'rgba(255, 235, 59, 0.4)'
        : `rgba(158, 158, 158, ${h.opacity})`;
      textSpans[i].style.borderRadius = '2px';
    }

    console.log('Highlighting complete');
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const goToPrevPage = () => {
    setPageNumber(prev => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setPageNumber(prev => Math.min(numPages, prev + 1));
  };

  const goToPage = (page: number) => {
    setPageNumber(Math.max(1, Math.min(numPages, page)));
  };

  return (
    <div className="pdf-preview">
      <div className="pdf-controls">
        <button
          className="pdf-nav-button"
          onClick={goToPrevPage}
          disabled={pageNumber <= 1}
        >
          <ChevronLeft className="icon" />
        </button>

        <div className="pdf-page-info">
          <input
            type="number"
            min={1}
            max={numPages}
            value={pageNumber}
            onChange={(e) => goToPage(Number(e.target.value))}
            className="pdf-page-input"
          />
          <span className="pdf-page-total">of {numPages}</span>
        </div>

        <button
          className="pdf-nav-button"
          onClick={goToNextPage}
          disabled={pageNumber >= numPages}
        >
          <ChevronRight className="icon" />
        </button>
      </div>

      <div className="pdf-content-wrapper">
        <div className="pdf-container">
          <Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<div className="pdf-loading">Loading PDF...</div>}
            error={<div className="pdf-error">Failed to load PDF</div>}
          >
            <div className="pdf-page-wrapper">
              <Page
                pageNumber={pageNumber}
                width={pageWidth || undefined}
                onLoadSuccess={(page) => {
                  // Set page width to container width
                  const container = document.querySelector('.pdf-container');
                  if (container) {
                    setPageWidth(container.clientWidth - 40);
                  }
                }}
                renderTextLayer={true}
                renderAnnotationLayer={false}
              />
            </div>
          </Document>
        </div>

        {/* Chunk sidebar */}
        {pageChunks.length > 0 && (
          <div className="pdf-chunks-sidebar">
            <div className="sidebar-header">
              Chunks on Page {pageNumber}
            </div>
            <div className="chunks-list">
              {pageChunks.map((chunk, index) => {
                const isHighlighted = highlightedChunkIds.includes(chunk.id);

                // Remove overlap with previous chunk (same logic as Plain View)
                let displayText = chunk.text;
                if (index > 0) {
                  const prevChunk = pageChunks[index - 1];
                  const prevText = prevChunk.text;
                  const maxOverlap = Math.min(300, prevText.length, displayText.length);
                  for (let overlapLen = maxOverlap; overlapLen > 20; overlapLen--) {
                    if (prevText.slice(-overlapLen) === displayText.slice(0, overlapLen)) {
                      displayText = displayText.slice(overlapLen).trim();
                      break;
                    }
                  }
                }

                if (!displayText) return null;

                const isExpanded = expandedChunks.has(chunk.id);
                const needsTruncation = displayText.length > 200;

                return (
                  <div
                    key={chunk.id}
                    className={`chunk-item ${isHighlighted ? 'highlighted' : ''}`}
                    data-chunk-id={chunk.id}
                  >
                    <div className="chunk-number">Chunk {index + 1}</div>
                    <div className="chunk-text">
                      {needsTruncation && !isExpanded
                        ? displayText.slice(0, 200) + '...'
                        : displayText}
                    </div>
                    {needsTruncation && (
                      <button
                        className="chunk-expand-btn"
                        onClick={() => {
                          setExpandedChunks(prev => {
                            const next = new Set(prev);
                            if (next.has(chunk.id)) {
                              next.delete(chunk.id);
                            } else {
                              next.add(chunk.id);
                            }
                            return next;
                          });
                        }}
                      >
                        {isExpanded ? 'Show less' : 'Show more'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
