/**
 * PDF parsing service using PDF.js
 */

import * as pdfjsLib from 'pdfjs-dist';
import type { Document, DocumentChunk } from '../types/index';

// Configure PDF.js worker - use local worker file from node_modules
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

/**
 * Extract text from a PDF file
 */
export async function parsePDF(file: File): Promise<{ document: Document; chunks: DocumentChunk[] }> {
  const arrayBuffer = await file.arrayBuffer();

  // Create a copy of the ArrayBuffer for storage (PDF.js will detach the original)
  const storedBuffer = arrayBuffer.slice(0);

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const documentId = crypto.randomUUID();
  const pageTexts: { pageNumber: number; text: string }[] = [];

  // Extract text from each page
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // Group text items by lines based on Y position
    const lines: any[][] = [];
    const items = textContent.items as any[];

    for (const item of items) {
      if (!item.str || !item.str.trim()) continue;

      const y = item.transform[5];
      const height = item.height || 10;

      // Find existing line with similar Y position
      let foundLine = false;
      for (const line of lines) {
        const lineY = line[0].transform[5];
        if (Math.abs(y - lineY) < height * 0.3) {
          line.push(item);
          foundLine = true;
          break;
        }
      }

      if (!foundLine) {
        lines.push([item]);
      }
    }

    // Sort lines from top to bottom
    lines.sort((a, b) => b[0].transform[5] - a[0].transform[5]);

    // Sort items within each line from left to right
    for (const line of lines) {
      line.sort((a, b) => a.transform[4] - b.transform[4]);
    }

    // Build text
    let pageText = '';
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      let lineText = '';

      for (let itemIdx = 0; itemIdx < line.length; itemIdx++) {
        const item = line[itemIdx];
        const str = item.str;

        // Add the text
        lineText += str;

        // Add space if there's a gap before the next item
        if (itemIdx < line.length - 1) {
          const nextItem = line[itemIdx + 1];
          const gap = nextItem.transform[4] - (item.transform[4] + (item.width || 0));

          // If gap is larger than a typical space, add a space
          if (gap > 1) {
            lineText += ' ';
          }
        }
      }

      pageText += lineText.trim();

      // Add newline between lines
      if (lineIdx < lines.length - 1) {
        pageText += '\n';
      }
    }

    pageText = pageText.trim();

    if (pageText) {
      pageTexts.push({ pageNumber: i, text: pageText });
    }
  }

  // Create document metadata
  const document: Document = {
    id: documentId,
    name: file.name,
    type: file.type,
    size: file.size,
    uploadedAt: new Date(),
    lastModified: new Date(file.lastModified),
    pageCount: pdf.numPages,
    fileData: storedBuffer, // Store original PDF for preview (using the cloned buffer)
  };

  // Create chunks from the text
  const chunks = createChunks(documentId, pageTexts);

  return { document, chunks };
}

/**
 * Split text into chunks with overlap, breaking at word boundaries
 */
function createChunks(
  documentId: string,
  pageTexts: { pageNumber: number; text: string }[]
): DocumentChunk[] {
  const CHUNK_SIZE = 1000; // characters
  const OVERLAP = 200; // characters
  const chunks: DocumentChunk[] = [];

  for (const { pageNumber, text } of pageTexts) {
    let startIndex = 0;

    while (startIndex < text.length) {
      let endIndex = Math.min(startIndex + CHUNK_SIZE, text.length);

      // If not at the end, try to break at a word boundary
      if (endIndex < text.length) {
        // Look for the last space, newline, or punctuation within a reasonable range
        const searchStart = Math.max(endIndex - 100, startIndex);
        const segment = text.slice(searchStart, endIndex + 50);
        const breakChars = /[\s\n.!?;,]\s/g;
        let lastBreak = -1;
        let match;

        while ((match = breakChars.exec(segment)) !== null) {
          lastBreak = searchStart + match.index + 1;
        }

        // If we found a good break point, use it
        if (lastBreak > startIndex) {
          endIndex = lastBreak;
        }
      }

      const chunkText = text.slice(startIndex, endIndex).trim();

      if (chunkText.length > 0) {
        chunks.push({
          id: crypto.randomUUID(),
          documentId,
          pageNumber,
          text: chunkText,
          startIndex,
          endIndex,
        });
      }

      // Move to next chunk with overlap, ensuring we move forward
      const nextStart = endIndex - OVERLAP;
      startIndex = Math.max(nextStart, startIndex + 1);

      // If we're at the end, break
      if (endIndex >= text.length) {
        break;
      }
    }
  }

  return chunks;
}
