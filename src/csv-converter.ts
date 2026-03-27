import fs from 'fs';
import path from 'path';

export interface CsvRow {
  [key: string]: string;
}

export interface ConversionResult {
  success: boolean;
  productCount: number;
  outputFile: string;
  errors: string[];
}

/**
 * Parse CSV file (simple implementation without external libraries)
 * Handles basic CSV with quoted fields
 */
export function parseCSV(filePath: string): CsvRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim());

  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header row and one data row');
  }

  const headers = parseCSVLine(lines[0]);
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: CsvRow = {};

    headers.forEach((header, index) => {
      row[header.toLowerCase().trim()] = values[index] || '';
    });

    rows.push(row);
  }

  return rows;
}

/**
 * Parse a single CSV line, handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Convert CSV rows to Shopify product JSON format.
 * Supports both Shopify's native export format (multi-row variants)
 * and simple single-row-per-product formats.
 */
export function convertToProducts(rows: CsvRow[]): any[] {
  // Detect if this is Shopify's native format (has "url handle" column)
  const isShopifyFormat = rows.length > 0 && ('url handle' in rows[0] || 'title' in rows[0]);

  if (isShopifyFormat && rows.some(r => 'url handle' in r)) {
    return convertShopifyNativeFormat(rows);
  }
  return convertSimpleFormat(rows);
}

/**
 * Convert Shopify's native CSV export format.
 * Groups variant rows (empty Title, same URL handle) under their parent product.
 */
function convertShopifyNativeFormat(rows: CsvRow[]): any[] {
  const productMap = new Map<string, any>();
  const productOrder: string[] = [];

  for (const row of rows) {
    const title = row['title']?.trim();
    const handle = (row['url handle'] || row['handle'])?.trim();

    if (!handle) continue;

    // New product row (has a title)
    if (title) {
      const product: any = { title };

      if (handle) product.handle = handle;

      const desc = row['description'] || row['body html'] || '';
      if (desc.trim()) product.bodyHtml = desc.trim().startsWith('<') ? desc.trim() : `<p>${desc.trim()}</p>`;

      if (row['vendor']?.trim()) product.vendor = row['vendor'].trim();
      if (row['type']?.trim()) product.productType = row['type'].trim();
      if (row['product category']?.trim()) product.productCategory = row['product category'].trim();
      if (row['tags']?.trim()) product.tags = row['tags'].trim();

      const status = row['status']?.trim().toLowerCase();
      if (status) product.status = status === 'active' ? 'ACTIVE' : status === 'draft' ? 'DRAFT' : 'ACTIVE';

      if (row['seo title']?.trim()) product.seoTitle = row['seo title'].trim();
      if (row['seo description']?.trim()) product.seoDescription = row['seo description'].trim();

      // Options
      const options: any[] = [];
      for (let i = 1; i <= 3; i++) {
        const optName = row[`option${i} name`]?.trim();
        if (optName) options.push({ name: optName });
      }
      if (options.length) product.options = options;

      product.variants = [];
      product.images = [];

      productMap.set(handle, product);
      productOrder.push(handle);
    }

    const product = productMap.get(handle);
    if (!product) continue;

    // Build variant from this row
    const variant: any = {};
    if (row['sku']?.trim()) variant.sku = row['sku'].trim();
    if (row['barcode']?.trim()) variant.barcode = row['barcode'].trim();
    if (row['price']?.trim()) variant.price = row['price'].trim();
    if (row['compare-at price']?.trim()) variant.compareAtPrice = row['compare-at price'].trim();

    const weightGrams = row['weight value (grams)']?.trim();
    if (weightGrams) {
      variant.weight = parseFloat(weightGrams);
      variant.weightUnit = 'GRAMS';
    }

    const displayUnit = row['weight unit for display']?.trim();
    if (displayUnit) variant.weightUnit = displayUnit.toUpperCase();

    const qty = row['inventory quantity']?.trim();
    if (qty) variant.inventoryQuantity = parseInt(qty, 10);

    const inventoryTracker = row['inventory tracker']?.trim();
    if (inventoryTracker) variant.inventoryManagement = inventoryTracker.toUpperCase();

    const continueOos = row['continue selling when out of stock']?.trim().toUpperCase();
    if (continueOos) variant.inventoryPolicy = continueOos === 'TRUE' || continueOos === 'CONTINUE' ? 'CONTINUE' : 'DENY';

    const requiresShipping = row['requires shipping']?.trim().toUpperCase();
    if (requiresShipping) variant.requiresShipping = requiresShipping === 'TRUE';

    // Variant option values
    for (let i = 1; i <= 3; i++) {
      const optVal = row[`option${i} value`]?.trim();
      if (optVal) variant[`option${i}`] = optVal;
    }

    // Variant image
    const variantImg = row['variant image url']?.trim();
    if (variantImg) variant.imageSrc = variantImg;

    product.variants.push(variant);

    // Product image (only add if new src)
    const imgSrc = row['product image url']?.trim();
    const imgAlt = row['image alt text']?.trim() || '';
    const imgPos = parseInt(row['image position']?.trim() || '0', 10);
    if (imgSrc && !product.images.some((img: any) => img.src === imgSrc)) {
      product.images.push({ src: imgSrc, altText: imgAlt, position: imgPos || product.images.length + 1 });
    }
  }

  return productOrder.map(h => productMap.get(h)).filter(Boolean);
}

/**
 * Convert simple single-row-per-product CSV format.
 */
function convertSimpleFormat(rows: CsvRow[]): any[] {
  const products: any[] = [];

  for (const row of rows) {
    const title = (row.title || row.name || row.product || row['product name'])?.trim();
    if (!title) continue;

    const product: any = { title };

    if (row.handle) product.handle = row.handle.trim();

    const desc = row.description || row.desc || row['body html'] || '';
    if (desc.trim()) product.bodyHtml = `<p>${desc.trim()}</p>`;

    if (row.vendor || row.brand) product.vendor = (row.vendor || row.brand).trim();
    if (row['product type'] || row.type) product.productType = (row['product type'] || row.type).trim();
    if (row.tags) product.tags = row.tags.trim();
    if (row.status) product.status = row.status.trim().toUpperCase();

    const variant: any = {};
    if (row.sku) variant.sku = row.sku.trim();
    if (row.price) variant.price = row.price.trim();
    if (row['compare at price'] || row['compare_at_price'])
      variant.compareAtPrice = (row['compare at price'] || row['compare_at_price']).trim();
    if (row.barcode) variant.barcode = row.barcode.trim();
    if (row.weight) variant.weight = parseFloat(row.weight);
    if (row['weight unit'] || row['weight_unit'])
      variant.weightUnit = (row['weight unit'] || row['weight_unit']).trim().toUpperCase();
    const qty = row.inventory || row['inventory quantity'] || row['inventory_quantity'];
    if (qty) variant.inventoryQuantity = parseInt(qty, 10);

    if (Object.keys(variant).length) product.variants = [variant];

    const imgSrc = row['image url'] || row['image'] || row['image_url'] || row['product image url'];
    if (imgSrc?.trim()) {
      product.images = [{ src: imgSrc.trim(), altText: (row['image alt'] || row['image alt text'] || '').trim() }];
    }

    products.push(product);
  }

  return products;
}

/**
 * Convert CSV file to Shopify product JSON
 */
export async function convertCSVToJSON(
  csvFilePath: string,
  outputPath?: string
): Promise<ConversionResult> {
  try {
    const resolvedCsvPath = path.resolve(csvFilePath);

    if (!fs.existsSync(resolvedCsvPath)) {
      throw new Error(`CSV file not found: ${resolvedCsvPath}`);
    }

    // Parse CSV
    const rows = parseCSV(resolvedCsvPath);

    if (rows.length === 0) {
      throw new Error('No data rows found in CSV file');
    }

    // Convert to products
    const products = convertToProducts(rows);

    if (products.length === 0) {
      throw new Error('No valid products could be extracted from CSV');
    }

    // Write output
    const outputFile = outputPath || 'products-converted.json';
    const resolvedOutputPath = path.resolve(outputFile);

    fs.writeFileSync(resolvedOutputPath, JSON.stringify(products, null, 2));

    return {
      success: true,
      productCount: products.length,
      outputFile: resolvedOutputPath,
      errors: [],
    };
  } catch (error) {
    return {
      success: false,
      productCount: 0,
      outputFile: '',
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

/**
 * Generate a sample CSV for users
 */
export function generateSampleCSV(): string {
  return `Title,URL handle,Description,Vendor,Type,Tags,Status,SKU,Barcode,Option1 name,Option1 value,Option2 name,Option2 value,Price,Compare-at price,Inventory quantity,Weight value (grams),Requires shipping,Product image URL,Image alt text
Wireless Headphones,wireless-headphones,Premium wireless headphones with noise cancellation,AudioPro,Electronics,"headphones,wireless,audio",Active,WBH-BLK,,Color,Black,,, 199.99,249.99,50,300,TRUE,https://example.com/headphones.jpg,Wireless Headphones Black
,wireless-headphones,,,,,,WBH-WHT,,,White,,,199.99,249.99,35,300,TRUE,https://example.com/headphones-white.jpg,Wireless Headphones White
Water Bottle,water-bottle,Insulated water bottle keeps drinks cold for 24 hours,HydroFlex,Sports,"water bottle,insulated",Active,WB-001,,Title,Default,,,34.99,44.99,100,500,TRUE,https://example.com/water-bottle.jpg,Water Bottle`;
}
