import { z } from 'zod';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

// Só leitura: o banco abre com readonly + query_only e o agente nunca escreve SQL (consultas fixas, só com parâmetros).
// CATALOGO_DB: o smoke aponta para um banco de teste; sem ele, o vendure.sqlite da loja (raiz do repositório).
const DB_PADRAO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'vendure.sqlite');

function abrir() {
  const arquivo = process.env.CATALOGO_DB ? path.resolve(process.env.CATALOGO_DB) : DB_PADRAO;
  if (!existsSync(arquivo)) return { erro: `Database not found. Run "npm run setup" in the repository root to create vendure.sqlite, or set CATALOGO_DB to an existing SQLite file.` };
  const db = new Database(arquivo, { readonly: true, fileMustExist: true });
  db.pragma('query_only = ON');
  return { db };
}

const erro = (text) => ({ isError: true, content: [{ type: 'text', text }] });
const json = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });
const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const ORDEM = {
  name: 'pt.name, vt.name',
  price_asc: 'vp.price ASC, v.sku',
  price_desc: 'vp.price DESC, v.sku',
};

export function registerCatalogoTools(server) {
  server.registerTool(
    'search_catalog_variants',
    {
      title: 'Search Catalog Variants',
      description:
        'Searches the store catalog (read-only) for product variants and their prices in minor units (cents, as integers: 10000 = 100.00). ' +
        'Use it when you need real prices or SKUs, for example to write a promotion test or to check which variants cross a minimum order amount. ' +
        'Returns total, returned and a list of { sku, product, variant, price, currency }; an empty list with total 0 is a valid answer, not an error.',
      inputSchema: {
        query: z.string().trim().min(1).max(60).optional().describe('Text to look for in the product name or SKU (case-insensitive). Omit to list everything.'),
        min_price: z.number().int().min(0).optional().describe('Minimum price in minor units (cents), inclusive. Example: 10000 for 100.00.'),
        max_price: z.number().int().min(0).optional().describe('Maximum price in minor units (cents), inclusive.'),
        order_by: z.enum(['name', 'price_asc', 'price_desc']).default('name').describe('Sort order (default "name").'),
        limit: z.number().int().min(1).max(50).default(10).describe('Maximum variants returned (1-50, default 10).'),
      },
    },
    async ({ query, min_price, max_price, order_by, limit }) => {
      if (min_price !== undefined && max_price !== undefined && min_price > max_price) {
        return erro(`min_price (${min_price}) is greater than max_price (${max_price}). Swap them, or omit one of the two. Prices are integers in minor units (cents).`);
      }
      const { db, erro: falha } = abrir();
      if (falha) return erro(falha);
      try {
        const like = query ? `%${escapeLike(query)}%` : null;
        const where =
          `v.deletedAt IS NULL AND v.enabled = 1 AND p.deletedAt IS NULL AND p.enabled = 1 ` +
          `AND (@like IS NULL OR pt.name LIKE @like ESCAPE '\\' OR v.sku LIKE @like ESCAPE '\\') ` +
          `AND (@min IS NULL OR vp.price >= @min) AND (@max IS NULL OR vp.price <= @max)`;
        const from =
          `FROM product_variant v ` +
          `JOIN product p ON p.id = v.productId ` +
          `JOIN product_translation pt ON pt.baseId = p.id AND pt.languageCode = 'en' ` +
          `JOIN product_variant_translation vt ON vt.baseId = v.id AND vt.languageCode = 'en' ` +
          `JOIN product_variant_price vp ON vp.variantId = v.id`;
        const params = { like, min: min_price ?? null, max: max_price ?? null };
        const total = db.prepare(`SELECT COUNT(*) AS n ${from} WHERE ${where}`).get(params).n;
        const variants = db
          .prepare(`SELECT v.sku AS sku, pt.name AS product, vt.name AS variant, vp.price AS price, vp.currencyCode AS currency ${from} WHERE ${where} ORDER BY ${ORDEM[order_by]} LIMIT @limit`)
          .all({ ...params, limit });
        return json({ total, returned: variants.length, variants });
      } finally {
        db.close();
      }
    }
  );

  server.registerTool(
    'get_channel_pricing',
    {
      title: 'Get Channel Pricing',
      description:
        'Tells how the store channel prices tax (read-only): the currency and whether listed prices already include tax. ' +
        'Use it before writing a promotion action or condition, to pick the right base for the discount (subTotalWithTax when prices include tax, subTotal when they do not). ' +
        'Returns { channel, currency, prices_include_tax, discount_base }.',
      inputSchema: {},
    },
    async () => {
      const { db, erro: falha } = abrir();
      if (falha) return erro(falha);
      try {
        const c = db.prepare('SELECT code, defaultCurrencyCode AS currency, pricesIncludeTax AS inc FROM channel ORDER BY id LIMIT 1').get();
        if (!c) return erro('No channel found in the database. Run "npm run setup" in the repository root.');
        const inclui = c.inc === 1;
        return json({ channel: c.code, currency: c.currency, prices_include_tax: inclui, discount_base: inclui ? 'order.subTotalWithTax' : 'order.subTotal' });
      } finally {
        db.close();
      }
    }
  );
}
