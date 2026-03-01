/**
 * Main 3-column layout component
 * Left: Document list
 * Center: Document viewer
 * Right: AI chat panel
 */

import { useState } from 'react';
import { FileText, PanelLeftClose, PanelLeftOpen, MessageSquare, Settings as SettingsIcon, FolderOpen, X } from 'lucide-react';
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
          <button onClick={() => setError(null)}>
            <X className="icon" />
          </button>
        </div>
      )}

      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo">
            {/* <FileText className="logo-icon" /> */}
            <h1>Document Workspace</h1>
          </div>
          <div className="header-actions">
            <button
              className="icon-button"
              onClick={useStore.getState().toggleDocumentList}
              title="Toggle document list"
              aria-label="Toggle document list"
            >
              {showDocumentList ? (
                <PanelLeftClose className="icon" />
              ) : (
                <PanelLeftOpen className="icon" />
              )}
            </button>
            <button
              className="icon-button"
              onClick={useStore.getState().toggleChat}
              title="Toggle chat panel"
              aria-label="Toggle chat panel"
            >
              <MessageSquare className="icon" />
            </button>
            <button
              className="icon-button"
              onClick={() => setShowSettings(true)}
              title="Settings"
              aria-label="Settings"
            >
              <SettingsIcon className="icon" />
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
                <FolderOpen className="empty-state-icon" />
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
