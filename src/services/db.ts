/**
 * IndexedDB service for storing documents, chunks, embeddings, and annotations
 */

import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import type { Document, DocumentChunk, ChatMessage, Annotation, EmbeddingCache, Group } from '../types/index';

// Define database schema without DBSchema interface (idb v8 compatibility)
interface AIDocumentDB {
  groups: {
    key: string;
    value: Group;
    indexes: { 'by-date': Date };
  };
  documents: {
    key: string;
    value: Document;
    indexes: { 'by-date': Date; 'by-group': string | null };
  };
  chunks: {
    key: string;
    value: DocumentChunk;
    indexes: { 'by-document': string };
  };
  messages: {
    key: string;
    value: ChatMessage;
    indexes: { 'by-group': string; 'by-timestamp': Date };
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
const DB_VERSION = 2;

let dbInstance: IDBPDatabase<AIDocumentDB> | null = null;

/**
 * Initialize and get database instance
 */
export async function getDB(): Promise<IDBPDatabase<AIDocumentDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<AIDocumentDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // Groups store (v2)
      if (!db.objectStoreNames.contains('groups')) {
        const groupStore = db.createObjectStore('groups', { keyPath: 'id' });
        groupStore.createIndex('by-date', 'createdAt');
      }

      // Documents store
      if (!db.objectStoreNames.contains('documents')) {
        const documentStore = db.createObjectStore('documents', { keyPath: 'id' });
        documentStore.createIndex('by-date', 'uploadedAt');
        documentStore.createIndex('by-group', 'groupId');
      } else if (oldVersion < 2) {
        // Add groupId index for existing documents store
        const documentStore = transaction.objectStore('documents');
        if (!documentStore.indexNames.contains('by-group')) {
          documentStore.createIndex('by-group', 'groupId');
        }
      }

      // Chunks store
      if (!db.objectStoreNames.contains('chunks')) {
        const chunkStore = db.createObjectStore('chunks', { keyPath: 'id' });
        chunkStore.createIndex('by-document', 'documentId');
      }

      // Messages store
      if (!db.objectStoreNames.contains('messages')) {
        const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
        messageStore.createIndex('by-group', 'groupId');
        messageStore.createIndex('by-timestamp', 'timestamp');
      } else if (oldVersion < 2) {
        // Recreate messages store with new index
        db.deleteObjectStore('messages');
        const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
        messageStore.createIndex('by-group', 'groupId');
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
  const doc = await db.get('documents', id);
  if (doc) {
    console.log('Retrieved document from DB:', doc.name);
    console.log('  fileData type:', doc.fileData?.constructor.name);
    console.log('  fileData byteLength:', doc.fileData?.byteLength);
  }
  return doc;
}

export async function getAllDocuments(): Promise<Document[]> {
  const db = await getDB();
  return db.getAll('documents');
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await getDB();

  // Remove document from group if it belongs to one
  const doc = await db.get('documents', id);
  if (doc && doc.groupId) {
    const group = await db.get('groups', doc.groupId);
    if (group) {
      group.documentIds = group.documentIds.filter((docId: string) => docId !== id);
      await db.put('groups', group);
    }
  }

  const tx = db.transaction(['documents', 'chunks', 'annotations'], 'readwrite');

  await Promise.all([
    tx.objectStore('documents').delete(id),
    // Delete all related chunks
    (async () => {
      const chunks = await tx.objectStore('chunks').index('by-document').getAllKeys(id);
      await Promise.all(chunks.map(key => tx.objectStore('chunks').delete(key)));
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

export async function clearOldEmbeddings(maxCount: number = 1000): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('embeddings', 'readwrite');
  const index = tx.store.index('by-cached-at');

  // Get all embeddings sorted by date (oldest first)
  const allEmbeddings = await index.getAll();

  // If we have more than maxCount, delete the oldest ones
  if (allEmbeddings.length > maxCount) {
    const toDelete = allEmbeddings.length - maxCount;
    let cursor = await index.openCursor();
    let deleted = 0;

    while (cursor && deleted < toDelete) {
      await cursor.delete();
      deleted++;
      cursor = await cursor.continue();
    }
  }

  await tx.done;
}

// Group operations
export async function saveGroup(group: Group): Promise<void> {
  const db = await getDB();
  await db.put('groups', group);
}

export async function getGroup(id: string): Promise<Group | undefined> {
  const db = await getDB();
  return db.get('groups', id);
}

export async function getAllGroups(): Promise<Group[]> {
  const db = await getDB();
  const groups = await db.getAll('groups');
  return groups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function deleteGroup(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['groups', 'documents', 'messages'], 'readwrite');

  // Remove group
  await tx.objectStore('groups').delete(id);

  // Unassign documents from this group
  const documents = await tx.objectStore('documents').index('by-group').getAll(id);
  for (const doc of documents) {
    doc.groupId = null;
    await tx.objectStore('documents').put(doc);
  }

  // Delete all messages for this group
  const messages = await tx.objectStore('messages').index('by-group').getAllKeys(id);
  await Promise.all(messages.map(key => tx.objectStore('messages').delete(key)));

  await tx.done;
}

export async function addDocumentToGroup(documentId: string, groupId: string): Promise<void> {
  const db = await getDB();
  const doc = await db.get('documents', documentId);
  if (doc) {
    doc.groupId = groupId;
    await db.put('documents', doc);

    // Update group's documentIds
    const group = await db.get('groups', groupId);
    if (group && !group.documentIds.includes(documentId)) {
      group.documentIds.push(documentId);
      await db.put('groups', group);
    }
  }
}

export async function removeDocumentFromGroup(documentId: string): Promise<void> {
  const db = await getDB();
  const doc = await db.get('documents', documentId);
  if (doc && doc.groupId) {
    const groupId = doc.groupId;
    doc.groupId = null;
    await db.put('documents', doc);

    // Update group's documentIds
    const group = await db.get('groups', groupId);
    if (group) {
      group.documentIds = group.documentIds.filter((id: string) => id !== documentId);
      await db.put('groups', group);
    }
  }
}

export async function getDocumentsByGroup(groupId: string): Promise<Document[]> {
  const db = await getDB();
  return db.getAllFromIndex('documents', 'by-group', groupId);
}

export async function getMessagesByGroup(groupId: string): Promise<ChatMessage[]> {
  const db = await getDB();
  return db.getAllFromIndex('messages', 'by-group', groupId);
}

// Clear all data
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['groups', 'documents', 'chunks', 'messages', 'annotations', 'embeddings'], 'readwrite');

  await Promise.all([
    tx.objectStore('groups').clear(),
    tx.objectStore('documents').clear(),
    tx.objectStore('chunks').clear(),
    tx.objectStore('messages').clear(),
    tx.objectStore('annotations').clear(),
    tx.objectStore('embeddings').clear(),
  ]);

  await tx.done;
}
