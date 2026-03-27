import fs from 'fs';
import path from 'path';
import { ShopifyProduct } from './api.js';

export interface ParsedProducts {
  products: ShopifyProduct[];
  errors: ParseError[];
}

export interface ParseError {
  index: number;
  error: string;
}

export async function parseProductsFile(filePath: string): Promise<ParsedProducts> {
  // Resolve relative paths from current working directory
  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  const content = fs.readFileSync(resolvedPath, 'utf-8');
  const products: ShopifyProduct[] = [];
  const errors: ParseError[] = [];

  try {
    const data = JSON.parse(content);

    if (!Array.isArray(data)) {
      throw new Error('Products file must contain an array of products');
    }

    data.forEach((item, index) => {
      try {
        const validated = validateProduct(item);
        products.push(validated);
      } catch (error) {
        errors.push({
          index,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in products file: ${error.message}`);
    }
    throw error;
  }

  return { products, errors };
}

function validateProduct(item: unknown): ShopifyProduct {
  if (typeof item !== 'object' || item === null) {
    throw new Error('Product must be an object');
  }

  const obj = item as Record<string, unknown>;

  if (!obj.title || typeof obj.title !== 'string') {
    throw new Error('Product must have a "title" (string)');
  }

  const product: ShopifyProduct = {
    title: obj.title,
  };

  // Optional fields
  if (obj.handle) {
    if (typeof obj.handle !== 'string') throw new Error('handle must be a string');
    product.handle = obj.handle;
  }

  if (obj.bodyHtml) {
    if (typeof obj.bodyHtml !== 'string') throw new Error('bodyHtml must be a string');
    product.bodyHtml = obj.bodyHtml;
  }

  if (obj.vendor) {
    if (typeof obj.vendor !== 'string') throw new Error('vendor must be a string');
    product.vendor = obj.vendor;
  }

  if (obj.productType) {
    if (typeof obj.productType !== 'string') throw new Error('productType must be a string');
    product.productType = obj.productType;
  }

  if (obj.tags) {
    if (typeof obj.tags !== 'string') throw new Error('tags must be a string');
    product.tags = obj.tags;
  }

  if (obj.status) {
    if (typeof obj.status !== 'string' || !['active', 'archived', 'draft'].includes(obj.status)) {
      throw new Error('status must be "active", "archived", or "draft"');
    }
    product.status = obj.status as 'active' | 'archived' | 'draft';
  }

  // Variants
  if (obj.variants) {
    if (!Array.isArray(obj.variants)) throw new Error('variants must be an array');
    product.variants = obj.variants.map((v, idx) => {
      if (typeof v !== 'object' || v === null) {
        throw new Error(`variant[${idx}] must be an object`);
      }
      return validateVariant(v as Record<string, unknown>, idx);
    });
  }

  // Images
  if (obj.images) {
    if (!Array.isArray(obj.images)) throw new Error('images must be an array');
    product.images = obj.images.map((img, idx) => {
      if (typeof img !== 'object' || img === null) {
        throw new Error(`image[${idx}] must be an object`);
      }
      return validateImage(img as Record<string, unknown>, idx);
    });
  }

  // Metafields
  if (obj.metafields) {
    if (!Array.isArray(obj.metafields)) throw new Error('metafields must be an array');
    product.metafields = obj.metafields.map((mf, idx) => {
      if (typeof mf !== 'object' || mf === null) {
        throw new Error(`metafield[${idx}] must be an object`);
      }
      return validateMetafield(mf as Record<string, unknown>, idx);
    });
  }

  return product;
}

function validateVariant(obj: Record<string, unknown>, index: number) {
  const variant: any = {};

  if (obj.title && typeof obj.title !== 'string')
    throw new Error(`variant[${index}] title must be a string`);
  if (obj.sku && typeof obj.sku !== 'string')
    throw new Error(`variant[${index}] sku must be a string`);
  if (obj.price && typeof obj.price !== 'string')
    throw new Error(`variant[${index}] price must be a string`);
  if (obj.compareAtPrice && typeof obj.compareAtPrice !== 'string')
    throw new Error(`variant[${index}] compareAtPrice must be a string`);
  if (obj.barcode && typeof obj.barcode !== 'string')
    throw new Error(`variant[${index}] barcode must be a string`);
  if (obj.weight && typeof obj.weight !== 'number')
    throw new Error(`variant[${index}] weight must be a number`);
  if (obj.weightUnit && typeof obj.weightUnit !== 'string')
    throw new Error(`variant[${index}] weightUnit must be a string`);
  if (obj.inventoryQuantity && typeof obj.inventoryQuantity !== 'number')
    throw new Error(`variant[${index}] inventoryQuantity must be a number`);

  Object.assign(variant, obj);
  return variant;
}

function validateImage(obj: Record<string, unknown>, index: number) {
  if (!obj.src || typeof obj.src !== 'string') {
    throw new Error(`image[${index}] must have a "src" (string)`);
  }

  const image: any = { src: obj.src };
  if (obj.alt && typeof obj.alt === 'string') {
    image.alt = obj.alt;
  }

  return image;
}

function validateMetafield(obj: Record<string, unknown>, index: number) {
  if (!obj.namespace || typeof obj.namespace !== 'string')
    throw new Error(`metafield[${index}] must have "namespace" (string)`);
  if (!obj.key || typeof obj.key !== 'string')
    throw new Error(`metafield[${index}] must have "key" (string)`);
  if (!obj.type || typeof obj.type !== 'string')
    throw new Error(`metafield[${index}] must have "type" (string)`);
  if (!obj.value) throw new Error(`metafield[${index}] must have "value"`);

  return {
    namespace: obj.namespace,
    key: obj.key,
    type: obj.type,
    value: String(obj.value),
  };
}
