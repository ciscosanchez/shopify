import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { ShopifyAPI } from './api.js';
import { parseProductsFile } from './parser.js';
import { ProductUploader, formatResult } from './uploader.js';
import { convertCSVToJSON, generateSampleCSV } from './csv-converter.js';

async function main() {
  try {
    const command = process.argv[2];
    const arg = process.argv[3];

    // Handle CSV conversion command
    if (command === 'convert') {
      await handleConvert(arg);
      return;
    }

    // Handle sample command
    if (command === 'sample') {
      await handleSample();
      return;
    }

    // Handle web UI command
    if (command === 'web') {
      console.log('Starting web UI...');
      const { startWebServer } = await import('./web-server.js');
      const port = process.env.PORT || '3000';
      startWebServer(parseInt(port as string, 10));
      return;
    }

    // Default: upload products
    await handleUpload(command);
  } catch (error) {
    console.error('❌ Fatal error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function handleConvert(csvFilePath?: string) {
  if (!csvFilePath) {
    console.error('❌ Usage: npm run convert <csv-file>');
    console.error('\nExample: npm run convert products.csv');
    process.exit(1);
  }

  console.log(`📂 Converting CSV file: ${csvFilePath}\n`);

  const result = await convertCSVToJSON(csvFilePath);

  if (!result.success) {
    console.error('❌ Conversion failed:');
    result.errors.forEach((err) => console.error(`   - ${err}`));
    process.exit(1);
  }

  console.log(`✅ Conversion successful!`);
  console.log(`📊 Products: ${result.productCount}`);
  console.log(`💾 Output: ${result.outputFile}\n`);
  console.log('💡 Next: Edit the JSON file (if needed) and run: npm run upload ' + path.basename(result.outputFile));
}

async function handleSample() {
  const sampleCsv = generateSampleCSV();
  const outputFile = 'sample-products.csv';

  fs.writeFileSync(outputFile, sampleCsv);
  console.log(`✅ Sample CSV file created: ${outputFile}`);
  console.log('\n📝 Sample contents (3 products):');
  console.log(sampleCsv);
  console.log('\n💡 Edit this file and convert it: npm run convert sample-products.csv');
}

async function handleUpload(productsFile?: string) {
  // Validate environment
  const storeUrl = process.env.SHOPIFY_STORE_URL;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  const rateLimitMs = parseInt(process.env.RATE_LIMIT_MS || '500', 10);
  const debug = process.env.DEBUG === 'true';

  if (!storeUrl || !accessToken) {
    console.error('❌ Missing required environment variables:');
    console.error('   - SHOPIFY_STORE_URL');
    console.error('   - SHOPIFY_ACCESS_TOKEN');
    console.error('\nCreate a .env file (copy from .env.example) with your Shopify credentials.');
    process.exit(1);
  }

  // Look for products file
  let file = productsFile || 'products.json';

  if (!fs.existsSync(file)) {
    console.error(`❌ Products file not found: ${file}`);
    console.error(`\nCreate a ${file} file with your products. See README.md for format.`);
    process.exit(1);
  }

  // Parse products
  console.log(`📂 Reading products from: ${path.resolve(file)}`);
  const { products, errors: parseErrors } = await parseProductsFile(file);

  if (parseErrors.length > 0) {
    console.warn(`\n⚠️  ${parseErrors.length} products have validation errors:\n`);
    parseErrors.forEach((err) => {
      console.warn(`  Product ${err.index}: ${err.error}`);
    });
    console.warn('');
  }

  if (products.length === 0) {
    console.error('❌ No valid products found in file.');
    process.exit(1);
  }

  console.log(`✅ Found ${products.length} valid products\n`);

  // Create API client
  const api = new ShopifyAPI(storeUrl, accessToken, debug);

  // Upload products
  const uploader = new ProductUploader(api, rateLimitMs, debug);
  const result = await uploader.uploadProducts(products);

  // Print summary
  console.log(formatResult(result));

  // Exit with error code if any failed
  process.exit(result.failed > 0 ? 1 : 0);
}

main();
