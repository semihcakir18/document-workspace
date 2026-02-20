/**
 * Search service with lazy embedding generation and vector similarity
 * Uses OpenAI embeddings for semantic search with keyword fallback
 */

import type { DocumentChunk } from '../types/index';
import { generateQueryEmbedding, getChunkEmbeddingsBatch, cosineSimilarity } from './embeddingService';

/**
 * Simple keyword matching score (fallback method)
 */
function calculateKeywordScore(query: string, text: string): number {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const textLower = text.toLowerCase();

  let score = 0;

  for (const word of queryWords) {
    // Count occurrences of each query word
    const regex = new RegExp(word, 'gi');
    const matches = textLower.match(regex);
    if (matches) {
      score += matches.length * 2; // Weight for exact matches
    }

    // Check if word appears as substring
    if (textLower.includes(word)) {
      score += 1;
    }
  }

  return score;
}

/**
 * Find relevant chunks using keyword matching (fallback)
 */
export function findRelevantChunksKeyword(
  query: string,
  chunks: DocumentChunk[],
  topK: number = 5
): DocumentChunk[] {
  console.log(`\n🔍 Using keyword search for ${chunks.length} chunks...`);

  // Score all chunks
  const scored = chunks.map(chunk => ({
    chunk,
    score: calculateKeywordScore(query, chunk.text),
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Log detailed scoring information
  console.log('\n📊 Top 10 keyword scores:');
  scored.slice(0, 10).forEach((item, idx) => {
    console.log(
      `  ${idx + 1}. Score: ${item.score} | Page: ${item.chunk.pageNumber} | ` +
      `Text preview: "${item.chunk.text.slice(0, 80)}..."`
    );
  });

  // Return top K chunks that have non-zero scores
  const topChunks = scored
    .filter(item => item.score > 0)
    .slice(0, topK);

  console.log(`\n✅ Selected ${topChunks.length} chunks (keyword search)`);

  return topChunks.map(item => item.chunk);
}

/**
 * Find relevant chunks using vector similarity search (primary method)
 * Uses lazy embedding generation with caching for efficiency
 */
export async function findRelevantChunksVector(
  query: string,
  chunks: DocumentChunk[],
  topK: number = 5
): Promise<DocumentChunk[]> {
  console.log(`\n🔍 Using vector similarity search for ${chunks.length} chunks...`);
  console.log(`📝 Query: "${query}"\n`);

  try {
    // Generate query embedding
    const queryEmbedding = await generateQueryEmbedding(query);

    // Get or generate embeddings for all chunks (lazy with caching)
    const chunkEmbeddings = await getChunkEmbeddingsBatch(chunks);

    // Calculate similarity scores
    const scored = chunks.map(chunk => {
      const chunkEmbedding = chunkEmbeddings.get(chunk.id);
      if (!chunkEmbedding) {
        console.warn(`⚠️ No embedding found for chunk ${chunk.id}`);
        return { chunk, similarity: 0 };
      }

      const similarity = cosineSimilarity(queryEmbedding, chunkEmbedding);
      return { chunk, similarity };
    });

    // Sort by similarity descending
    scored.sort((a, b) => b.similarity - a.similarity);

    // Log detailed scoring information
    console.log('\n📊 Top 10 similarity scores:');
    scored.slice(0, 10).forEach((item, idx) => {
      console.log(
        `  ${idx + 1}. Similarity: ${item.similarity.toFixed(4)} | Page: ${item.chunk.pageNumber} | ` +
        `Text preview: "${item.chunk.text.slice(0, 80)}..."`
      );
    });

    // Return top K chunks
    const topChunks = scored.slice(0, topK);

    console.log(`\n✅ Selected ${topChunks.length} chunks with similarities:`,
      topChunks.map(item => ({
        similarity: item.similarity.toFixed(4),
        page: item.chunk.pageNumber,
        chunkId: item.chunk.id.slice(0, 8)
      }))
    );

    return topChunks.map(item => item.chunk);

  } catch (error) {
    console.error('❌ Vector search failed:', error);
    console.log('⚠️ Falling back to keyword search...\n');

    // Fallback to keyword search
    return findRelevantChunksKeyword(query, chunks, topK);
  }
}

/**
 * Main search function - uses vector similarity with keyword fallback
 * This is the function that should be called from the UI
 */
export async function findRelevantChunks(
  query: string,
  chunks: DocumentChunk[],
  topK: number = 5,
  useEmbeddings: boolean = true
): Promise<DocumentChunk[]> {
  if (!useEmbeddings) {
    return findRelevantChunksKeyword(query, chunks, topK);
  }

  return await findRelevantChunksVector(query, chunks, topK);
}
