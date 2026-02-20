/**
 * IndexedDB service for storing documents, chunks, embeddings, and annotations
 */

import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import type { Document, DocumentChunk, ChatMessage, Annotation, EmbeddingCache } from '../types/index';

// Define database schema without DBSchema interface (idb v8 compatibility)
interface AIDocumentDB {
  documents: {
    key: string;
    value: Document;
    indexes: { 'by-date': Date };
  };
  chunks: {
    key: string;
    value: DocumentChunk;
    indexes: { 'by-document': string };
  };
  messages: {
    key: string;
    value: ChatMessage;
    indexes: { 'by-document': string; 'by-timestamp': Date };
  };
  annotations: {
    key: string;
    value: Annotation;
    indexes: { 'by-document': string };
  };
  embeddings: {
    key: string;
    value: EmbeddingCache;
    indexes: { 'by-cached-at': Date };
  };
}

const DB_NAME = 'ai-document-workspace';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<AIDocumentDB> | null = null;

/**
 * Initialize and get database instance
 */
export async function getDB(): Promise<IDBPDatabase<AIDocumentDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<AIDocumentDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Documents store
      if (!db.objectStoreNames.contains('documents')) {
        const documentStore = db.createObjectStore('documents', { keyPath: 'id' });
        documentStore.createIndex('by-date', 'uploadedAt');
      }

      // Chunks store
      if (!db.objectStoreNames.contains('chunks')) {
        const chunkStore = db.createObjectStore('chunks', { keyPath: 'id' });
        chunkStore.createIndex('by-document', 'documentId');
      }

      // Messages store
      if (!db.objectStoreNames.contains('messages')) {
        const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
        messageStore.createIndex('by-document', 'documentId');
        messageStore.createIndex('by-timestamp', 'timestamp');
      }

      // Annotations store
      if (!db.objectStoreNames.contains('annotations')) {
        const annotationStore = db.createObjectStore('annotations', { keyPath: 'id' });
        annotationStore.createIndex('by-document', 'documentId');
      }

      // Embeddings cache store
      if (!db.objectStoreNames.contains('embeddings')) {
        const embeddingStore = db.createObjectStore('embeddings', { keyPath: 'chunkId' });
        embeddingStore.createIndex('by-cached-at', 'cachedAt');
      }
    },
  });

  return dbInstance;
}

// Document operations
export async function saveDocument(document: Document): Promise<void> {
  const db = await getDB();
  await db.put('documents', document);
}

export async function getDocument(id: string): Promise<Document | undefined> {
  const db = await getDB();
  return db.get('documents', id);
}

export async function getAllDocuments(): Promise<Document[]> {
  const db = await getDB();
  return db.getAll('documents');
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['documents', 'chunks', 'messages', 'annotations'], 'readwrite');

  await Promise.all([
    tx.objectStore('documents').delete(id),
    // Delete all related chunks
    (async () => {
      const chunks = await tx.objectStore('chunks').index('by-document').getAllKeys(id);
      await Promise.all(chunks.map(key => tx.objectStore('chunks').delete(key)));
    })(),
    // Delete all related messages
    (async () => {
      const messages = await tx.objectStore('messages').index('by-document').getAllKeys(id);
      await Promise.all(messages.map(key => tx.objectStore('messages').delete(key)));
    })(),
    // Delete all related annotations
    (async () => {
      const annotations = await tx.objectStore('annotations').index('by-document').getAllKeys(id);
      await Promise.all(annotations.map(key => tx.objectStore('annotations').delete(key)));
    })(),
  ]);

  await tx.done;
}

// Chunk operations
export async function saveChunk(chunk: DocumentChunk): Promise<void> {
  const db = await getDB();
  await db.put('chunks', chunk);
}

export async function saveChunks(chunks: DocumentChunk[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('chunks', 'readwrite');
  await Promise.all(chunks.map(chunk => tx.store.put(chunk)));
  await tx.done;
}

export async function getChunksByDocument(documentId: string): Promise<DocumentChunk[]> {
  const db = await getDB();
  return db.getAllFromIndex('chunks', 'by-document', documentId);
}

// Message operations
export async function saveMessage(message: ChatMessage): Promise<void> {
  const db = await getDB();
  await db.put('messages', message);
}

export async function getMessagesByDocument(documentId: string): Promise<ChatMessage[]> {
  const db = await getDB();
  return db.getAllFromIndex('messages', 'by-document', documentId);
}

// Annotation operations
export async function saveAnnotation(annotation: Annotation): Promise<void> {
  const db = await getDB();
  await db.put('annotations', annotation);
}

export async function getAnnotationsByDocument(documentId: string): Promise<Annotation[]> {
  const db = await getDB();
  return db.getAllFromIndex('annotations', 'by-document', documentId);
}

export async function deleteAnnotation(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('annotations', id);
}

// Embedding cache operations
export async function saveEmbedding(cache: EmbeddingCache): Promise<void> {
  const db = await getDB();
  await db.put('embeddings', cache);
}

export async function getEmbedding(chunkId: string): Promise<EmbeddingCache | undefined> {
  const db = await getDB();
  return db.get('embeddings', chunkId);
}

export async function clearOldEmbeddings(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
  const db = await getDB();
  const cutoffDate = new Date(Date.now() - maxAge);
  const tx = db.transaction('embeddings', 'readwrite');
  const index = tx.store.index('by-cached-at');

  let cursor = await index.openCursor(IDBKeyRange.upperBound(cutoffDate));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }

  await tx.done;
}

// Clear all data
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['documents', 'chunks', 'messages', 'annotations', 'embeddings'], 'readwrite');

  await Promise.all([
    tx.objectStore('documents').clear(),
    tx.objectStore('chunks').clear(),
    tx.objectStore('messages').clear(),
    tx.objectStore('annotations').clear(),
    tx.objectStore('embeddings').clear(),
  ]);

  await tx.done;
}
