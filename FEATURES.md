# Features Overview

## Complete Product Importer Suite

This tool provides three ways to bulk upload products to Shopify:

### 🌐 Web UI
- **Drag-and-drop file upload** (JSON or CSV)
- **Real-time progress tracking** with visual progress bar
- **Automatic CSV-to-JSON conversion**
- **Test connection** button for API credentials
- **Local credential storage** (browser localStorage)
- **Detailed error reporting** with product-level error messages
- **Upload session management** - resume status from browser
- **Responsive design** - works on desktop and mobile
- **Help documentation** embedded in the UI

### 💻 CLI Tools

#### Upload Command
```bash
npm run upload [file.json]
```
- Upload JSON products directly
- Rate limiting to respect Shopify API limits
- Progress bar with real-time updates
- Detailed error report (saved to `upload-errors.json`)
- Exit codes for automation

#### CSV Converter
```bash
npm run convert products.csv
```
- Auto-detect column headers
- Handle quoted fields and escaped characters
- Map common column names to Shopify fields
- Generate `products-converted.json` ready to upload
- Detailed conversion error messages

#### Sample Generator
```bash
npm run sample
```
- Generate example CSV with 3 sample products
- Use as template for your data
- Shows all supported columns and formats

### 🐳 Docker
- **One-command deployment**: `docker-compose up -d`
- **Persistent volumes** for uploads and configuration
- **Alpine Linux** for small image size
- **Pre-built and optimized** Node.js environment
- **Environment variable configuration**
- **CLI and Web UI** both supported in container

---

## Data Format Support

### CSV Columns (Auto-Detected)
| Column | Type | Notes |
|--------|------|-------|
| `title` | required | Product name |
| `handle` | optional | URL slug (auto-generated if missing) |
| `description` / `desc` / `body html` | optional | Product description |
| `vendor` / `brand` | optional | Brand/manufacturer |
| `product type` / `type` | optional | Category |
| `tags` | optional | Comma-separated tags |
| `sku` | optional | Stock keeping unit |
| `price` | optional | Selling price |
| `compare at price` / `compare_at_price` | optional | Strikethrough price |
| `barcode` | optional | Barcode/UPC |
| `weight` | optional | Product weight |
| `weight unit` / `weight_unit` | optional | g, kg, lb, oz |
| `inventory quantity` / `inventory_quantity` | optional | Starting stock |
| `inventory management` / `inventory_management` | optional | shopify, not_managed, external |
| `image url` / `image` | optional | Product image URL |
| `image alt` / `image_alt` | optional | Image alt text |
| `variant title` / `size` / `color` | optional | Variant name |
| `status` | optional | active, draft, archived |

### JSON Format
```json
[
  {
    "title": "string (required)",
    "handle": "string",
    "bodyHtml": "string",
    "vendor": "string",
    "productType": "string",
    "tags": "string (comma-separated)",
    "status": "active|draft|archived",
    "variants": [
      {
        "title": "string",
        "sku": "string",
        "price": "string",
        "compareAtPrice": "string",
        "barcode": "string",
        "weight": "number",
        "weightUnit": "string",
        "inventoryQuantity": "number",
        "inventoryManagement": "string"
      }
    ],
    "images": [
      {
        "src": "string (required)",
        "alt": "string"
      }
    ]
  }
]
```

---

## API Integration

### Shopify GraphQL API
- Uses Shopify's 2024-01 GraphQL API
- **Automatic mutations** for product creation
- **Rate limiting** (configurable, default 2 req/sec)
- **Error handling** with detailed messages
- **Duplicate detection** by product handle

### Connection Testing
- `POST /api/session` - Check upload status
- `POST /api/upload` - Upload and validate file
- `POST /api/upload/shopify` - Start Shopify import

---

## Error Handling

### Validation Errors
- CSV parsing errors caught and reported
- JSON schema validation on all products
- Field type checking (string, number, etc.)
- Required field detection
- Clear error messages per product

### Upload Errors
- API connection failures
- Invalid credentials
- Rate limit detection
- Shopify API errors (e.g., duplicate SKU)
- Partial upload recovery (failed products saved)

### Error Reporting
- **CLI**: Saves to `upload-errors.json`
- **Web UI**: Displays in results section with product details
- **Docker**: Persisted in volumes for inspection

---

## Performance

### Rate Limiting
- Default: 500ms between requests (2 req/sec)
- Configurable via `RATE_LIMIT_MS` env var
- Respects Shopify's API rate limits
- Automatic backoff on rate limit hits

### Upload Speed
- 60 products: ~2-3 minutes
- 100 products: ~5 minutes
- Scales linearly with product count

### Deduplication
- Checks product handle before creating
- Skips existing products (no re-upload)
- Saves API calls and time

---

## Security

### Credentials
- Never stored in code
- Only in `.env` file (git-ignored)
- Browser localStorage for web UI (optional)
- Encrypted in transit via HTTPS

### File Handling
- Uploaded files stored in `/uploads` (temporary)
- Deleted after successful upload
- No data sent to third parties
- All processing local

### API
- Uses Shopify's official GraphQL API
- Admin API scopes limited to:
  - `write_products`
  - `read_products`
- No write access to other resources

---

## Monitoring & Logging

### CLI Output
- Real-time progress with emoji status
- Product-by-product feedback
- Summary statistics
- Error details with product info

### Web UI
- Progress bar (0-100%)
- Item count (X of Y)
- Status badges (✅ Created, ⏭️ Skipped, ❌ Failed)
- Error list with product index and message

### Logs
- Optional debug mode via `DEBUG=true`
- Detailed API request/response logging
- Error stack traces
- Performance metrics

---

## Extensibility

### Add Custom Fields
Modify the product JSON schema in `src/api.ts`:
```typescript
// Add new fields to ShopifyProduct interface
interface ShopifyProduct {
  // ... existing fields
  customField: string; // new field
}
```

### Add New CSV Columns
Update `src/csv-converter.ts` `convertToProducts()` function:
```typescript
if (row['custom field']) {
  product.customField = row['custom field'].trim();
}
```

### Customize UI
Edit `public/index.html` and `public/style.css`:
- Add sections for new features
- Modify colors and layout
- Add validation logic in `public/app.js`

---

## Deployment Options

### Local Development
```bash
npm install
npm run web
```

### Production (Node.js)
```bash
npm run build
npm start
```

### Docker
```bash
docker-compose up -d
```

### Cloud (Heroku, AWS, etc.)
1. Build: `npm run build`
2. Start: `npm start`
3. Port: 3000 (configurable via `PORT` env var)

---

## Comparison: CLI vs Web UI vs Docker

| Feature | CLI | Web UI | Docker |
|---------|-----|--------|--------|
| **Terminal needed** | ✅ | ❌ | ✅ |
| **Tech knowledge needed** | ✅ | ❌ | ✅ |
| **Easy file upload** | ⚠️ (file path) | ✅ (drag-drop) | ⚠️ (CLI args) |
| **Real-time progress** | ✅ | ✅ | ✅ (web mode) |
| **Error details** | ✅ (console) | ✅ (UI) | ✅ (both) |
| **Automation ready** | ✅ | ❌ | ✅ |
| **Works on Windows** | ✅ | ✅ | ✅ (Docker required) |
| **Works on Mac** | ✅ | ✅ | ✅ |
| **Works on Linux** | ✅ | ✅ | ✅ |

---

## What's Included

```
shopify/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── api.ts                # Shopify API client
│   ├── parser.ts             # JSON/CSV parsing & validation
│   ├── csv-converter.ts      # CSV to JSON conversion
│   ├── uploader.ts           # Upload logic & progress tracking
│   └── web-server.ts         # Express web server
├── public/
│   ├── index.html            # Web UI
│   ├── style.css             # Styling
│   └── app.js                # Client-side logic
├── products.json             # Example products
├── sample-products.csv       # Example CSV
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
├── Dockerfile                # Docker image
├── docker-compose.yml        # Docker Compose config
├── .env.example              # Environment template
├── .gitignore                # Git ignore rules
├── .dockerignore             # Docker ignore rules
├── README.md                 # Full documentation
├── QUICKSTART.md             # Quick start guide
└── FEATURES.md               # This file
```

---

## Future Enhancements

Potential additions:
- [ ] Batch update (edit existing products)
- [ ] Product collections management
- [ ] Inventory sync
- [ ] Multi-image upload
- [ ] Product variants editor
- [ ] Schedule uploads
- [ ] Webhook integration
- [ ] Admin API polling
- [ ] Product templates
- [ ] Bulk pricing rules
