/**
 * Embedding service for generating and caching vector embeddings
 * Uses OpenAI's text-embedding-3-small model for efficient, high-quality embeddings
 */

import { decryptAPIKey } from '../utils/encryption';
import { getEmbedding, saveEmbedding } from './db';
import type { DocumentChunk, EmbeddingCache } from '../types/index';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSION = 1536; // Dimension of text-embedding-3-small
const BATCH_SIZE = 100; // Process embeddings in batches to avoid rate limits

/**
 * Get API key from localStorage
 */
async function getAPIKey(): Promise<string> {
  const storedConfig = localStorage.getItem('encryptedAPIKey');
  if (!storedConfig) {
    throw new Error('No API key configured');
  }

  const config = JSON.parse(storedConfig);
  return await decryptAPIKey(config.encrypted, config.salt, config.iv);
}

/**
 * Generate embedding for a single text using OpenAI API
 */
async function generateEmbeddingFromAPI(text: string, apiKey: string): Promise<number[]> {
  console.log(`📊 Generating embedding for text (${text.length} chars)...`);

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
      encoding_format: 'float',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI embedding API failed: ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  const embedding = data.data[0].embedding as number[];

  console.log(`✅ Generated embedding with ${embedding.length} dimensions`);
  return embedding;
}

/**
 * Generate embeddings for multiple texts in batch
 */
async function generateEmbeddingBatch(texts: string[], apiKey: string): Promise<number[][]> {
  console.log(`📊 Generating batch of ${texts.length} embeddings...`);

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
      encoding_format: 'float',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI embedding API failed: ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  const embeddings = data.data
    .sort((a: any, b: any) => a.index - b.index)
    .map((item: any) => item.embedding as number[]);

  console.log(`✅ Generated ${embeddings.length} embeddings`);
  return embeddings;
}

/**
 * Get or generate embedding for a chunk (lazy loading with cache)
 */
export async function getChunkEmbedding(chunk: DocumentChunk): Promise<number[]> {
  // Try to get from cache first
  const cached = await getEmbedding(chunk.id);

  if (cached && cached.embedding) {
    console.log(`💾 Using cached embedding for chunk ${chunk.id.slice(0, 8)}...`);
    return cached.embedding;
  }

  // Generate new embedding
  console.log(`🔨 Generating new embedding for chunk ${chunk.id.slice(0, 8)}...`);
  const apiKey = await getAPIKey();
  const embedding = await generateEmbeddingFromAPI(chunk.text, apiKey);

  // Cache it
  const cache: EmbeddingCache = {
    chunkId: chunk.id,
    embedding,
    model: EMBEDDING_MODEL,
    cachedAt: new Date(),
  };
  await saveEmbedding(cache);

  return embedding;
}

/**
 * Get or generate embeddings for multiple chunks in batch
 * Efficiently handles caching and only generates missing embeddings
 */
export async function getChunkEmbeddingsBatch(chunks: DocumentChunk[]): Promise<Map<string, number[]>> {
  console.log(`\n🔍 Processing embeddings for ${chunks.length} chunks...`);

  const result = new Map<string, number[]>();
  const chunksNeedingEmbedding: DocumentChunk[] = [];

  // Check cache for all chunks
  for (const chunk of chunks) {
    const cached = await getEmbedding(chunk.id);
    if (cached && cached.embedding) {
      result.set(chunk.id, cached.embedding);
    } else {
      chunksNeedingEmbedding.push(chunk);
    }
  }

  console.log(`💾 Found ${result.size} cached embeddings`);
  console.log(`🔨 Need to generate ${chunksNeedingEmbedding.length} new embeddings`);

  if (chunksNeedingEmbedding.length === 0) {
    return result;
  }

  // Generate missing embeddings in batches
  const apiKey = await getAPIKey();

  for (let i = 0; i < chunksNeedingEmbedding.length; i += BATCH_SIZE) {
    const batch = chunksNeedingEmbedding.slice(i, i + BATCH_SIZE);
    const texts = batch.map(c => c.text);

    console.log(`📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunksNeedingEmbedding.length / BATCH_SIZE)}`);

    const embeddings = await generateEmbeddingBatch(texts, apiKey);

    // Cache all new embeddings
    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j];
      const embedding = embeddings[j];

      result.set(chunk.id, embedding);

      const cache: EmbeddingCache = {
        chunkId: chunk.id,
        embedding,
        model: EMBEDDING_MODEL,
        cachedAt: new Date(),
      };
      await saveEmbedding(cache);
    }

    // Small delay to avoid rate limits
    if (i + BATCH_SIZE < chunksNeedingEmbedding.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  console.log(`✅ All embeddings ready (${result.size} total)\n`);
  return result;
}

/**
 * Generate embedding for a query string
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  console.log(`🔍 Generating embedding for query: "${query}"`);
  const apiKey = await getAPIKey();
  return await generateEmbeddingFromAPI(query, apiKey);
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return similarity;
}
