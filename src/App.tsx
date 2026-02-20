import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import APIKeyModal from './components/APIKeyModal';
import { useStore } from './store/useStore';
import './App.css';

const queryClient = new QueryClient();

function App() {
  const { hasAPIKey, setHasAPIKey } = useStore();
  const [showAPIKeyModal, setShowAPIKeyModal] = useState(false);

  useEffect(() => {
    // Check if API key exists in localStorage
    const storedKey = localStorage.getItem('ai-doc-api-key');
    const storedProvider = localStorage.getItem('ai-doc-api-provider') as 'openai' | 'anthropic' | null;

    if (storedKey && storedProvider) {
      setHasAPIKey(true, storedProvider);
    } else {
      setShowAPIKeyModal(true);
    }
  }, [setHasAPIKey]);

  const handleAPIKeySet = () => {
    setShowAPIKeyModal(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="app">
        <Layout />
        {showAPIKeyModal && <APIKeyModal onClose={handleAPIKeySet} />}
      </div>
    </QueryClientProvider>
  );
}

export default App;
