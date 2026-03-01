/**
 * Main 3-column layout component
 * Left: Document list
 * Center: Document viewer
 * Right: AI chat panel
 */

import { useState } from 'react';
import { useStore } from '../store/useStore';
import GroupList from '../features/documents/GroupList';
import DocumentViewer from '../features/documents/DocumentViewer';
import RightSidebar from '../components/RightSidebar';
import Settings from './Settings';
import '../styles/Layout.css';

export default function Layout() {
  const { showDocumentList, showChat, selectedDocument, error, setError } = useStore();
  const [showSettings, setShowSettings] = useState(false);

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
            <button
              className="icon-button"
              onClick={() => setShowSettings(true)}
              title="Settings"
            >
              ⚙️
            </button>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <div className="main-content">
        {/* Left sidebar - Group list */}
        {showDocumentList && (
          <aside className="sidebar sidebar-left">
            <GroupList />
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

        {/* Right sidebar - Chat & Annotations */}
        {showChat && (
          <aside className="sidebar sidebar-right">
            <RightSidebar />
          </aside>
        )}
      </div>

      {/* Settings modal */}
      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
