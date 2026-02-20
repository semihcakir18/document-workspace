/**
 * Global state management using Zustand
 */

import { create } from 'zustand';
import type { Document, AppSettings } from '../types/index';

interface AppState {
  // Current state
  selectedDocument: Document | null;
  isLoading: boolean;
  error: string | null;

  // API Key state
  hasAPIKey: boolean;
  apiProvider: 'openai' | 'anthropic' | null;

  // Settings
  settings: AppSettings;

  // Sidebar states
  showDocumentList: boolean;
  showChat: boolean;

  // Citation highlighting
  highlightedChunkIds: string[];

  // Actions
  setSelectedDocument: (document: Document | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setHasAPIKey: (hasKey: boolean, provider?: 'openai' | 'anthropic') => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  toggleDocumentList: () => void;
  toggleChat: () => void;
  setHighlightedChunks: (chunkIds: string[]) => void;
  scrollToChunk: (chunkId: string) => void;
}

const defaultSettings: AppSettings = {
  maxFileSize: 30 * 1024 * 1024, // 30MB default
  embeddingCacheSize: 1000,
  chunkSize: 1000,
  chunkOverlap: 200,
  topK: 5,
  theme: 'system',
};

export const useStore = create<AppState>((set) => ({
  // Initial state
  selectedDocument: null,
  isLoading: false,
  error: null,
  hasAPIKey: false,
  apiProvider: null,
  settings: defaultSettings,
  showDocumentList: true,
  showChat: true,
  highlightedChunkIds: [],

  // Actions
  setSelectedDocument: (document) => set({ selectedDocument: document }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setHasAPIKey: (hasKey, provider) => set({ hasAPIKey: hasKey, apiProvider: provider || null }),
  updateSettings: (newSettings) =>
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    })),
  toggleDocumentList: () => set((state) => ({ showDocumentList: !state.showDocumentList })),
  toggleChat: () => set((state) => ({ showChat: !state.showChat })),
  setHighlightedChunks: (chunkIds) => set({ highlightedChunkIds: chunkIds }),
  scrollToChunk: (chunkId) => {
    // This will be handled by the DocumentViewer component
    const element = document.querySelector(`[data-chunk-id="${chunkId}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  },
}));
