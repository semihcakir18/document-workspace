/**
 * Right sidebar with tabs for Chat and Annotations
 */
import './RightSidebar.css';

import { useState } from 'react';
import { MessageSquare, StickyNote } from 'lucide-react';
import { motion } from 'framer-motion';
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
          <MessageSquare className="tab-icon" />
          <span>Chat</span>
          {activeTab === 'chat' && (
            <motion.div
              layoutId="activeTab"
              className="tab-indicator"
            />
          )}
        </button>
        <button
          className={`sidebar-tab ${activeTab === 'annotations' ? 'active' : ''}`}
          onClick={() => setActiveTab('annotations')}
        >
          <StickyNote className="tab-icon" />
          <span>Annotations</span>
          {activeTab === 'annotations' && (
            <motion.div
              layoutId="activeTab"
              className="tab-indicator"
            />
          )}
        </button>
      </div>

      <div className="sidebar-content">
        {activeTab === 'chat' ? <ChatPanel /> : <AnnotationPanel />}
      </div>
    </div>
  );
}
