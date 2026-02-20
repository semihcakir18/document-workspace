/**
 * Right sidebar with tabs for Chat and Annotations
 */
import './RightSidebar.css';

import { useState } from 'react';
import ChatPanel from '../features/ai/ChatPanel';
import AnnotationPanel from './AnnotationPanel';

export default function RightSidebar() {
  const [activeTab, setActiveTab] = useState<'chat' | 'annotations'>('chat');

  return (
    <div className="right-sidebar">
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          💬 Chat
        </button>
        <button
          className={`sidebar-tab ${activeTab === 'annotations' ? 'active' : ''}`}
          onClick={() => setActiveTab('annotations')}
        >
          📝 Annotations
        </button>
      </div>

      <div className="sidebar-content">
        {activeTab === 'chat' ? <ChatPanel /> : <AnnotationPanel />}
      </div>
    </div>
  );
}
