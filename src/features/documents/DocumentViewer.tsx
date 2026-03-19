/**
 * Document viewer component
 * Displays the selected PDF document with text highlighting support
 */

import React, { useState, useEffect, useRef } from "react";
import { FileText, Eye } from "lucide-react";
import { motion } from "framer-motion";
import { useStore } from "../../store/useStore";
import {
  getChunksByDocument,
  getAnnotationsByDocument,
} from "../../services/db";
import AnnotationCreator from "../../components/AnnotationCreator";
import PDFPreview from "../../components/PDFPreview";
import "./DocumentViewer.css";
import type { DocumentChunk, Annotation } from "../../types/index";

export default function DocumentViewer() {
  const { selectedDocument, highlightedChunkIds } = useStore();
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [showAnnotationCreator, setShowAnnotationCreator] = useState(false);
  const [activeView, setActiveView] = useState<"plain" | "pdf">("plain");
  const plainViewScrollRef = useRef<number>(0);
  const [selectionData, setSelectionData] = useState<{
    text: string;
    chunkId: string;
    position: { x: number; y: number };
  } | null>(null);

  // Create and manage blob URL for PDF preview
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    // Create new blob URL when document changes
    if (selectedDocument?.fileData) {
      const blob = new Blob([selectedDocument.fileData], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);

      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setPdfUrl(null);
    }
  }, [selectedDocument?.id]); // Only recreate when document ID changes

  useEffect(() => {
    if (selectedDocument) {
      loadDocumentChunks();
      loadAnnotations();
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
      console.error("Failed to load document chunks:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadAnnotations = async () => {
    if (!selectedDocument) return;
    try {
      const annots = await getAnnotationsByDocument(selectedDocument.id);
      setAnnotations(annots);
    } catch (error) {
      console.error("Failed to load annotations:", error);
    }
  };

  const handleTextSelection = (chunkId: string) => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();

    if (selectedText && selectedText.length > 0) {
      const range = selection?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();

      if (rect) {
        setSelectionData({
          text: selectedText,
          chunkId,
          position: {
            x: rect.left + rect.width / 2,
            y: rect.top - 10,
          },
        });
        setShowAnnotationCreator(true);
      }
    }
  };

  const handleAnnotationCreated = async () => {
    await loadAnnotations();
    window.getSelection()?.removeAllRanges();
  };

  // Render text with annotation highlights
  const renderTextWithAnnotations = (
    text: string,
    chunkAnnotations: Annotation[],
  ) => {
    if (chunkAnnotations.length === 0) {
      return text;
    }

    // For simplicity, just wrap the entire selected text in a highlight
    // In a production app, you'd want more sophisticated text matching
    const segments: React.JSX.Element[] = [];
    let lastIndex = 0;

    chunkAnnotations.forEach((annotation, idx) => {
      if (!annotation.selectedText) return;

      const matchIndex = text.indexOf(annotation.selectedText, lastIndex);
      if (matchIndex !== -1) {
        // Add text before the match
        if (matchIndex > lastIndex) {
          segments.push(
            <span key={`text-${idx}`}>
              {text.slice(lastIndex, matchIndex)}
            </span>,
          );
        }

        // Add highlighted text
        segments.push(
          <mark
            key={`mark-${idx}`}
            className="annotation-highlight"
            style={{ background: annotation.color }}
            title={annotation.note || "Highlight"}
          >
            {annotation.selectedText}
          </mark>,
        );

        lastIndex = matchIndex + annotation.selectedText.length;
      }
    });

    // Add remaining text
    if (lastIndex < text.length) {
      segments.push(<span key="text-end">{text.slice(lastIndex)}</span>);
    }

    return segments.length > 0 ? segments : text;
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
        <div className="document-title">
          <h2>{selectedDocument.name}</h2>
          <div className="document-meta">
            {selectedDocument.pageCount && (
              <span>{selectedDocument.pageCount} pages</span>
            )}
          </div>
        </div>

        {/* View tabs */}
        <div className="view-tabs">
          <button
            className={`view-tab ${activeView === "plain" ? "active" : ""}`}
            onClick={() => {
              setActiveView("plain");
              // Restore scroll position after render
              setTimeout(() => {
                const content = document.querySelector(".document-content");
                if (content) content.scrollTop = plainViewScrollRef.current;
              }, 0);
            }}
          >
            <FileText className="tab-icon" />
            <span>Plain View</span>
            {activeView === "plain" && (
              <motion.div layoutId="activeViewTab" className="tab-indicator" />
            )}
          </button>
          <button
            className={`view-tab ${activeView === "pdf" ? "active" : ""}`}
            onClick={() => {
              // Save plain view scroll position before switching
              const content = document.querySelector(".document-content");
              if (content) plainViewScrollRef.current = content.scrollTop;
              setActiveView("pdf");
            }}
            disabled={!pdfUrl}
            title={!pdfUrl ? "PDF preview not available" : "View original PDF"}
          >
            <Eye className="tab-icon" />
            <span>PDF Preview</span>
            {activeView === "pdf" && (
              <motion.div layoutId="activeViewTab" className="tab-indicator" />
            )}
          </button>
        </div>
      </div>

      <div className="document-content">
        {/* Plain text view */}
        {activeView === "plain" && (
          <>
            {chunks.length === 0 ? (
              <div className="empty-message">
                <p>No content available</p>
                <p className="text-muted">
                  The document may still be processing
                </p>
              </div>
            ) : (
              <div className="text-content">
                {chunks.map((chunk, index) => {
                  const displayText = getDisplayText(chunk, index);
                  // Only show chunk if it has non-overlapping content
                  if (!displayText) return null;

                  const isHighlighted = highlightedChunkIds.includes(chunk.id);
                  const chunkAnnotations = annotations.filter(
                    (a) => a.chunkId === chunk.id && a.type === "highlight",
                  );

                  return (
                    <div
                      key={chunk.id}
                      className={`text-chunk ${isHighlighted ? "highlighted" : ""}`}
                      data-chunk-id={chunk.id}
                      onMouseUp={() => handleTextSelection(chunk.id)}
                    >
                      <span className="page-number">
                        Page {chunk.pageNumber}
                      </span>
                      <p
                        style={{ whiteSpace: "pre-wrap", position: "relative" }}
                      >
                        {renderTextWithAnnotations(
                          displayText,
                          chunkAnnotations,
                        )}
                      </p>
                      {isHighlighted && (
                        <div className="highlight-badge">Referenced</div>
                      )}
                      {chunkAnnotations.length > 0 && (
                        <div className="chunk-annotations">
                          {chunkAnnotations.length} annotation
                          {chunkAnnotations.length !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* PDF Preview */}
        {activeView === "pdf" && pdfUrl && (
          <PDFPreview fileUrl={pdfUrl} chunks={chunks} />
        )}
      </div>

      {/* Annotation creator - only show in plain view */}
      {activeView === "plain" && showAnnotationCreator && selectionData && (
        <AnnotationCreator
          documentId={selectedDocument.id}
          chunkId={selectionData.chunkId}
          selectedText={selectionData.text}
          position={selectionData.position}
          onClose={() => {
            setShowAnnotationCreator(false);
            setSelectionData(null);
          }}
          onCreated={handleAnnotationCreated}
        />
      )}
    </div>
  );
}
