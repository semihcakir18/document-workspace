/**
 * API Key input modal
 * Allows users to input and encrypt their OpenAI API key
 */

import { useState } from 'react';
import { useStore } from '../store/useStore';
import { encryptAPIKey, validateOpenAIKey, validateAnthropicKey } from '../utils/encryption';

interface APIKeyModalProps {
  onClose: () => void;
}

export default function APIKeyModal({ onClose }: APIKeyModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<'openai' | 'anthropic'>('openai');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { setHasAPIKey } = useStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate API key format
    const isValid = provider === 'openai'
      ? validateOpenAIKey(apiKey)
      : validateAnthropicKey(apiKey);

    if (!isValid) {
      setError(`Invalid ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key format`);
      return;
    }

    setIsLoading(true);

    try {
      // Encrypt and store the API key
      const { encryptedKey, iv } = await encryptAPIKey(apiKey);

      localStorage.setItem('ai-doc-api-key', JSON.stringify({ encryptedKey, iv }));
      localStorage.setItem('ai-doc-api-provider', provider);

      setHasAPIKey(true, provider);
      onClose();
    } catch (err) {
      setError('Failed to encrypt API key');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>🔑 API Key Required</h2>
        </div>

        <div className="modal-body">
          <div className="info-box">
            <p>
              <strong>Privacy Notice:</strong> Your API key is encrypted before being stored
              locally in your browser. This app runs entirely in your browser with no backend.
            </p>
            <p className="text-muted">
              This encryption provides obfuscation-level security to avoid plain-text exposure.
              It is not meant to provide military-grade cryptographic guarantees.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="provider">AI Provider</label>
              <select
                id="provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value as 'openai' | 'anthropic')}
                className="form-select"
              >
                <option value="openai">OpenAI (GPT-4, GPT-3.5)</option>
                <option value="anthropic">Anthropic (Claude)</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="apiKey">
                {provider === 'openai' ? 'OpenAI API Key' : 'Anthropic API Key'}
              </label>
              <input
                id="apiKey"
                type="password"
                className="form-input"
                placeholder={provider === 'openai' ? 'sk-...' : 'sk-ant-...'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                required
              />
              <small className="form-help">
                Get your API key from{' '}
                {provider === 'openai' ? (
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
                    OpenAI Platform
                  </a>
                ) : (
                  <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer">
                    Anthropic Console
                  </a>
                )}
              </small>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="modal-actions">
              <button type="submit" className="button button-primary" disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save API Key'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
