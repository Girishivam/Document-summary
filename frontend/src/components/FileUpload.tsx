import React, { useState, useRef } from 'react';
import './FileUpload.css';

interface FileUploadProps {
  onFileUpload: (file: File, summaryLength: string) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [summaryLength, setSummaryLength] = useState<string>('medium');
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    const maxSize = 10 * 1024 * 1024;
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

    if (!allowedTypes.includes(file.type)) {
      return 'Invalid file type. Please upload PDF, JPG, or PNG files only.';
    }

    if (file.size > maxSize) {
      return 'File size exceeds 10MB limit. Please choose a smaller file.';
    }

    return null;
  };

  const handleFileSelect = (file: File) => {
    const validationError = validateFile(file);

    if (validationError) {
      setError(validationError);
      setSelectedFile(null);
      return;
    }

    setError('');
    setSelectedFile(file);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleUploadClick = () => {
    if (selectedFile) {
      onFileUpload(selectedFile, summaryLength);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const getFileIcon = (file: File) => {
    if (file.type === 'application/pdf') {
      return '📄';
    }
    return '🖼️';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="file-upload-container">
      <div
        className={`dropzone ${isDragActive ? 'active' : ''} ${selectedFile ? 'has-file' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />

        <div className="upload-content">
          <div className="upload-icon">📤</div>
          <h2>Upload Your Document</h2>
          <p className="upload-text">
            {isDragActive
              ? 'Drop the file here...'
              : 'Drag & drop a file here, or click to browse'}
          </p>
          <div className="supported-formats">
            Supported: PDF, JPG, PNG (Max 10MB)
          </div>
          <div className="ai-powered-badge">
            <span className="badge-icon">✨</span>
            <span>AI-Powered by Cosmic Intelligence</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      {selectedFile && (
        <div className="file-selected">
          <div className="file-info">
            <div className="file-details">
              <span className="file-icon">{getFileIcon(selectedFile)}</span>
              <div className="file-meta">
                <h4>{selectedFile.name}</h4>
                <p>{formatFileSize(selectedFile.size)}</p>
              </div>
              <button 
                className="remove-file"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFile(null);
                  setError('');
                }}
              >
                ✕
              </button>
            </div>
          </div>

          <div className="summary-options">
            <h3>Choose Summary Length</h3>
            <div className="length-buttons">
              {[
                { key: 'short', label: 'Short', desc: '50-100 words' },
                { key: 'medium', label: 'Medium', desc: '150-250 words' },
                { key: 'long', label: 'Long', desc: '300-500 words' }
              ].map((option) => (
                <button
                  key={option.key}
                  className={`length-button ${summaryLength === option.key ? 'active' : ''}`}
                  onClick={() => setSummaryLength(option.key)}
                >
                  <span className="length-label">{option.label}</span>
                  <span className="length-desc">{option.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <button 
            className="upload-button"
            onClick={handleUploadClick}
          >
            <span className="button-icon">🧠</span>
            Generate Summary
          </button>
        </div>
      )}
    </div>
  );
};

export default FileUpload;