/**
 * Simple keyword-based search for finding relevant chunks
 * This is a placeholder for the lazy embedding system that will be implemented later
 */

import type { DocumentChunk } from '../types/index';

/**
 * Simple keyword matching score
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
 * Find relevant chunks using simple keyword matching
 * Later this will be replaced with vector similarity search
 */
export function findRelevantChunks(
  query: string,
  chunks: DocumentChunk[],
  topK: number = 5
): DocumentChunk[] {
  // Score all chunks
  const scored = chunks.map(chunk => ({
    chunk,
    score: calculateKeywordScore(query, chunk.text),
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Return top K chunks that have non-zero scores
  return scored
    .filter(item => item.score > 0)
    .slice(0, topK)
    .map(item => item.chunk);
}
