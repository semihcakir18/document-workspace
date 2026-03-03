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

    // Remove existing highlights
    textLayer.querySelectorAll('.pdf-text-highlight').forEach(el => el.remove());

    // Get all text spans in the text layer
    const textSpans = Array.from(textLayer.querySelectorAll('span')) as HTMLElement[];
    console.log('Found text spans:', textSpans.length);

    if (textSpans.length === 0) {
      console.log('No text spans found, retrying...');
      setTimeout(applyTextHighlights, 500);
      return;
    }

    // Build a character-to-span mapping
    const spanRanges: Array<{ start: number; end: number }> = [];
    let totalChars = 0;
    textSpans.forEach(span => {
      const len = (span.textContent || '').length;
      spanRanges.push({ start: totalChars, end: totalChars + len });
      totalChars += len;
    });

    // Find the max endIndex to know the total page text length
    const maxEndIndex = Math.max(...pageChunks.map(c => c.endIndex), 1);

    // First pass: determine what each span should look like
    // Each span gets exactly ONE highlight - yellow takes priority over grey
    const spanHighlights: Array<{ type: 'none' | 'grey' | 'yellow'; opacity: number }> =
      textSpans.map(() => ({ type: 'none' as const, opacity: 0 }));

    pageChunks.forEach((chunk, chunkIndex) => {
      const isReferenced = highlightedChunkIds.includes(chunk.id);
      const opacity = 0.15 + (chunkIndex * 0.05);

      // Map chunk range to span character range
      const chunkStartRatio = chunk.startIndex / maxEndIndex;
      const chunkEndRatio = chunk.endIndex / maxEndIndex;
      const mappedStart = Math.floor(chunkStartRatio * totalChars);
      const mappedEnd = Math.ceil(chunkEndRatio * totalChars);

      // Mark spans that fall within this chunk's range
      for (let i = 0; i < textSpans.length; i++) {
        const range = spanRanges[i];
        if (range.end > mappedStart && range.start < mappedEnd) {
          if (isReferenced) {
            // Yellow always wins
            spanHighlights[i] = { type: 'yellow', opacity: 0.4 };
          } else if (spanHighlights[i].type !== 'yellow') {
            // Only set grey if not already yellow, and don't stack opacity
            spanHighlights[i] = { type: 'grey', opacity };
          }
        }
      }
    });

    // Second pass: create exactly one highlight div per span that needs it
    for (let i = 0; i < textSpans.length; i++) {
      const h = spanHighlights[i];
      if (h.type === 'none') continue;

      const span = textSpans[i];
      const spanStyle = window.getComputedStyle(span);

      const highlight = document.createElement('div');
      highlight.className = `pdf-text-highlight ${h.type === 'yellow' ? 'referenced' : ''}`;
      highlight.style.position = 'absolute';
      highlight.style.left = spanStyle.left;
      highlight.style.top = spanStyle.top;
      highlight.style.width = `${span.offsetWidth}px`;
      highlight.style.height = `${span.offsetHeight}px`;
      highlight.style.backgroundColor = h.type === 'yellow'
        ? 'rgba(255, 235, 59, 0.4)'
        : `rgba(158, 158, 158, ${h.opacity})`;
      highlight.style.pointerEvents = 'none';
      highlight.style.zIndex = '1';

      textLayer.appendChild(highlight);
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
                return (
                  <div
                    key={chunk.id}
                    className={`chunk-item ${isHighlighted ? 'highlighted' : ''}`}
                    data-chunk-id={chunk.id}
                  >
                    <div className="chunk-number">Chunk {index + 1}</div>
                    <div className="chunk-text">
                      {chunk.text.length > 150
                        ? chunk.text.slice(0, 150) + '...'
                        : chunk.text}
                    </div>
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
