/**
 * Settings panel component
 * Manages API keys, chunk configuration, and app preferences
 */

import './Settings.css';
import { useState, useEffect } from 'react';
import { X, Key, FileText, Sliders, Eye, EyeOff, Trash2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import { encryptAPIKey, decryptAPIKey, validateOpenAIKey, validateAnthropicKey } from '../utils/encryption';
import { clearOldEmbeddings, clearAllData } from '../services/db';
import type { AppSettings } from '../types/index';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Settings({ isOpen, onClose }: SettingsProps) {
  const { settings, updateSettings, hasAPIKey, apiProvider, setHasAPIKey } = useStore();

  const [activeTab, setActiveTab] = useState<'api' | 'chunking' | 'advanced'>('api');

  // API Key settings
  const [provider, setProvider] = useState<'openai' | 'anthropic'>(apiProvider || 'openai');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');

  // Chunking settings
  const [chunkSize, setChunkSize] = useState(settings.chunkSize);
  const [chunkOverlap, setChunkOverlap] = useState(settings.chunkOverlap);
  const [topK, setTopK] = useState(settings.topK);

  // Advanced settings
  const [maxFileSize, setMaxFileSize] = useState(settings.maxFileSize / (1024 * 1024)); // Convert to MB
  const [embeddingCacheSize, setEmbeddingCacheSize] = useState(settings.embeddingCacheSize);
  const [theme, setTheme] = useState(settings.theme);

  useEffect(() => {
    if (isOpen) {
      loadCurrentAPIKey();
    }
  }, [isOpen]);

  const loadCurrentAPIKey = async () => {
    const stored = localStorage.getItem('ai-doc-api-key');
    const storedProvider = localStorage.getItem('ai-doc-api-provider') as 'openai' | 'anthropic';
    if (stored && storedProvider) {
      try {
        const config = JSON.parse(stored);
        const decrypted = await decryptAPIKey(config.encryptedKey, config.salt || '', config.iv);
        setApiKey(decrypted);
        setProvider(storedProvider);
        setKeyStatus('valid');
      } catch (error) {
        console.error('Failed to load API key:', error);
      }
    }
  };

  const handleSaveAPIKey = async () => {
    if (!apiKey.trim()) {
      setKeyStatus('invalid');
      return;
    }

    setKeyStatus('checking');

    try {
      // Validate key
      const isValid = provider === 'openai'
        ? await validateOpenAIKey(apiKey)
        : await validateAnthropicKey(apiKey);

      if (!isValid) {
        setKeyStatus('invalid');
        return;
      }

      // Encrypt and save
      const encrypted = await encryptAPIKey(apiKey);
      localStorage.setItem('ai-doc-api-key', JSON.stringify(encrypted));
      localStorage.setItem('ai-doc-api-provider', provider);
      setHasAPIKey(true, provider);
      setKeyStatus('valid');
    } catch (error) {
      console.error('API key validation failed:', error);
      setKeyStatus('invalid');
    }
  };

  const handleRemoveAPIKey = () => {
    localStorage.removeItem('ai-doc-api-key');
    localStorage.removeItem('ai-doc-api-provider');
    setHasAPIKey(false);
    setApiKey('');
    setKeyStatus('idle');
  };

  const handleSaveChunkingSettings = () => {
    updateSettings({
      chunkSize,
      chunkOverlap,
      topK,
    });
    alert('Chunking settings saved. New settings will apply to newly uploaded documents.');
  };

  const handleSaveAdvancedSettings = async () => {
    updateSettings({
      maxFileSize: maxFileSize * 1024 * 1024, // Convert MB to bytes
      embeddingCacheSize,
      theme,
    });

    // Apply theme
    document.documentElement.setAttribute('data-theme', theme);

    // Clear old embeddings if cache size changed
    if (embeddingCacheSize !== settings.embeddingCacheSize) {
      await clearOldEmbeddings(embeddingCacheSize);
    }

    alert('Advanced settings saved.');
  };

  const handleClearAllData = async () => {
    const confirm = window.confirm(
      'This will delete ALL documents, messages, and cached data. This action cannot be undone. Are you sure?'
    );
    if (confirm) {
      await clearAllData();
      window.location.reload();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="settings-overlay" onClick={onClose}>
        <motion.div
          className="settings-panel"
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          <div className="settings-header">
            <h2>Settings</h2>
            <button className="close-button" onClick={onClose}>
              <X className="icon" />
            </button>
          </div>

          <div className="settings-tabs">
            <button
              className={`settings-tab ${activeTab === 'api' ? 'active' : ''}`}
              onClick={() => setActiveTab('api')}
            >
              <Key className="tab-icon" />
              <span>API Keys</span>
              {activeTab === 'api' && (
                <motion.div layoutId="activeSettingsTab" className="tab-indicator" />
              )}
            </button>
            <button
              className={`settings-tab ${activeTab === 'chunking' ? 'active' : ''}`}
              onClick={() => setActiveTab('chunking')}
            >
              <FileText className="tab-icon" />
              <span>Chunking</span>
              {activeTab === 'chunking' && (
                <motion.div layoutId="activeSettingsTab" className="tab-indicator" />
              )}
            </button>
            <button
              className={`settings-tab ${activeTab === 'advanced' ? 'active' : ''}`}
              onClick={() => setActiveTab('advanced')}
            >
              <Sliders className="tab-icon" />
              <span>Advanced</span>
              {activeTab === 'advanced' && (
                <motion.div layoutId="activeSettingsTab" className="tab-indicator" />
              )}
            </button>
          </div>

        <div className="settings-content">
          {activeTab === 'api' && (
            <div className="settings-section">
              <h3>API Configuration</h3>

              <div className="form-group">
                <label>Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as 'openai' | 'anthropic')}
                  disabled={keyStatus === 'valid'}
                >
                  <option value="openai">OpenAI (GPT-4o-mini)</option>
                  <option value="anthropic">Anthropic (Claude)</option>
                </select>
              </div>

              <div className="form-group">
                <label>API Key</label>
                <div className="api-key-input">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={provider === 'openai' ? 'sk-...' : 'sk-ant-...'}
                    disabled={keyStatus === 'valid'}
                  />
                  <button
                    type="button"
                    className="toggle-visibility"
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOff className="icon" /> : <Eye className="icon" />}
                  </button>
                </div>
                {keyStatus === 'checking' && <p className="status-message">Validating...</p>}
                {keyStatus === 'valid' && <p className="status-message success">✓ Valid API key</p>}
                {keyStatus === 'invalid' && <p className="status-message error">✗ Invalid API key</p>}
              </div>

              <div className="settings-actions">
                {keyStatus !== 'valid' ? (
                  <button onClick={handleSaveAPIKey} disabled={!apiKey.trim() || keyStatus === 'checking'}>
                    Save API Key
                  </button>
                ) : (
                  <button onClick={handleRemoveAPIKey} className="danger">
                    Remove API Key
                  </button>
                )}
              </div>

              <div className="info-box">
                <strong>Privacy Notice:</strong> Your API key is encrypted using Web Crypto API and stored locally in your browser.
                It never leaves your device. This provides obfuscation-level security suitable for personal use.
              </div>
            </div>
          )}

          {activeTab === 'chunking' && (
            <div className="settings-section">
              <h3>Document Chunking</h3>

              <div className="form-group">
                <label>
                  Chunk Size: <strong>{chunkSize}</strong> characters
                </label>
                <input
                  type="range"
                  min="500"
                  max="2000"
                  step="100"
                  value={chunkSize}
                  onChange={(e) => setChunkSize(Number(e.target.value))}
                />
                <p className="help-text">
                  Larger chunks provide more context but use more tokens. Recommended: 1000-1500.
                </p>
              </div>

              <div className="form-group">
                <label>
                  Chunk Overlap: <strong>{chunkOverlap}</strong> characters
                </label>
                <input
                  type="range"
                  min="0"
                  max="500"
                  step="50"
                  value={chunkOverlap}
                  onChange={(e) => setChunkOverlap(Number(e.target.value))}
                />
                <p className="help-text">
                  Overlap ensures context isn't lost between chunks. Recommended: 150-250.
                </p>
              </div>

              <div className="form-group">
                <label>
                  Top K Results: <strong>{topK}</strong>
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                />
                <p className="help-text">
                  Number of relevant chunks to include in AI context. More chunks = better context but higher cost.
                </p>
              </div>

              <div className="settings-actions">
                <button onClick={handleSaveChunkingSettings}>
                  Save Chunking Settings
                </button>
              </div>

              <div className="info-box">
                <strong>Note:</strong> These settings only affect newly uploaded documents.
                Existing documents will keep their original chunking.
              </div>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="settings-section">
              <h3>Advanced Settings</h3>

              <div className="form-group">
                <label>
                  Max File Size: <strong>{maxFileSize}</strong> MB
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={maxFileSize}
                  onChange={(e) => setMaxFileSize(Number(e.target.value))}
                />
                <p className="help-text">
                  Maximum allowed PDF file size. Large files may slow down the app.
                </p>
              </div>

              <div className="form-group">
                <label>
                  Embedding Cache Size: <strong>{embeddingCacheSize}</strong> embeddings
                </label>
                <input
                  type="number"
                  min="100"
                  max="5000"
                  step="100"
                  value={embeddingCacheSize}
                  onChange={(e) => setEmbeddingCacheSize(Number(e.target.value))}
                />
                <p className="help-text">
                  Maximum number of cached embeddings. Lower values save memory but require more regeneration.
                </p>
              </div>

              <div className="form-group">
                <label>Theme</label>
                <select value={theme} onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}>
                  <option value="system">System (Auto)</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>

              <div className="settings-actions">
                <button onClick={handleSaveAdvancedSettings}>
                  Save Advanced Settings
                </button>
              </div>

              <div className="danger-zone">
                <div className="danger-zone-header">
                  <AlertTriangle className="danger-zone-icon" />
                  <h4>Danger Zone</h4>
                </div>
                <p className="danger-zone-description">
                  Permanently delete all documents, messages, and cached embeddings. This action cannot be undone.
                </p>
                <button onClick={handleClearAllData} className="danger-button">
                  <Trash2 className="button-icon" />
                  Clear All Data
                </button>
              </div>
            </div>
          )}
        </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
