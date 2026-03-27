import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ShopifyAPI } from './api.js';
import { parseProductsFile } from './parser.js';
import { convertCSVToJSON } from './csv-converter.js';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface UploadSession {
  id: string;
  status: 'idle' | 'uploading' | 'complete' | 'error';
  progress: {
    total: number;
    completed: number;
    successful: number;
    failed: number;
  };
  errors: Array<{ index: number; title: string; error: string }>;
  startedAt: Date;
  completedAt?: Date;
}

const app = express();
const upload = multer({ dest: 'uploads/', fileFilter });

const sessions = new Map<string, UploadSession>();

function fileFilter(_req: any, file: any, cb: any) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.json', '.csv'].includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only JSON and CSV files are allowed'));
  }
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));

// ============ ROUTES ============

// Home page
app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

// API: Get current session status
app.get('/api/session', (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;

  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId' });
  }

  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json(session);
});

// API: Upload and convert file
app.post('/api/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileExt = path.extname(req.file.originalname).toLowerCase();
    let productsFile = req.file.path;

    // Convert CSV to JSON if needed
    if (fileExt === '.csv') {
      const jsonOutputFile = req.file.path.replace('.csv', '.json');
      const result = await convertCSVToJSON(req.file.path, jsonOutputFile);

      if (!result.success) {
        return res.status(400).json({ error: result.errors[0] || 'Conversion failed' });
      }

      fs.unlinkSync(req.file.path); // Delete original CSV
      productsFile = jsonOutputFile;
    }

    // Parse products
    const { products, errors } = await parseProductsFile(productsFile);

    if (products.length === 0) {
      return res.status(400).json({ error: 'No valid products found in file' });
    }

    res.json({
      success: true,
      productCount: products.length,
      parseErrors: errors,
      tempFile: productsFile,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Upload failed' });
  }
});

// API: Start upload to Shopify
app.post('/api/upload/shopify', async (req: Request, res: Response) => {
  try {
    const { productsFile, storeUrl, accessToken } = req.body;

    if (!productsFile || !storeUrl || !accessToken) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!fs.existsSync(productsFile)) {
      return res.status(404).json({ error: 'Products file not found' });
    }

    // Create session
    const sessionId = Math.random().toString(36).substring(2, 11);
    const session: UploadSession = {
      id: sessionId,
      status: 'uploading',
      progress: {
        total: 0,
        completed: 0,
        successful: 0,
        failed: 0,
      },
      errors: [],
      startedAt: new Date(),
    };

    sessions.set(sessionId, session);

    // Parse products
    const { products } = await parseProductsFile(productsFile);
    session.progress.total = products.length;

    // Upload in background
    (async () => {
      try {
        const api = new ShopifyAPI(storeUrl, accessToken, false);

        // Custom progress tracking
        for (let i = 0; i < products.length; i++) {
          const product = products[i];

          try {
            const handle = product.handle || generateHandle(product.title);
            const exists = await api.checkProductExists(handle);

            if (!exists) {
              await api.createProduct(product);
              session.progress.successful++;
            }
          } catch (error) {
            session.errors.push({
              index: i,
              title: product.title,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }

          session.progress.completed++;
          session.progress.failed = session.errors.length;
        }

        session.status = 'complete';
        session.completedAt = new Date();

        // Cleanup temp file
        try {
          fs.unlinkSync(productsFile);
        } catch (e) {
          // Ignore
        }
      } catch (error) {
        session.status = 'error';
        session.completedAt = new Date();
        console.error('Upload error:', error);
      }
    })();

    res.json({ sessionId });
  } catch (error) {
    console.error('Start upload error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to start upload' });
  }
});

// ============ UTILITIES ============

function generateHandle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ============ START SERVER ============

export function startWebServer(port: number) {
  // Create uploads directory if it doesn't exist
  if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
  }

  app.listen(port, () => {
    console.log(`\n🌐 Web UI running at http://localhost:${port}`);
    console.log('📤 Upload products via the web interface\n');
  });
}
