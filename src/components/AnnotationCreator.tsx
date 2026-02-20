/**
 * Annotation creator component
 * Modal for creating highlights and notes from selected text
 */

import './Annotations.css';
import { useState } from 'react';
import { saveAnnotation } from '../services/db';
import type { Annotation } from '../types/index';

interface AnnotationCreatorProps {
  documentId: string;
  chunkId: string;
  selectedText: string;
  position: { x: number; y: number };
  onClose: () => void;
  onCreated: () => void;
}

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: '#fef08a' },
  { name: 'Green', value: '#bbf7d0' },
  { name: 'Blue', value: '#bfdbfe' },
  { name: 'Pink', value: '#fbcfe8' },
  { name: 'Purple', value: '#e9d5ff' },
];

export default function AnnotationCreator({
  documentId,
  chunkId,
  selectedText,
  position,
  onClose,
  onCreated,
}: AnnotationCreatorProps) {
  const [type, setType] = useState<'highlight' | 'note'>('highlight');
  const [color, setColor] = useState(HIGHLIGHT_COLORS[0].value);
  const [note, setNote] = useState('');
  const [tags, setTags] = useState('');

  const handleCreate = async () => {
    const annotation: Annotation = {
      id: crypto.randomUUID(),
      documentId,
      chunkId,
      type,
      selectedText,
      color: type === 'highlight' ? color : undefined,
      note: note.trim() || undefined,
      tags: tags.trim() ? tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
      createdAt: new Date(),
    };

    await saveAnnotation(annotation);
    onCreated();
    onClose();
  };

  return (
    <>
      <div className="annotation-creator-overlay" onClick={onClose} />
      <div
        className="annotation-creator"
        style={{
          top: `${position.y}px`,
          left: `${position.x}px`,
        }}
      >
        <div className="creator-header">
          <h4>Create Annotation</h4>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div className="creator-content">
          {/* Selected text preview */}
          <div className="selected-text-preview">
            "{selectedText.slice(0, 150)}{selectedText.length > 150 ? '...' : ''}"
          </div>

          {/* Type selector */}
          <div className="type-selector">
            <button
              className={`type-button ${type === 'highlight' ? 'active' : ''}`}
              onClick={() => setType('highlight')}
            >
              🖍️ Highlight
            </button>
            <button
              className={`type-button ${type === 'note' ? 'active' : ''}`}
              onClick={() => setType('note')}
            >
              📌 Note
            </button>
          </div>

          {/* Color picker (for highlights) */}
          {type === 'highlight' && (
            <div className="color-picker">
              <label>Color:</label>
              <div className="color-options">
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    className={`color-option ${color === c.value ? 'selected' : ''}`}
                    style={{ background: c.value }}
                    onClick={() => setColor(c.value)}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Note input (optional for highlights, required for notes) */}
          <div className="form-group">
            <label>{type === 'note' ? 'Note:' : 'Add note (optional):'}</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Write your note here..."
              rows={3}
            />
          </div>

          {/* Tags input */}
          <div className="form-group">
            <label>Tags (comma-separated):</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., important, review, question"
            />
          </div>

          {/* Actions */}
          <div className="creator-actions">
            <button className="cancel-button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="create-button"
              onClick={handleCreate}
              disabled={type === 'note' && !note.trim()}
            >
              Create {type === 'highlight' ? 'Highlight' : 'Note'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
