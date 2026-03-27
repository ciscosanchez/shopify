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
 * Convert CSV rows to Shopify product JSON format
 * Maps common CSV column names to product fields
 */
export function convertToProducts(rows: CsvRow[]): any[] {
  const products: any[] = [];

  rows.forEach((row) => {
    // Only process rows with a title
    if (!row.title && !row.name && !row.product && !row['product name']) {
      return;
    }

    const title = row.title || row.name || row.product || row['product name'];
    if (!title.trim()) return;

    const product: any = {
      title: title.trim(),
    };

    // Map optional fields
    if (row.handle) product.handle = row.handle.trim();
    if (row.description || row.desc || row['body html'])
      product.bodyHtml = `<p>${(row.description || row.desc || row['body html']).trim()}</p>`;
    if (row.vendor || row.brand) product.vendor = (row.vendor || row.brand).trim();
    if (row['product type'] || row.type) product.productType = (row['product type'] || row.type).trim();
    if (row.tags) product.tags = row.tags.trim();
    if (row.status) product.status = row.status.trim();

    // Handle variants (sku, price, compare_at_price, inventory_quantity)
    if (row.sku || row.price || row['compare at price'] || row.inventory) {
      const variant: any = {};

      if (row['variant title'] || row.size || row.color) {
        variant.title = (row['variant title'] || row.size || row.color || '').trim();
      }

      if (row.sku) variant.sku = row.sku.trim();
      if (row.price) variant.price = row.price.trim();
      if (row['compare at price'] || row['compare_at_price']) {
        variant.compareAtPrice = (row['compare at price'] || row['compare_at_price']).trim();
      }
      if (row.barcode) variant.barcode = row.barcode.trim();
      if (row.weight) variant.weight = parseFloat(row.weight);
      if (row['weight unit'] || row['weight_unit']) {
        variant.weightUnit = (row['weight unit'] || row['weight_unit']).trim();
      }
      if (row.inventory || row['inventory quantity'] || row['inventory_quantity']) {
        const qty = row.inventory || row['inventory quantity'] || row['inventory_quantity'];
        variant.inventoryQuantity = parseInt(qty, 10);
      }
      if (row['inventory management'] || row['inventory_management']) {
        variant.inventoryManagement = (
          row['inventory management'] || row['inventory_management']
        ).trim();
      }

      product.variants = [variant];
    }

    // Handle images (image url, image alt)
    if (row['image url'] || row['image'] || row['image_url']) {
      const imageUrl = row['image url'] || row['image'] || row['image_url'];
      if (imageUrl.trim()) {
        product.images = [
          {
            src: imageUrl.trim(),
            alt: (row['image alt'] || row['image_alt'] || '').trim() || undefined,
          },
        ];
      }
    }

    products.push(product);
  });

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
  return `title,handle,description,vendor,product type,tags,sku,price,compare at price,inventory quantity,image url,image alt
Wireless Headphones,wireless-headphones,Premium wireless headphones with noise cancellation,AudioPro,Electronics,headphones wireless audio,WBH-001,199.99,249.99,50,https://example.com/headphones.jpg,Wireless Headphones
Water Bottle,water-bottle,Insulated water bottle keeps drinks cold for 24 hours,HydroFlex,Sports,water bottle insulated,WB-001,34.99,44.99,100,https://example.com/water-bottle.jpg,Water Bottle
T-Shirt,t-shirt,Comfortable organic cotton t-shirt,EcoWear,Apparel,shirt cotton,TS-001,29.99,39.99,75,https://example.com/tshirt.jpg,T-Shirt`;
}
