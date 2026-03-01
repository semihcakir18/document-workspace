/**
 * Annotation panel component
 * Displays and manages all annotations for the current document
 */

import './Annotations.css';
import { useState, useEffect } from 'react';
import { StickyNote, Highlighter, FileText, Trash2, Tag } from 'lucide-react';
import { useStore } from '../store/useStore';
import { getAnnotationsByDocument, deleteAnnotation } from '../services/db';
import type { Annotation } from '../types/index';

export default function AnnotationPanel() {
  const { selectedDocument, scrollToChunk } = useStore();
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [filterTag, setFilterTag] = useState<string>('all');
  const [allTags, setAllTags] = useState<string[]>([]);

  useEffect(() => {
    if (selectedDocument) {
      loadAnnotations();
    } else {
      setAnnotations([]);
    }
  }, [selectedDocument]);

  const loadAnnotations = async () => {
    if (!selectedDocument) return;
    const annots = await getAnnotationsByDocument(selectedDocument.id);
    setAnnotations(annots);

    // Extract unique tags
    const tags = new Set<string>();
    annots.forEach(a => {
      a.tags?.forEach(tag => tags.add(tag));
    });
    setAllTags(Array.from(tags).sort());
  };

  const handleDelete = async (id: string) => {
    const confirm = window.confirm('Delete this annotation?');
    if (confirm) {
      await deleteAnnotation(id);
      await loadAnnotations();
    }
  };

  const handleAnnotationClick = (annotation: Annotation) => {
    if (annotation.chunkId) {
      scrollToChunk(annotation.chunkId);
    }
  };

  const filteredAnnotations = filterTag === 'all'
    ? annotations
    : annotations.filter(a => a.tags?.includes(filterTag));

  const highlightAnnotations = filteredAnnotations.filter(a => a.type === 'highlight');
  const noteAnnotations = filteredAnnotations.filter(a => a.type === 'note');

  if (!selectedDocument) {
    return (
      <div className="annotation-panel">
        <div className="annotation-empty">
          <StickyNote className="empty-icon" />
          <p>Select a document to view annotations</p>
        </div>
      </div>
    );
  }

  return (
    <div className="annotation-panel">
      <div className="annotation-header">
        <div className="annotation-header-title">
          <StickyNote className="header-icon" />
          <h3>Annotations</h3>
        </div>
        <span className="annotation-count">{filteredAnnotations.length}</span>
      </div>

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="tag-filter">
          <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)}>
            <option value="all">All Tags ({annotations.length})</option>
            {allTags.map(tag => (
              <option key={tag} value={tag}>
                {tag} ({annotations.filter(a => a.tags?.includes(tag)).length})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="annotation-list">
        {filteredAnnotations.length === 0 ? (
          <div className="annotation-empty">
            <p className="text-muted">No annotations yet</p>
            <p className="help-text">
              Select text in the document to create highlights and notes
            </p>
          </div>
        ) : (
          <>
            {/* Highlights section */}
            {highlightAnnotations.length > 0 && (
              <div className="annotation-section">
                <h4>
                  <Highlighter className="section-icon" />
                  Highlights ({highlightAnnotations.length})
                </h4>
                {highlightAnnotations.map(annotation => (
                  <div
                    key={annotation.id}
                    className="annotation-item highlight-item"
                    onClick={() => handleAnnotationClick(annotation)}
                  >
                    <div className="annotation-content">
                      <div
                        className="highlight-color"
                        style={{ background: annotation.color }}
                      />
                      <div className="annotation-text">
                        "{annotation.selectedText?.slice(0, 100)}
                        {annotation.selectedText && annotation.selectedText.length > 100 ? '...' : ''}"
                      </div>
                    </div>
                    {annotation.tags && annotation.tags.length > 0 && (
                      <div className="annotation-tags">
                        {annotation.tags.map(tag => (
                          <span key={tag} className="tag">{tag}</span>
                        ))}
                      </div>
                    )}
                    <div className="annotation-meta">
                      <span className="annotation-date">
                        {new Date(annotation.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        className="delete-annotation"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(annotation.id);
                        }}
                      >
                        <Trash2 className="delete-icon" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Notes section */}
            {noteAnnotations.length > 0 && (
              <div className="annotation-section">
                <h4>
                  <FileText className="section-icon" />
                  Notes ({noteAnnotations.length})
                </h4>
                {noteAnnotations.map(annotation => (
                  <div
                    key={annotation.id}
                    className="annotation-item note-item"
                    onClick={() => handleAnnotationClick(annotation)}
                  >
                    <div className="annotation-content">
                      {annotation.note && (
                        <div className="note-text">{annotation.note}</div>
                      )}
                      {annotation.selectedText && (
                        <div className="note-reference">
                          "{annotation.selectedText.slice(0, 80)}..."
                        </div>
                      )}
                    </div>
                    {annotation.tags && annotation.tags.length > 0 && (
                      <div className="annotation-tags">
                        {annotation.tags.map(tag => (
                          <span key={tag} className="tag">{tag}</span>
                        ))}
                      </div>
                    )}
                    <div className="annotation-meta">
                      <span className="annotation-date">
                        {new Date(annotation.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        className="delete-annotation"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(annotation.id);
                        }}
                      >
                        <Trash2 className="delete-icon" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
