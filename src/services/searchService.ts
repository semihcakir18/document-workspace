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
  console.log(`\n🔍 Searching ${chunks.length} chunks for query: "${query}"`);

  // Score all chunks
  const scored = chunks.map(chunk => ({
    chunk,
    score: calculateKeywordScore(query, chunk.text),
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Log detailed scoring information
  console.log('\n📊 Top 10 chunk scores:');
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

  console.log(`\n✅ Selected ${topChunks.length} chunks with scores:`,
    topChunks.map(item => ({
      score: item.score,
      page: item.chunk.pageNumber,
      chunkId: item.chunk.id
    }))
  );

  return topChunks.map(item => item.chunk);
}
