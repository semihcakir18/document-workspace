/**
 * AI service for streaming chat completions
 * Supports OpenAI and Anthropic APIs
 */

import { decryptAPIKey } from '../utils/encryption';
import type { DocumentChunk } from '../types/index';

interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

/**
 * Get and decrypt the API key from localStorage
 */
async function getAPIKey(): Promise<{ key: string; provider: 'openai' | 'anthropic' }> {
  const storedKey = localStorage.getItem('ai-doc-api-key');
  const provider = localStorage.getItem('ai-doc-api-provider') as 'openai' | 'anthropic' | null;

  if (!storedKey || !provider) {
    throw new Error('No API key configured');
  }

  const { encryptedKey, iv } = JSON.parse(storedKey);
  const key = await decryptAPIKey(encryptedKey, iv);

  return { key, provider };
}

/**
 * Stream chat completion from OpenAI
 */
async function streamOpenAI(
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  callbacks: StreamCallbacks
): Promise<void> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      stream: true,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'OpenAI API request failed');
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let fullText = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter((line) => line.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const token = parsed.choices[0]?.delta?.content;

            if (token) {
              fullText += token;
              callbacks.onToken(token);
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }

    callbacks.onComplete(fullText);
  } catch (error) {
    callbacks.onError(error as Error);
  }
}

/**
 * Stream chat completion from Anthropic
 */
async function streamAnthropic(
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  callbacks: StreamCallbacks
): Promise<void> {
  // Extract system message if present
  const systemMessage = messages.find((m) => m.role === 'system');
  const conversationMessages = messages.filter((m) => m.role !== 'system');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      system: systemMessage?.content,
      messages: conversationMessages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Anthropic API request failed');
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let fullText = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter((line) => line.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === 'content_block_delta') {
              const token = parsed.delta?.text;
              if (token) {
                fullText += token;
                callbacks.onToken(token);
              }
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }

    callbacks.onComplete(fullText);
  } catch (error) {
    callbacks.onError(error as Error);
  }
}

/**
 * Main function to stream AI responses with document context
 */
export async function streamChatWithContext(
  userMessage: string,
  relevantChunks: DocumentChunk[],
  conversationHistory: Array<{ role: string; content: string }>,
  callbacks: StreamCallbacks
): Promise<void> {
  const { key, provider } = await getAPIKey();

  // Build context from relevant chunks
  const context = relevantChunks
    .map((chunk, idx) => `[Chunk ${idx + 1} - Page ${chunk.pageNumber}]\n${chunk.text}`)
    .join('\n\n');

  // Build messages
  const messages = [
    {
      role: 'system',
      content: `You are a helpful AI assistant analyzing a document. Use the provided document excerpts to answer questions accurately. If the answer isn't in the provided context, say so.

Document Context:
${context}`,
    },
    ...conversationHistory,
    {
      role: 'user',
      content: userMessage,
    },
  ];

  // Stream based on provider
  if (provider === 'openai') {
    await streamOpenAI(messages, key, callbacks);
  } else {
    await streamAnthropic(messages, key, callbacks);
  }
}
