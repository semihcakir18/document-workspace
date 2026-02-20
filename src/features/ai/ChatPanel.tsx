/**
 * AI Chat panel component
 * Handles chat interface and AI interactions
 */

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useStore } from '../../store/useStore';
import { getMessagesByDocument, saveMessage, getAllDocuments } from '../../services/db';
import { getChunksByDocument } from '../../services/db';
import { streamChatWithContext } from '../../services/aiService';
import { findRelevantChunks } from '../../services/searchService';
import Citations from '../../components/Citations';
import './ChatPanel.css';
import type { ChatMessage, DocumentChunk } from '../../types/index';

export default function ChatPanel() {
  const { selectedDocument, hasAPIKey } = useStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [messageChunks, setMessageChunks] = useState<Map<string, DocumentChunk[]>>(new Map());
  const [allChunks, setAllChunks] = useState<DocumentChunk[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedDocument) {
      loadMessages();
    } else {
      setMessages([]);
    }
  }, [selectedDocument]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    if (!selectedDocument) return;
    const msgs = await getMessagesByDocument(selectedDocument.id);
    setMessages(msgs);

    // Load all chunks and build message-chunk map
    const docChunks = await getChunksByDocument(selectedDocument.id);
    setAllChunks(docChunks);

    const chunksMap = new Map<string, DocumentChunk[]>();
    for (const msg of msgs) {
      if (msg.role === 'assistant' && msg.chunkIds) {
        const msgChunks = docChunks.filter(c => msg.chunkIds?.includes(c.id));
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
    if (!input.trim() || !selectedDocument || !hasAPIKey) return;

    const userQuestion = input.trim();
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      documentId: selectedDocument.id,
      role: 'user',
      content: userQuestion,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    await saveMessage(userMessage);
    setInput('');
    setIsStreaming(true);

    try {
      // Get all documents and their chunks
      console.log('🔎 Loading chunks from ALL documents for search...');
      const allDocuments = await getAllDocuments();
      console.log(`📚 Found ${allDocuments.length} total documents`);

      // Load chunks from all documents
      const allChunksPromises = allDocuments.map(doc => getChunksByDocument(doc.id));
      const chunksArrays = await Promise.all(allChunksPromises);
      const allDocChunks = chunksArrays.flat();

      console.log(`📄 Loaded ${allDocChunks.length} total chunks across all documents`);
      setAllChunks(allDocChunks);

      // Find relevant chunks using vector similarity search across ALL documents
      const relevantChunks = await findRelevantChunks(userQuestion, allDocChunks, 5);

      console.log(`\n✨ Found ${relevantChunks.length} relevant chunks for query across all documents`);

      // Create placeholder message for streaming
      const assistantId = crypto.randomUUID();
      let streamedContent = '';

      // Add empty assistant message that will be updated
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          documentId: selectedDocument.id,
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
              documentId: selectedDocument.id,
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
        documentId: selectedDocument.id,
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsStreaming(false);
    }
  };

  if (!selectedDocument) {
    return (
      <div className="chat-panel">
        <div className="chat-empty">
          <span className="chat-empty-icon">💬</span>
          <p>Select a document to start chatting</p>
          <p className="text-muted">AI will search across all your documents</p>
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
        <h3>AI Assistant</h3>
        <span className="chat-status">
          {isStreaming ? '⏳ Thinking...' : '✓ Ready'}
        </span>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-welcome">
            <p>Ask questions about your documents</p>
            <p className="text-muted">I'll search across all your documents to provide accurate answers.</p>
            <p className="text-muted">Conversation history is saved to: {selectedDocument.name}</p>
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
          placeholder="Ask a question about the document..."
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
