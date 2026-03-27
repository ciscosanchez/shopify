import { ShopifyAPI, ShopifyProduct } from './api.js';

export interface UploadResult {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: UploadError[];
  duration: number;
}

export interface UploadError {
  index: number;
  title: string;
  error: string;
}

export class ProductUploader {
  private api: ShopifyAPI;
  private rateLimitMs: number;
  private debug: boolean;

  constructor(api: ShopifyAPI, rateLimitMs = 500, debug = false) {
    this.api = api;
    this.rateLimitMs = rateLimitMs;
    this.debug = debug;
  }

  async uploadProducts(products: ShopifyProduct[]): Promise<UploadResult> {
    const startTime = Date.now();
    const errors: UploadError[] = [];
    let successful = 0;
    let skipped = 0;

    console.log(`\n📦 Starting upload of ${products.length} products...\n`);

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const progress = `[${i + 1}/${products.length}]`;

      try {
        // Check if product already exists
        const handle = product.handle || this.generateHandle(product.title);
        const exists = await this.api.checkProductExists(handle);

        if (exists) {
          console.log(`${progress} ⏭️  Skipping: ${product.title} (already exists)`);
          skipped++;
        } else {
          await this.api.createProduct(product);
          console.log(`${progress} ✅ Created: ${product.title}`);
          successful++;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(`${progress} ❌ Failed: ${product.title}`);
        console.log(`    Error: ${errorMsg}`);
        errors.push({
          index: i,
          title: product.title,
          error: errorMsg,
        });
      }

      // Rate limiting (except for last item)
      if (i < products.length - 1) {
        await this.delay(this.rateLimitMs);
      }
    }

    const duration = Date.now() - startTime;

    return {
      total: products.length,
      successful,
      failed: errors.length,
      skipped,
      errors,
      duration,
    };
  }

  private generateHandle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export function formatResult(result: UploadResult): string {
  const durationSec = (result.duration / 1000).toFixed(1);
  const lines: string[] = [];

  lines.push('\n' + '='.repeat(50));
  lines.push('📊 UPLOAD SUMMARY');
  lines.push('='.repeat(50));
  lines.push(`Total:      ${result.total}`);
  lines.push(`✅ Created: ${result.successful}`);
  lines.push(`⏭️  Skipped: ${result.skipped}`);
  lines.push(`❌ Failed:  ${result.failed}`);
  lines.push(`⏱️  Time:    ${durationSec}s`);
  lines.push('='.repeat(50));

  if (result.errors.length > 0) {
    lines.push('\n⚠️  FAILED PRODUCTS:');
    lines.push('-'.repeat(50));
    result.errors.forEach((err) => {
      lines.push(`  [${err.index}] ${err.title}`);
      lines.push(`      ${err.error}`);
    });

    // Save errors to file
    const errorFile = 'upload-errors.json';
    const errorData = {
      timestamp: new Date().toISOString(),
      errors: result.errors,
    };

    try {
      require('fs').writeFileSync(errorFile, JSON.stringify(errorData, null, 2));
      lines.push(`\n💾 Errors saved to: ${errorFile}`);
    } catch (e) {
      // Silent fail
    }
  }

  return lines.join('\n');
}
