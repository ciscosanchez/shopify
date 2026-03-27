# Shopify Product Importer

Bulk upload 60 products to your Shopify store in minutes. Choose your workflow:

- **🌐 Web UI** - Easy drag-and-drop interface (no terminal needed)
- **💻 CLI** - Command-line for developers
- **🐳 Docker** - One-command deployment

## Setup (Choose One Method)

### Method 1: Web UI (Recommended for Non-Technical Users)

**Fastest way to get started with a user-friendly interface.**

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the web server:
   ```bash
   npm run web
   ```

3. Open http://localhost:3000 in your browser

4. Enter your Shopify credentials (created below)

5. Upload CSV or JSON file with products

6. Click "Upload to Shopify" and watch progress in real-time

**That's it!** No terminal commands, no JSON editing.

### Method 2: CLI (For Developers)

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your Shopify credentials

3. Install dependencies:
   ```bash
   npm install
   ```

4. Upload products from JSON:
   ```bash
   npm run upload products.json
   ```

   Or convert CSV first, then upload:
   ```bash
   npm run convert products.csv
   npm run upload products-converted.json
   ```

### Method 3: Docker (Easy Deployment)

**One-command deployment with Docker Compose.**

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your Shopify credentials

3. Start the importer:
   ```bash
   docker-compose up -d
   ```

4. Open http://localhost:3000

5. To stop:
   ```bash
   docker-compose down
   ```

**CLI via Docker:**
```bash
# Convert CSV
docker-compose run shopify-importer npm run convert products.csv

# Upload from JSON
docker-compose run shopify-importer npm run upload products.json
```

### Get Your Shopify API Credentials

1. Go to [Shopify Admin](https://admin.shopify.com)
2. Navigate to **Settings** → **Apps and integrations**
3. Click **Develop apps** (enable if needed)
4. Create a new app: **Create an app** → Name it "Product Importer"
5. Go to **Configuration** → **Admin API**
6. Enable scopes:
   - `write_products`
   - `read_products`
7. Copy your **Access token** from **API Credentials** tab

That's it! You now have:
- **SHOPIFY_STORE_URL** (your-store.myshopify.com)
- **SHOPIFY_ACCESS_TOKEN** (shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx)

## Product Format

Your `products.json` file should be an array of products:

```json
[
  {
    "title": "Product Name",
    "handle": "product-name",
    "bodyHtml": "<p>Product description in HTML</p>",
    "vendor": "Brand Name",
    "productType": "Category",
    "tags": "tag1, tag2, tag3",
    "status": "active",
    "variants": [
      {
        "title": "Size - Color",
        "sku": "SKU-001",
        "price": "99.99",
        "compareAtPrice": "149.99",
        "inventoryQuantity": 50
      }
    ],
    "images": [
      {
        "src": "https://example.com/image.jpg",
        "alt": "Image description"
      }
    ]
  }
]
```

### Required Fields

- **title** (string) - Product name, e.g., "Wireless Headphones"

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `handle` | string | URL slug (auto-generated from title if not provided) |
| `bodyHtml` | string | Product description in HTML |
| `vendor` | string | Brand/manufacturer name |
| `productType` | string | Category/type |
| `tags` | string | Comma-separated tags |
| `status` | string | "active", "draft", or "archived" (default: "active") |
| `variants` | array | Product variants (sizes, colors, etc.) |
| `images` | array | Product images |

### Variant Fields (Optional)

```json
{
  "title": "Size - Color",      // e.g., "Large - Black"
  "sku": "SKU-001",              // Stock keeping unit
  "price": "99.99",              // Selling price
  "compareAtPrice": "149.99",    // Strikethrough price (shows discount)
  "barcode": "123456789",        // Barcode/UPC
  "weight": 1.5,                 // Weight (in kg if using kg unit)
  "weightUnit": "kg",            // "g", "kg", "lb", "oz"
  "inventoryQuantity": 50,       // Starting stock
  "inventoryManagement": "shopify" // "shopify", "not_managed", "external"
}
```

### Image Fields (Optional)

```json
{
  "src": "https://example.com/image.jpg",  // Required
  "alt": "Product image description"       // Optional alt text
}
```

## Examples

### Simple Product (Just Title)

```json
[
  {
    "title": "Basic Mug"
  }
]
```

### Product with Variants

```json
[
  {
    "title": "T-Shirt",
    "productType": "Apparel",
    "variants": [
      { "title": "Small - Blue", "sku": "TS-S-BLU", "price": "29.99" },
      { "title": "Medium - Blue", "sku": "TS-M-BLU", "price": "29.99" },
      { "title": "Large - Blue", "sku": "TS-L-BLU", "price": "29.99" },
      { "title": "Small - Red", "sku": "TS-S-RED", "price": "29.99" },
      { "title": "Medium - Red", "sku": "TS-M-RED", "price": "29.99" }
    ]
  }
]
```

### Product with Images and Description

```json
[
  {
    "title": "Premium Headphones",
    "vendor": "AudioPro",
    "bodyHtml": "<h3>Features</h3><ul><li>Noise cancellation</li><li>30-hour battery</li></ul>",
    "images": [
      {
        "src": "https://cdn.example.com/headphones-front.jpg",
        "alt": "Front view"
      },
      {
        "src": "https://cdn.example.com/headphones-side.jpg",
        "alt": "Side view"
      }
    ],
    "variants": [
      { "title": "Black", "sku": "HP-BLK", "price": "199.99" },
      { "title": "Silver", "sku": "HP-SLV", "price": "199.99" }
    ]
  }
]
```

## CSV to JSON Conversion

Got a spreadsheet? Convert it to JSON format automatically.

### Option A: Web UI (Easiest)

1. Start the web server: `npm run web`
2. Open http://localhost:3000
3. Upload your CSV file
4. The app auto-detects and converts it

### Option B: Command Line

```bash
# Generate a sample CSV
npm run sample

# Convert your CSV to JSON
npm run convert products.csv

# Upload the converted JSON
npm run upload products-converted.json
```

### CSV Column Headers

Your CSV should have a header row with these columns:

| Column | Required | Example |
|--------|----------|---------|
| title | ✓ | "Wireless Headphones" |
| handle | | "wireless-headphones" |
| description | | "Premium headphones with..." |
| vendor | | "AudioPro" |
| product type | | "Electronics" |
| tags | | "headphones, wireless" |
| sku | | "WBH-001" |
| price | | "199.99" |
| compare at price | | "249.99" |
| inventory quantity | | "50" |
| image url | | "https://example.com/img.jpg" |
| image alt | | "Product image" |

**Example CSV:**

```csv
title,vendor,sku,price,inventory quantity
Wireless Headphones,AudioPro,WBH-001,199.99,50
Water Bottle,HydroFlex,WB-001,34.99,100
T-Shirt,EcoWear,TS-001,29.99,75
```

## Commands

```bash
# Web UI
npm run web                          # Start web server on port 3000

# CLI - Upload
npm run upload                       # Upload from products.json
npm run upload custom-file.json      # Upload from custom file

# CLI - CSV Conversion
npm run sample                       # Generate sample CSV
npm run convert products.csv         # Convert CSV to JSON

# Development
npm run build                        # Compile TypeScript
npm run dev                          # Watch and rebuild
npm run lint                         # Check code quality
npm run format                       # Format code
```

## Docker Deployment

### Quick Start

```bash
cp .env.example .env
# Edit .env with your Shopify credentials
docker-compose up -d
```

Open http://localhost:3000

### Docker Commands

```bash
# Start in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Rebuild
docker-compose up -d --build

# CLI commands via Docker
docker-compose run shopify-importer npm run convert products.csv
docker-compose run shopify-importer npm run upload products.json
```

### Docker File Structure

The container includes:
- Node.js 18
- All dependencies pre-installed
- TypeScript compiled and ready
- Web UI on port 3000

### Environment in Docker

Set these in your `.env` file (same as non-Docker):

```
SHOPIFY_STORE_URL=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxx
RATE_LIMIT_MS=500
DEBUG=false
PORT=3000
```

### Persistent Files

In Docker, these are automatically persisted:
- `uploads/` - Uploaded files and conversions
- `products.json` - Your products file
- `.env` - Your credentials

## Troubleshooting

### "File not found: products.json"

Make sure you created the `products.json` file in the same folder as this README.

### "Invalid JSON"

Check your JSON syntax. Use a JSON validator: [jsonlint.com](https://www.jsonlint.com/)

Common issues:
- Missing commas between items
- Trailing commas (not allowed in JSON)
- Unescaped quotes in text
- Unclosed brackets

### "Missing SHOPIFY_STORE_URL"

Create a `.env` file with your Shopify credentials:

```bash
cp .env.example .env
# Then edit .env with your values
```

### "401 Unauthorized"

Your API token is invalid. Check that:
1. You copied the full token (including "shpat_" prefix)
2. There are no extra spaces or line breaks in `.env`
3. The app has "Admin API" scopes enabled
4. The app is in development mode (not archived)

### Upload Hangs

If the upload seems stuck, it's likely respecting Shopify's rate limits. This is normal. Let it finish.

To speed up: edit `.env` and lower `RATE_LIMIT_MS`:
```
RATE_LIMIT_MS=250
```

**Warning:** Too low can cause API rejections. 500ms is safe for most stores.

### Some Products Failed

Check `upload-errors.json` for details on which products failed and why. Fix those products and re-run the upload.

**Note:** Products that already exist will be skipped (not an error).

## How It Works

1. **Reads** your `products.json` file
2. **Validates** each product (checks required fields)
3. **Checks** if products already exist in your store (by handle)
4. **Creates** any missing products via Shopify API
5. **Respects rate limits** (Shopify allows 2 API calls/sec)
6. **Reports** successes, skips, and failures

## Rate Limiting

Shopify API is rate-limited. This script respects those limits by:
- Waiting 500ms between product creations (default)
- Auto-detecting and waiting if rate-limited by API

For large uploads (60+ products), expect ~1-2 minutes total.

## Support

If you encounter issues:

1. Check the error message in the console
2. Review `upload-errors.json` if it was created
3. Verify your `.env` credentials are correct
4. Make sure your JSON file is valid

## Advanced

### Custom Rate Limit

Edit `.env`:
```
RATE_LIMIT_MS=250
```

Lower = faster but more risk of hitting rate limits.

### Debug Mode

Edit `.env`:
```
DEBUG=true
```

Shows detailed API requests and responses.

### Upload Custom Products File

```bash
npm run upload my-products.json
```

## Security

- **Never commit `.env`** - it contains your API token
- **Keep your token secret** - don't share it
- **Rotate tokens** in Shopify Admin if compromised

The `.env` file is automatically ignored by git.

## License

ISC
