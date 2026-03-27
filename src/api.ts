import axios, { AxiosInstance } from 'axios';

export interface ShopifyProduct {
  title: string;
  handle?: string;
  bodyHtml?: string;
  vendor?: string;
  productType?: string;
  tags?: string;
  status?: 'active' | 'archived' | 'draft';
  variants?: ShopifyVariant[];
  images?: ShopifyImage[];
  metafields?: ShopifyMetafield[];
}

export interface ShopifyVariant {
  title?: string;
  sku?: string;
  price?: string;
  compareAtPrice?: string;
  barcode?: string;
  weight?: number;
  weightUnit?: string;
  inventoryQuantity?: number;
  inventoryManagement?: 'shopify' | 'not_managed' | 'external';
}

export interface ShopifyImage {
  src: string;
  alt?: string;
}

export interface ShopifyMetafield {
  namespace: string;
  key: string;
  type: string;
  value: string;
}

interface ShopifyAPIResponse {
  product?: {
    id: string;
    title: string;
  };
  errors?: Record<string, unknown>;
}

export class ShopifyAPI {
  private client: AxiosInstance;
  private debug: boolean;

  constructor(storeUrl: string, accessToken: string, debug = false) {
    this.debug = debug;
    this.client = axios.create({
      baseURL: `https://${storeUrl}/admin/api/2024-01/graphql.json`,
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });
  }

  async createProduct(product: ShopifyProduct): Promise<string> {
    const mutation = this.buildCreateProductMutation(product);

    try {
      const response = await this.client.post<ShopifyAPIResponse>('', {
        query: mutation,
      });

      if (response.data.product?.id) {
        if (this.debug) {
          console.log(`✓ Created: ${product.title} (${response.data.product.id})`);
        }
        return response.data.product.id;
      }

      if (response.data.errors) {
        throw new Error(JSON.stringify(response.data.errors));
      }

      throw new Error('Unknown API error');
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.errors
          ? JSON.stringify(error.response.data.errors)
          : error.message;
        throw new Error(`API Error: ${message}`);
      }
      throw error;
    }
  }

  async checkProductExists(handle: string): Promise<boolean> {
    const query = `
      query {
        products(first: 1, query: "handle:${handle}") {
          edges {
            node {
              id
            }
          }
        }
      }
    `;

    try {
      const response = await this.client.post<{
        data: {
          products: {
            edges: Array<{ node: { id: string } }>;
          };
        };
      }>('', { query });

      return response.data.data.products.edges.length > 0;
    } catch (error) {
      if (this.debug) {
        console.warn(`⚠ Could not check if ${handle} exists:`, error);
      }
      return false;
    }
  }

  private buildCreateProductMutation(product: ShopifyProduct): string {
    const title = this.escapeString(product.title);
    const handle = product.handle ? this.escapeString(product.handle) : undefined;
    const bodyHtml = product.bodyHtml ? this.escapeString(product.bodyHtml) : undefined;
    const vendor = product.vendor ? this.escapeString(product.vendor) : undefined;
    const productType = product.productType ? this.escapeString(product.productType) : undefined;
    const tags = product.tags ? this.escapeString(product.tags) : undefined;
    const status = product.status || 'active';

    let productInput = `
      title: "${title}"
      status: ${status}
    `;

    if (handle) productInput += `\n      handle: "${handle}"`;
    if (bodyHtml) productInput += `\n      bodyHtml: "${bodyHtml}"`;
    if (vendor) productInput += `\n      vendor: "${vendor}"`;
    if (productType) productInput += `\n      productType: "${productType}"`;
    if (tags) productInput += `\n      tags: ["${tags.replace(/,\s*/g, '", "')}"]`;

    // Add variants
    if (product.variants && product.variants.length > 0) {
      const variantInputs = product.variants
        .map((v) => this.buildVariantInput(v))
        .join(',\n      ');
      productInput += `\n      variants: [\n        ${variantInputs}\n      ]`;
    }

    // Add images
    if (product.images && product.images.length > 0) {
      const imageInputs = product.images
        .map((img) => `{ src: "${this.escapeString(img.src)}"${img.alt ? `, altText: "${this.escapeString(img.alt)}"` : ''} }`)
        .join(',\n      ');
      productInput += `\n      images: [\n        ${imageInputs}\n      ]`;
    }

    return `
      mutation {
        productCreate(input: {
          ${productInput}
        }) {
          product {
            id
            title
            handle
          }
          userErrors {
            field
            message
          }
        }
      }
    `;
  }

  private buildVariantInput(variant: ShopifyVariant): string {
    let input = '';

    if (variant.title) input += `title: "${this.escapeString(variant.title)}", `;
    if (variant.sku) input += `sku: "${this.escapeString(variant.sku)}", `;
    if (variant.price) input += `price: "${variant.price}", `;
    if (variant.compareAtPrice) input += `compareAtPrice: "${variant.compareAtPrice}", `;
    if (variant.barcode) input += `barcode: "${this.escapeString(variant.barcode)}", `;
    if (variant.weight) input += `weight: ${variant.weight}, `;
    if (variant.weightUnit) input += `weightUnit: ${variant.weightUnit}, `;
    if (variant.inventoryQuantity !== undefined)
      input += `inventoryQuantity: ${variant.inventoryQuantity}, `;
    if (variant.inventoryManagement)
      input += `inventoryManagement: ${variant.inventoryManagement}, `;

    return `{ ${input.slice(0, -2)} }`;
  }

  private escapeString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }
}
