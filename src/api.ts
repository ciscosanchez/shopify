import axios, { AxiosInstance } from 'axios';

export interface ShopifyMetafield {
  namespace: string;
  key: string;
  type: string;
  value: string;
}

export interface ShopifyProduct {
  title: string;
  handle?: string;
  bodyHtml?: string;
  vendor?: string;
  productType?: string;
  productCategory?: string;
  tags?: string;
  status?: string;
  seoTitle?: string;
  seoDescription?: string;
  options?: Array<{ name: string }>;
  variants?: ShopifyVariant[];
  images?: ShopifyImage[];
  metafields?: ShopifyMetafield[];
}

export interface ShopifyVariant {
  sku?: string;
  price?: string;
  compareAtPrice?: string;
  barcode?: string;
  weight?: number;
  weightUnit?: string;
  inventoryQuantity?: number;
  inventoryManagement?: string;
  inventoryPolicy?: string;
  requiresShipping?: boolean;
  option1?: string;
  option2?: string;
  option3?: string;
  imageSrc?: string;
}

export interface ShopifyImage {
  src: string;
  altText?: string;
  alt?: string;
  position?: number;
}

export class ShopifyAPI {
  private client: AxiosInstance;
  private debug: boolean;

  constructor(storeUrl: string, accessToken: string, debug = false) {
    this.debug = debug;
    this.client = axios.create({
      baseURL: `https://${storeUrl}/admin/api/2024-10/graphql.json`,
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });
  }

  async createProduct(product: ShopifyProduct): Promise<string> {
    const mutation = `
      mutation productCreate($input: ProductInput!) {
        productCreate(input: $input) {
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

    const input = this.buildProductInput(product);

    try {
      const response = await this.client.post<{
        data: {
          productCreate: {
            product: { id: string; title: string; handle: string } | null;
            userErrors: Array<{ field: string[]; message: string }>;
          };
        };
        errors?: Array<{ message: string }>;
      }>('', { query: mutation, variables: { input } });

      if (response.data.errors?.length) {
        throw new Error(response.data.errors.map(e => e.message).join(', '));
      }

      const result = response.data.data?.productCreate;

      if (result?.userErrors?.length) {
        throw new Error(result.userErrors.map(e => `${e.field.join('.')}: ${e.message}`).join(', '));
      }

      if (result?.product?.id) {
        if (this.debug) console.log(`✓ Created: ${product.title} (${result.product.id})`);
        return result.product.id;
      }

      throw new Error('No product ID returned');
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const msg = error.response?.data?.errors
          ? JSON.stringify(error.response.data.errors)
          : error.message;
        throw new Error(`API Error: ${msg}`);
      }
      throw error;
    }
  }

  async checkProductExists(handle: string): Promise<boolean> {
    const query = `
      query checkProduct($query: String!) {
        products(first: 1, query: $query) {
          edges { node { id } }
        }
      }
    `;

    try {
      const response = await this.client.post<{
        data: { products: { edges: Array<{ node: { id: string } }> } };
      }>('', { query, variables: { query: `handle:${handle}` } });

      return (response.data.data?.products?.edges?.length ?? 0) > 0;
    } catch (error) {
      if (this.debug) console.warn(`⚠ Could not check if ${handle} exists:`, error);
      return false;
    }
  }

  private buildProductInput(product: ShopifyProduct): Record<string, unknown> {
    const input: Record<string, unknown> = {
      title: product.title,
      status: (product.status || 'ACTIVE').toUpperCase(),
    };

    if (product.handle) input.handle = product.handle;
    if (product.bodyHtml) input.bodyHtml = product.bodyHtml;
    if (product.vendor) input.vendor = product.vendor;
    if (product.productType) input.productType = product.productType;
    if (product.tags) input.tags = product.tags.split(',').map(t => t.trim()).filter(Boolean);

    if (product.seoTitle || product.seoDescription) {
      input.seo = {
        ...(product.seoTitle ? { title: product.seoTitle } : {}),
        ...(product.seoDescription ? { description: product.seoDescription } : {}),
      };
    }

    if (product.options?.length) {
      input.options = product.options.map(o => o.name);
    }

    if (product.variants?.length) {
      input.variants = product.variants.map(v => {
        const variant: Record<string, unknown> = {};
        if (v.sku) variant.sku = v.sku;
        if (v.price) variant.price = v.price;
        if (v.compareAtPrice) variant.compareAtPrice = v.compareAtPrice;
        if (v.barcode) variant.barcode = v.barcode;
        if (v.weight !== undefined) variant.weight = v.weight;
        if (v.weightUnit) variant.weightUnit = v.weightUnit.toUpperCase();
        if (v.inventoryQuantity !== undefined) variant.inventoryQuantity = v.inventoryQuantity;
        if (v.inventoryManagement) variant.inventoryManagement = v.inventoryManagement.toUpperCase();
        if (v.inventoryPolicy) variant.inventoryPolicy = v.inventoryPolicy.toUpperCase();
        if (v.requiresShipping !== undefined) variant.requiresShipping = v.requiresShipping;

        const optionValues = [v.option1, v.option2, v.option3].filter(Boolean);
        if (optionValues.length) variant.options = optionValues;

        return variant;
      });
    }

    if (product.images?.length) {
      input.images = product.images.map(img => ({
        src: img.src,
        ...(img.altText || img.alt ? { altText: img.altText || img.alt } : {}),
      }));
    }

    return input;
  }
}
