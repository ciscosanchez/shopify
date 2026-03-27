# Quick Start Guide

Choose your preferred method and get started in 5 minutes.

## 🌐 Method 1: Web UI (Easiest - No Terminal Knowledge Needed)

### Step 1: Prerequisites
- Node.js installed (download from nodejs.org)
- Shopify API credentials (see below)

### Step 2: Start the Web Server
```bash
npm install
npm run web
```

### Step 3: Use the Web Interface
1. Open http://localhost:3000 in your browser
2. Enter your Shopify Store URL and Access Token
3. Upload CSV or JSON file with products
4. Watch the upload progress
5. Done! 🎉

**Advantages:**
- ✅ No terminal experience needed
- ✅ Drag-and-drop file upload
- ✅ Real-time progress tracking
- ✅ Beautiful UI
- ✅ Automatically converts CSV to JSON

---

## 💻 Method 2: Command Line (For Developers)

### Step 1: Setup
```bash
cp .env.example .env
# Edit .env with your Shopify credentials
npm install
```

### Step 2: Upload Products
```bash
# From products.json
npm run upload

# From custom file
npm run upload my-products.json
```

### Step 3: Convert CSV First (Optional)
```bash
npm run sample                  # Create sample CSV
npm run convert products.csv    # Convert CSV to JSON
npm run upload products-converted.json
```

**Advantages:**
- ✅ Direct control
- ✅ No browser needed
- ✅ Perfect for automation

---

## 🐳 Method 3: Docker (One-Command Deployment)

### Step 1: Setup
```bash
cp .env.example .env
# Edit .env with your Shopify credentials
```

### Step 2: Start
```bash
docker-compose up -d
```

### Step 3: Use
- Web UI: Open http://localhost:3000
- CLI: `docker-compose run shopify-importer npm run upload`

**Advantages:**
- ✅ Isolated environment
- ✅ No dependency conflicts
- ✅ Easy deployment
- ✅ Perfect for teams

---

## Get Your Shopify API Credentials (All Methods)

1. Go to https://admin.shopify.com
2. **Settings** → **Apps and integrations**
3. Click **Develop apps** (enable if needed)
4. **Create an app** → Name: "Product Importer"
5. **Configuration** → **Admin API**
6. Enable scopes:
   - ✅ `write_products`
   - ✅ `read_products`
7. **API Credentials** → Copy your **Access token**

You now have:
- **Store URL**: `your-store.myshopify.com`
- **Access Token**: `shpat_xxxxx...` (keep this secret!)

---

## Prepare Your Products

### Option A: CSV File (Easiest)
Create a spreadsheet with headers:
- `title` (required)
- `sku`, `price`, `inventory quantity` (optional)
- `vendor`, `description`, `tags` (optional)

**Example:**
```csv
title,vendor,sku,price,inventory quantity
Wireless Headphones,AudioPro,WBH-001,199.99,50
Water Bottle,HydroFlex,WB-001,34.99,100
```

### Option B: JSON File
```json
[
  {
    "title": "Wireless Headphones",
    "vendor": "AudioPro",
    "sku": "WBH-001",
    "price": "199.99",
    "variants": [
      { "title": "Black", "sku": "WBH-BLK", "price": "199.99" }
    ]
  }
]
```

---

## Common Workflows

### I have a spreadsheet with products
1. Export as CSV from Excel/Google Sheets
2. Use **Method 1 (Web UI)** or run `npm run convert products.csv`

### I want to upload 60 products now
1. Use **Method 1 (Web UI)** - drag, drop, upload
2. Takes ~2-3 minutes with 500ms rate limiting

### I want to automate this
1. Use **Method 2 (CLI)** or **Method 3 (Docker)**
2. Can be run from a cron job or script

### I want to deploy for my team
1. Use **Method 3 (Docker)**
2. Share the URL: `http://your-domain:3000`

---

## Troubleshooting

### "npm: command not found"
Install Node.js from nodejs.org and restart your terminal.

### "Invalid credentials"
Double-check your Store URL and Access Token in Shopify Admin.

### "Invalid JSON"
Use the **Web UI** - it handles validation automatically.

### Products not uploading
Check your internet connection and Shopify API rate limits.

---

## What's Next?

After uploading:
1. Check your Shopify Admin to see new products
2. Edit product details as needed
3. Upload images directly in Shopify Admin
4. Publish products to your store

---

## Support

See README.md for detailed documentation.

- Web UI: http://localhost:3000 (includes help section)
- Commands: `npm run --help`
- Issues: Check upload-errors.json for details

---

**Ready?** Pick a method above and get started! 🚀
