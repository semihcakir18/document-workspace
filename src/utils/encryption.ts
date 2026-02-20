/**
 * Encryption utilities for API key storage
 * Uses Web Crypto API for AES-GCM encryption
 *
 * NOTE: This provides obfuscation-level security to avoid storing plain text.
 * It is NOT meant to provide military-grade cryptographic guarantees.
 */

const SALT = 'ai-document-workspace-v1'; // Fixed salt for key derivation
const KEY_LENGTH = 256;

/**
 * Derives a cryptographic key from the salt
 */
async function deriveKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SALT),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('static-salt'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts an API key
 */
export async function encryptAPIKey(apiKey: string): Promise<{ encryptedKey: string; iv: string }> {
  const key = await deriveKey();
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);

  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const encryptedData = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    data
  );

  // Convert to base64 for storage
  const encryptedArray = new Uint8Array(encryptedData);
  const encryptedKey = btoa(String.fromCharCode(...encryptedArray));
  const ivString = btoa(String.fromCharCode(...iv));

  return { encryptedKey, iv: ivString };
}

/**
 * Decrypts an API key
 */
export async function decryptAPIKey(encryptedKey: string, ivString: string): Promise<string> {
  try {
    const key = await deriveKey();

    // Convert from base64
    const encryptedArray = Uint8Array.from(atob(encryptedKey), (c) => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(ivString), (c) => c.charCodeAt(0));

    // Decrypt
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      encryptedArray
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
  } catch (error) {
    console.error('Failed to decrypt API key:', error);
    throw new Error('Invalid or corrupted API key');
  }
}

/**
 * Validates if a string looks like an OpenAI API key
 */
export function validateOpenAIKey(key: string): boolean {
  return /^sk-[A-Za-z0-9-_]{32,}$/.test(key);
}

/**
 * Validates if a string looks like an Anthropic API key
 */
export function validateAnthropicKey(key: string): boolean {
  return /^sk-ant-[A-Za-z0-9-_]{32,}$/.test(key);
}
