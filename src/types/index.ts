// Core types for the AI Document Workspace

export interface Group {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
  documentIds: string[];
}

export interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
  lastModified: Date;
  pageCount?: number;
  groupId?: string | null;
  fileData?: ArrayBuffer; // Original PDF file data for preview
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  pageNumber: number;
  text: string;
  startIndex: number;
  endIndex: number;
  embedding?: number[];
  lastEmbeddedAt?: Date;
}

export interface ChatMessage {
  id: string;
  groupId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  chunkIds?: string[];
}

export interface Annotation {
  id: string;
  documentId: string;
  type: 'highlight' | 'note' | 'tag';
  pageNumber: number;
  text: string;
  note?: string;
  tags?: string[];
  color?: string;
  createdAt: Date;
}

export interface APIKeyConfig {
  encryptedKey: string;
  iv: string;
  provider: 'openai' | 'anthropic';
}

export interface AppSettings {
  maxFileSize: number;
  embeddingCacheSize: number;
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  theme: 'light' | 'dark' | 'system';
}

export interface EmbeddingCache {
  chunkId: string;
  embedding: number[];
  cachedAt: Date;
}

export interface SearchResult {
  chunk: DocumentChunk;
  similarity: number;
}
