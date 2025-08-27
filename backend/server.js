const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
require('dotenv').config();


// Import Google Generative AI (NexusAI)
let GoogleGenerativeAI = null;
try {
  const { GoogleGenerativeAI: NexusAIClient } = require('@google/generative-ai');
  GoogleGenerativeAI = NexusAIClient;
} catch (error) {
  console.log('Google Generative AI not installed, using fallback methods');
}

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
fs.ensureDirSync(uploadsDir);

// Initialize NexusAI client if API key is provided
let nexusAIModel = null;
if (process.env.NEXUSAI_API_KEY && process.env.NEXUSAI_API_KEY !== 'your_nexusai_api_key_here' && GoogleGenerativeAI) {
  try {
    const nexusAI = new GoogleGenerativeAI(process.env.NEXUSAI_API_KEY);
    nexusAIModel = nexusAI.getGenerativeModel({ 
      model: process.env.NEXUSAI_MODEL || 'nexusai-1.5-flash' 
    });
    console.log('🧠 Google NexusAI initialized successfully');
    console.log(`📋 Using model: ${process.env.NEXUSAI_MODEL || 'nexusai-1.5-flash'}`);
  } catch (error) {
    console.error('❌ NexusAI initialization failed:', error.message);
  }
}

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `document-${uniqueSuffix}${extension}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg', 
      'image/png'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPG, PNG files are allowed.'));
    }
  }
});

// Helper function to clean text
const cleanText = (text) => {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/[^\w\s\.\,\;\:\?\!\-\(\)]/g, '')
    .trim();
};

// PDF text extraction
const extractTextFromPDF = async (filePath) => {
  try {
    console.log('🔍 Starting PDF text extraction...');
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);
    const cleanedText = cleanText(data.text);

    console.log(`📄 PDF extraction complete: ${cleanedText.length} characters`);
    return cleanedText;
  } catch (error) {
    console.error('❌ PDF extraction error:', error.message);
    throw new Error(`PDF parsing failed: ${error.message}`);
  }
};

// OCR text extraction from images
const extractTextFromImage = async (filePath) => {
  try {
    console.log('🖼️ Starting OCR text extraction...');

    const { data: { text } } = await Tesseract.recognize(filePath, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`📊 OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });

    const cleanedText = cleanText(text);
    console.log(`🎯 OCR extraction complete: ${cleanedText.length} characters`);
    return cleanedText;
  } catch (error) {
    console.error('❌ OCR extraction error:', error.message);
    throw new Error(`OCR processing failed: ${error.message}`);
  }
};

// Google NexusAI Summarization (PREMIUM METHOD)
const summarizeWithNexusAI = async (text, length = 'medium') => {
  try {
    if (!nexusAIModel) {
      throw new Error('NexusAI not configured');
    }

    console.log(`🧠 Generating summary with Google NexusAI (${length})...`);

    let lengthInstruction;
    let maxTokens;

    switch (length) {
      case 'short':
        lengthInstruction = 'in 2-3 concise sentences (50-80 words)';
        maxTokens = 100;
        break;
      case 'long':
        lengthInstruction = 'in a comprehensive paragraph (250-400 words)';
        maxTokens = 450;
        break;
      default: // medium
        lengthInstruction = 'in a well-structured paragraph (120-200 words)';
        maxTokens = 250;
    }

    // Limit input text to prevent token overflow
    const maxInputLength = 8000; // NexusAI can handle more text than OpenAI
    const inputText = text.length > maxInputLength ? text.substring(0, maxInputLength) + '...' : text;

    const prompt = `Please provide an intelligent summary of the following document ${lengthInstruction}. Focus on the key points, main arguments, and essential information. Make the summary coherent, informative, and well-written:\n\nDocument text:\n${inputText}`;

    // Generate content with NexusAI
    const result = await nexusAIModel.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: parseFloat(process.env.NEXUSAI_TEMPERATURE) || 0.3,
        maxOutputTokens: maxTokens,
        topK: 40,
        topP: 0.95,
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        }
      ]
    });

    const response = await result.response;
    const summary = response.text().trim();

    if (!summary) {
      throw new Error('Empty response from NexusAI');
    }

    console.log('✅ Summary generated successfully');
    console.log(`📊 Summary length: ${summary.length} characters`);
    return summary;

  } catch (error) {
    console.error('❌ Summary generation error:', error.message);
    throw error;
  }
};

// Enhanced Statistical Summarization (FALLBACK METHOD)
const summarizeWithStatistical = async (text, length = 'medium') => {
  try {
    console.log(`Generating enhanced statistical summary (${length})...`);

    // Split text into sentences
    const sentences = text.split(/[.!?]+/).filter(sentence => {
      const trimmed = sentence.trim();
      return trimmed.length > 20 && trimmed.split(' ').length > 3;
    });

    if (sentences.length === 0) {
      throw new Error('No valid sentences found for summarization');
    }

    // Calculate target sentence count based on length
    let targetSentences;
    switch (length) {
      case 'short':
        targetSentences = Math.min(4, Math.max(2, Math.ceil(sentences.length * 0.1)));
        break;
      case 'long':
        targetSentences = Math.min(15, Math.max(8, Math.ceil(sentences.length * 0.3)));
        break;
      default: // medium
        targetSentences = Math.min(8, Math.max(4, Math.ceil(sentences.length * 0.2)));
    }

    // Calculate word frequencies
    const wordFreq = {};
    const allWords = text.toLowerCase().split(/\W+/).filter(word => word.length > 3);

    allWords.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    // Score sentences based on multiple factors
    const scoredSentences = sentences.map((sentence, index) => {
      const words = sentence.toLowerCase().split(/\W+/).filter(word => word.length > 3);
      let score = 0;

      // Word frequency score
      words.forEach(word => {
        score += wordFreq[word] || 0;
      });

      // Position score (earlier sentences get higher scores)
      const positionScore = (sentences.length - index) / sentences.length;
      score += positionScore * 10;

      // Length score (medium length sentences preferred)
      const lengthScore = Math.max(0, 1 - Math.abs(words.length - 15) / 15);
      score += lengthScore * 5;

      return {
        sentence: sentence.trim(),
        score: score / Math.max(words.length, 1), // Normalize by word count
        index
      };
    });

    // Select top sentences and sort by original order
    const selectedSentences = scoredSentences
      .sort((a, b) => b.score - a.score)
      .slice(0, targetSentences)
      .sort((a, b) => a.index - b.index)
      .map(item => item.sentence);

    const summary = selectedSentences.join('. ') + '.';

    console.log(`Statistical summary generated: ${selectedSentences.length} sentences`);
    return summary;
  } catch (error) {
    console.error('Statistical summarization error:', error.message);
    throw error;
  }
};

// Main summarization function with intelligent fallback
const summarizeText = async (text, length = 'medium') => {
  console.log(`Starting summarization with ${length} length...`);

  try {
    // Try NexusAI first if available
    if (nexusAIModel) {
      console.log('Using AI for summarization...');
      return await summarizeWithNexusAI(text, length);
    }

    // Fallback to statistical method
    console.log('Using enhanced statistical summarization...');
    return await summarizeWithStatistical(text, length);

  } catch (error) {
    console.error('❌ Primary summarization failed, using statistical fallback');
    // Ultimate fallback
    return await summarizeWithStatistical(text, length);
  }
};

// Utility function to calculate word count
const getWordCount = (text) => {
  return text.split(/\s+/).filter(word => word.length > 0).length;
};

// Clean up uploaded files
const cleanupFile = async (filePath) => {
  try {
    await fs.remove(filePath);
    console.log(`🗑️ Cleaned up file: ${path.basename(filePath)}`);
  } catch (error) {
    console.error('⚠️ Cleanup error:', error.message);
  }
};

// Main upload and summarize endpoint
app.post('/api/upload-and-summarize', upload.single('document'), async (req, res) => {
  let filePath = '';
  const startTime = Date.now();

  try {
    console.log('\n🚀 Starting document processing with NexusAI...');

    if (!req.file) {
      return res.status(400).json({ 
        error: 'No file uploaded',
        success: false 
      });
    }

    const { summaryLength = 'medium' } = req.body;
    filePath = req.file.path;

    console.log(`📁 Processing file: ${req.file.originalname} (${req.file.mimetype})`);
    console.log(`📏 Summary length requested: ${summaryLength}`);

    let extractedText = '';

    // Extract text based on file type
    if (req.file.mimetype === 'application/pdf') {
      extractedText = await extractTextFromPDF(filePath);
    } else if (req.file.mimetype.startsWith('image/')) {
      extractedText = await extractTextFromImage(filePath);
    }

    // Validate extracted text
    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ 
        error: 'No text could be extracted from the document. Please ensure the document contains readable text.',
        success: false 
      });
    }

    if (extractedText.trim().length < 100) {
      return res.status(400).json({ 
        error: 'Document contains insufficient text for meaningful summarization. Please upload a document with more content.',
        success: false 
      });
    }

    console.log(`📊 Extracted text: ${extractedText.length} characters`);

    // Generate summary using NexusAI or fallback method
    const summary = await summarizeText(extractedText, summaryLength);

    // Calculate statistics
    const originalWordCount = getWordCount(extractedText);
    const summaryWordCount = getWordCount(summary);

    const processingTime = Date.now() - startTime;
    console.log(`⏱️ Total processing time: ${processingTime}ms`);

    // Determine which method was used
    let methodUsed = 'Enhanced Statistical';
    if (nexusAIModel) {
      methodUsed = 'Google NexusAI';
    }

    // Clean up uploaded file
    await cleanupFile(filePath);

    // Send successful response
    res.json({
      success: true,
      data: {
        summary,
        originalText: extractedText.length > 500 
          ? extractedText.substring(0, 500) + '...' 
          : extractedText,
        summaryLength,
        wordCount: {
          original: originalWordCount,
          summary: summaryWordCount
        },
        processingTime,
        method: methodUsed
      }
    });

    console.log(`✅ Processing completed successfully with ${methodUsed}!`);

  } catch (error) {
    console.error('❌ Processing error:', error.message);

    // Clean up uploaded file on error
    if (filePath) {
      await cleanupFile(filePath);
    }

    res.status(500).json({ 
      error: error.message,
      success: false 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const availableMethods = [];
  if (nexusAIModel) availableMethods.push('Google NexusAI');
  availableMethods.push('Enhanced Statistical');

  res.json({ 
    status: 'OK', 
    message: 'Document Summary Assistant API with NexusAI is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    availableMethods: availableMethods,
    activeMethod: availableMethods[0] || 'Enhanced Statistical',
    nexusModel: process.env.NEXUSAI_MODEL || 'nexusai-1.5-flash'
  });
});

// API status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    service: 'Document Summary Assistant API',
    version: '2.0.0-nexusai',
    features: {
      pdf_processing: true,
      ocr_processing: true,
      nexus_ai_summarization: nexusAIModel ? true : false,
      file_upload: true,
      enhanced_statistical: true
    },
    limits: {
      max_file_size: '10MB',
      supported_formats: ['PDF', 'JPG', 'PNG']
    },
    ai_models: {
      google_nexusai: nexusAIModel ? 'available' : 'not configured',
      nexusai_model: process.env.NEXUSAI_MODEL || 'nexusai-1.5-flash',
      statistical_enhanced: 'always available'
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'File too large. Maximum size allowed is 10MB.',
        success: false 
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ 
        error: 'Too many files. Please upload one file at a time.',
        success: false 
      });
    }
  }

  console.error('💥 Unhandled error:', error.message);
  res.status(500).json({ 
    error: 'Internal server error. Please try again.',
    success: false 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: 'The requested API endpoint does not exist'
  });
});

// Start server
app.listen(port, () => {
  console.log(`\n🧠 Document Summary Assistant API with Google NexusAI`);
  console.log(`📡 Server running on port ${port}`);
  console.log(`🔗 Health check: http://localhost:${port}/api/health`);
  console.log(`📋 API status: http://localhost:${port}/api/status`);
  console.log(`📁 Upload directory: ${uploadsDir}`);

  // Show available AI methods
  const methods = [];
  if (nexusAIModel) methods.push('🧠 Google NexusAI');
  methods.push('📊 Enhanced Statistical');

  console.log(`\n🤖 Available Summarization Methods:`);
  methods.forEach(method => console.log(`   ${method}`));

  if (nexusAIModel) {
    console.log(`\n✨ NexusAI Features:`);
    console.log(`   📋 Model: ${process.env.NEXUSAI_MODEL || 'nexusai-1.5-flash'}`);
    console.log(`   🆓 Cost: FREE (Google AI Studio)`);
    console.log(`   🚀 Quality: High-quality AI summaries`);
  } else {
    console.log(`\n⚠️  NexusAI not configured. Add NEXUSAI_API_KEY to .env for AI summaries.`);
  }

  console.log(`\n📋 Available Endpoints:`);
  console.log(`   POST /api/upload-and-summarize - Process documents with NexusAI`);
  console.log(`   GET  /api/health - Health check with AI status`);
  console.log(`   GET  /api/status - Service status with AI capabilities`);

  console.log(`\n✅ Ready to process documents with Google NexusAI!\n`);
});

module.exports = app;
