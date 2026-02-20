/**
 * Main 3-column layout component
 * Left: Document list
 * Center: Document viewer
 * Right: AI chat panel
 */

import { useStore } from '../store/useStore';
import DocumentList from '../features/documents/DocumentList';
import DocumentViewer from '../features/documents/DocumentViewer';
import ChatPanel from '../features/ai/ChatPanel';

export default function Layout() {
  const { showDocumentList, showChat, selectedDocument, error, setError } = useStore();

  return (
    <div className="layout">
      {/* Error notification */}
      {error && (
        <div className="error-notification">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1 className="logo">
            <span className="logo-icon">📄</span>
            AI Document Workspace
          </h1>
          <div className="header-actions">
            <button
              className="icon-button"
              onClick={useStore.getState().toggleDocumentList}
              title="Toggle document list"
            >
              📁
            </button>
            <button
              className="icon-button"
              onClick={useStore.getState().toggleChat}
              title="Toggle chat panel"
            >
              💬
            </button>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <div className="main-content">
        {/* Left sidebar - Document list */}
        {showDocumentList && (
          <aside className="sidebar sidebar-left">
            <DocumentList />
          </aside>
        )}

        {/* Center - Document viewer */}
        <main className="viewer-container">
          {selectedDocument ? (
            <DocumentViewer />
          ) : (
            <div className="empty-state">
              <div className="empty-state-content">
                <span className="empty-state-icon">📂</span>
                <h2>No Document Selected</h2>
                <p>Upload a PDF document to get started</p>
              </div>
            </div>
          )}
        </main>

        {/* Right sidebar - Chat panel */}
        {showChat && (
          <aside className="sidebar sidebar-right">
            <ChatPanel />
          </aside>
        )}
      </div>
    </div>
  );
}
