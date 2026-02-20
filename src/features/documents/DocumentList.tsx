/**
 * Document list sidebar component
 * Displays uploaded documents and upload button
 */

import { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { getAllDocuments, deleteDocument, saveDocument, saveChunks } from '../../services/db';
import { parsePDF } from '../../services/pdfParser';
import type { Document } from '../../types/index';

export default function DocumentList() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const { selectedDocument, setSelectedDocument, setLoading, setError } = useStore();

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    const docs = await getAllDocuments();
    setDocuments(docs);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be uploaded again
    e.target.value = '';

    if (!file.type.includes('pdf')) {
      setError('Please upload a PDF file');
      return;
    }

    setUploading(true);
    setLoading(true);
    setError(null);

    try {
      console.log('Parsing PDF:', file.name);
      const { document, chunks } = await parsePDF(file);

      console.log(`Parsed ${chunks.length} chunks from ${document.pageCount} pages`);

      // Save to IndexedDB
      await saveDocument(document);
      await saveChunks(chunks);

      // Reload document list and select the new document
      await loadDocuments();
      setSelectedDocument(document);

      console.log('Document uploaded successfully');
    } catch (err) {
      console.error('Failed to upload document:', err);
      setError('Failed to parse PDF. Please try another file.');
    } finally {
      setUploading(false);
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this document?')) {
      await deleteDocument(id);
      await loadDocuments();
      if (selectedDocument?.id === id) {
        setSelectedDocument(null);
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="document-list">
      <div className="document-list-header">
        <h2>Documents</h2>
        <label className={`upload-button ${uploading ? 'uploading' : ''}`}>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            disabled={uploading}
            style={{ display: 'none' }}
          />
          <span>{uploading ? '⏳ Uploading...' : '+ Upload PDF'}</span>
        </label>
      </div>

      <div className="document-items">
        {documents.length === 0 ? (
          <div className="empty-message">
            <p>No documents yet</p>
            <p className="text-muted">Upload a PDF to get started</p>
          </div>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              className={`document-item ${selectedDocument?.id === doc.id ? 'active' : ''}`}
              onClick={() => setSelectedDocument(doc)}
            >
              <div className="document-icon">📄</div>
              <div className="document-info">
                <div className="document-name">{doc.name}</div>
                <div className="document-meta">
                  {formatFileSize(doc.size)}
                  {doc.pageCount && ` • ${doc.pageCount} pages`}
                </div>
              </div>
              <button
                className="delete-button"
                onClick={(e) => handleDelete(doc.id, e)}
                title="Delete document"
              >
                🗑️
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
