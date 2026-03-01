/**
 * AI Chat panel component
 * Handles chat interface and AI interactions (Group-specific)
 */

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useStore } from '../../store/useStore';
import { getMessagesByGroup, saveMessage, getDocumentsByGroup } from '../../services/db';
import { getChunksByDocument } from '../../services/db';
import { streamChatWithContext } from '../../services/aiService';
import { findRelevantChunks } from '../../services/searchService';
import Citations from '../../components/Citations';
import './ChatPanel.css';
import type { ChatMessage, DocumentChunk } from '../../types/index';

export default function ChatPanel() {
  const { selectedGroup, hasAPIKey } = useStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [messageChunks, setMessageChunks] = useState<Map<string, DocumentChunk[]>>(new Map());
  const [allChunks, setAllChunks] = useState<DocumentChunk[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedGroup) {
      loadMessages();
    } else {
      setMessages([]);
    }
  }, [selectedGroup]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    if (!selectedGroup) return;

    // Load messages for this group
    const msgs = await getMessagesByGroup(selectedGroup.id);
    setMessages(msgs);

    // Load all chunks from all documents in this group
    const groupDocs = await getDocumentsByGroup(selectedGroup.id);
    const allChunksPromises = groupDocs.map(doc => getChunksByDocument(doc.id));
    const chunksArrays = await Promise.all(allChunksPromises);
    const groupChunks = chunksArrays.flat();

    setAllChunks(groupChunks);

    const chunksMap = new Map<string, DocumentChunk[]>();
    for (const msg of msgs) {
      if (msg.role === 'assistant' && msg.chunkIds) {
        const msgChunks = groupChunks.filter(c => msg.chunkIds?.includes(c.id));
        chunksMap.set(msg.id, msgChunks);
      }
    }
    setMessageChunks(chunksMap);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedGroup || !hasAPIKey) return;

    const userQuestion = input.trim();
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      groupId: selectedGroup.id,
      role: 'user',
      content: userQuestion,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    await saveMessage(userMessage);
    setInput('');
    setIsStreaming(true);

    try {
      // Load all chunks from documents in this group
      console.log(`🔎 Loading chunks from group: "${selectedGroup.name}"`);
      const groupDocs = await getDocumentsByGroup(selectedGroup.id);
      console.log(`📚 Found ${groupDocs.length} documents in group`);

      const allChunksPromises = groupDocs.map(doc => getChunksByDocument(doc.id));
      const chunksArrays = await Promise.all(allChunksPromises);
      const groupChunks = chunksArrays.flat();

      console.log(`📄 Loaded ${groupChunks.length} total chunks from group`);
      setAllChunks(groupChunks);

      // Find relevant chunks using vector similarity search within this group
      const relevantChunks = await findRelevantChunks(userQuestion, groupChunks, 5);

      console.log(`\n✨ Found ${relevantChunks.length} relevant chunks for query within group`);

      // Create placeholder message for streaming
      const assistantId = crypto.randomUUID();
      let streamedContent = '';

      // Add empty assistant message that will be updated
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          groupId: selectedGroup.id,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        },
      ]);

      // Get conversation history (last 5 messages)
      const history = messages.slice(-5).map(m => ({
        role: m.role,
        content: m.content
      }));

      // Stream the response
      await streamChatWithContext(
        userQuestion,
        relevantChunks,
        history,
        {
          onToken: (token) => {
            streamedContent += token;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId ? { ...msg, content: streamedContent } : msg
              )
            );
          },
          onComplete: async (fullText) => {
            const finalMessage: ChatMessage = {
              id: assistantId,
              groupId: selectedGroup.id,
              role: 'assistant',
              content: fullText,
              timestamp: new Date(),
              chunkIds: relevantChunks.map(c => c.id),
            };
            await saveMessage(finalMessage);

            // Store chunks for this message
            setMessageChunks(prev => new Map(prev).set(assistantId, relevantChunks));

            setIsStreaming(false);
          },
          onError: (error) => {
            console.error('Streaming error:', error);
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? { ...msg, content: `Error: ${error.message}` }
                  : msg
              )
            );
            setIsStreaming(false);
          },
        }
      );
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        groupId: selectedGroup.id,
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsStreaming(false);
    }
  };

  if (!selectedGroup) {
    return (
      <div className="chat-panel">
        <div className="chat-empty">
          <span className="chat-empty-icon">💬</span>
          <p>Select a group to start chatting</p>
          <p className="text-muted">AI will search within the selected group</p>
        </div>
      </div>
    );
  }

  if (!hasAPIKey) {
    return (
      <div className="chat-panel">
        <div className="chat-empty">
          <span className="chat-empty-icon">🔑</span>
          <p>API key required</p>
          <p className="text-muted">Add your OpenAI API key in settings</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <h3>💬 {selectedGroup.name}</h3>
        <span className="chat-status">
          {isStreaming ? '⏳ Thinking...' : '✓ Ready'}
        </span>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-welcome">
            <p>Ask questions about "{selectedGroup.name}"</p>
            <p className="text-muted">I'll search across all documents in this group to provide accurate answers.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const chunks = messageChunks.get(msg.id) || [];
            return (
              <div key={msg.id} className={`message message-${msg.role}`}>
                <div className="message-header">
                  <span className="message-role">
                    {msg.role === 'user' ? '👤' : '🤖'}
                  </span>
                  <span className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="message-content">
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </div>
                {msg.role === 'assistant' && chunks.length > 0 && (
                  <Citations chunks={chunks} />
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="chat-input"
          placeholder="Ask a question about this group..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isStreaming}
        />
        <button type="submit" className="send-button" disabled={!input.trim() || isStreaming}>
          {isStreaming ? '⏳' : '➤'}
        </button>
      </form>
    </div>
  );
}
