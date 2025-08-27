import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import SummaryDisplay from './components/SummaryDisplay';
import LoadingSpinner from './components/LoadingSpinner';
import './App.css';

interface SummaryData {
  summary: string;
  originalText: string;
  wordCount: {
    original: number;
    summary: number;
  };
  summaryLength: string;
  method?: string;
  processingTime?: number;
}

function App() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [error, setError] = useState<string>('');

  const handleFileUpload = async (file: File, summaryLength: string) => {
    setIsProcessing(true);
    setError('');
    setSummaryData(null);

    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('summaryLength', summaryLength);

      const response = await fetch('/api/upload-and-summarize', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process document');
      }

      const data = await response.json();
      setSummaryData(data.data);

      // Log AI method used
      if (data.data.method) {
        console.log(`✅ Summary generated using: ${data.data.method}`);
      }

    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while processing the document');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setSummaryData(null);
    setError('');
  };

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-content">
          <h1>Document Summary Assistant</h1>
          <p>Upload PDF or image files to generate intelligent summaries</p>
          <div className="ai-badge">
            <span className="cosmic-logo">✨</span>
            <span>Driven by Cosmic Intelligence</span>
          </div>
        </div>
      </header>

      <main className="app-main">
        {!summaryData && !isProcessing && (
          <FileUpload onFileUpload={handleFileUpload} />
        )}

        {isProcessing && <LoadingSpinner />}

        {error && (
          <div className="error-container">
            <div className="error-icon">❌</div>
            <h3>Processing Error</h3>
            <p>{error}</p>
            <button onClick={handleReset} className="retry-button">
              Try Another Document
            </button>
          </div>
        )}

        {summaryData && (
          <SummaryDisplay 
            data={summaryData} 
            onReset={handleReset}
          />
        )}
      </main>

      <footer className="app-footer">
        {/* <p>Engineered with React & Node.js • Document Summary Assistant</p> */}
        {summaryData?.method && (
          <p className="ai-credit">Powered by cosmic intelligence</p>
        )}
      </footer>
    </div>
  );
}

export default App;