import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
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

// Token storage (persisted to uploads/auth.json which is a Docker volume)
const TOKEN_FILE = path.join(process.cwd(), 'uploads', 'auth.json');

function loadStoredToken(): { accessToken: string; shop: string } | null {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
    }
  } catch {
    // ignore
  }
  return null;
}

function getCredentials() {
  const stored = loadStoredToken();
  return {
    accessToken: stored?.accessToken || process.env.SHOPIFY_ACCESS_TOKEN || null,
    shop: stored?.shop || process.env.SHOPIFY_STORE_URL || null,
  };
}

// ============ AUTH ============

const SESSION_SECRET = process.env.SESSION_SECRET || 'changeme-set-SESSION_SECRET-in-env';
const COOKIE_NAME = 'shopify_session';

function signToken(payload: string): string {
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token: string): string | null {
  const lastDot = token.lastIndexOf('.');
  if (lastDot === -1) return null;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return payload;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.cookie
    ?.split(';')
    .find(c => c.trim().startsWith(`${COOKIE_NAME}=`))
    ?.split('=')[1];

  if (token && verifyToken(token)) return next();

  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.redirect('/login');
}

// Middleware
app.use(express.json());

// Public routes (no auth required)
app.use('/login', express.static(path.join(__dirname, '../public/login.html')));
app.get('/login', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

app.post('/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  const validUser = process.env.ADMIN_USERNAME || 'admin';
  const validPass = process.env.ADMIN_PASSWORD || 'changeme';

  if (username === validUser && password === validPass) {
    const token = signToken(`user=${username}&ts=${Date.now()}`);
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Strict`);
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

app.get('/auth/logout', (_req: Request, res: Response) => {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0`);
  res.redirect('/login');
});

// All routes below require auth
app.use(requireAuth);

app.use(express.static(path.join(__dirname, '../public')));

// ============ ROUTES ============

// Home page
app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// OAuth: Initiate Shopify auth
app.get('/auth', (_req: Request, res: Response) => {
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const shop = process.env.SHOPIFY_STORE_URL;
  const appUrl = process.env.APP_URL || 'https://shopify.ramola.app';

  if (!clientId || !shop) {
    return res.status(500).send('Missing SHOPIFY_CLIENT_ID or SHOPIFY_STORE_URL in environment');
  }

  const redirectUri = `${appUrl}/auth/callback`;
  const scopes = 'write_products,read_products';
  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  res.redirect(installUrl);
});

// OAuth: Callback from Shopify
app.get('/auth/callback', async (req: Request, res: Response) => {
  const { shop, code } = req.query as { shop: string; code: string };
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!shop || !code || !clientId || !clientSecret) {
    return res.status(400).send('Missing required OAuth parameters');
  }

  try {
    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });

    const data = await response.json() as { access_token: string };

    if (!data.access_token) {
      return res.status(400).send('Failed to get access token');
    }

    // Persist token to file
    fs.writeFileSync(TOKEN_FILE, JSON.stringify({ accessToken: data.access_token, shop }));
    console.log(`✅ OAuth complete for ${shop}`);

    res.redirect('/');
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).send('OAuth failed');
  }
});

// API: Get server-side config (whether credentials are pre-configured)
app.get('/api/config', (_req: Request, res: Response) => {
  const { accessToken, shop } = getCredentials();
  res.json({
    hasCredentials: !!(shop && accessToken),
    storeUrl: shop,
  });
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
    const { productsFile } = req.body;
    const creds = getCredentials();
    const storeUrl = req.body.storeUrl || creds.shop;
    const accessToken = req.body.accessToken || creds.accessToken;

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
