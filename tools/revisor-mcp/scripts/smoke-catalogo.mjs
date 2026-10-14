// Teste de fumaça do servidor `catalogo` (N2), sem LLM: sobe o servidor via stdio com um client MCP de verdade,
// confere as validações num banco de teste e mede o retorno contra despejar as tabelas do banco real.
//   npm run smoke:catalogo      (em tools/revisor-mcp)
// Tokens estimados = caracteres / 4, arredondado à centena (a mesma conta do smoke do revisor).
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import Database from 'better-sqlite3';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const REAL = path.join(ROOT, '..', '..', 'vendure.sqlite');
const tokens = (chars) => Math.round(chars / 4 / 100) * 100;

// Banco de teste mínimo: as colunas que o servidor consulta. O vendure.sqlite real não é usado nas validações.
const tmp = mkdtempSync(path.join(os.tmpdir(), 'catalogo-smoke-'));
const FIXTURE = path.join(tmp, 'fixture.sqlite');
{
  const db = new Database(FIXTURE);
  db.exec(`
    CREATE TABLE channel (id INTEGER PRIMARY KEY, code TEXT, defaultCurrencyCode TEXT, pricesIncludeTax INTEGER);
    CREATE TABLE product (id INTEGER PRIMARY KEY, deletedAt TEXT, enabled INTEGER);
    CREATE TABLE product_translation (id INTEGER PRIMARY KEY, baseId INTEGER, languageCode TEXT, name TEXT);
    CREATE TABLE product_variant (id INTEGER PRIMARY KEY, productId INTEGER, sku TEXT, deletedAt TEXT, enabled INTEGER);
    CREATE TABLE product_variant_translation (id INTEGER PRIMARY KEY, baseId INTEGER, languageCode TEXT, name TEXT);
    CREATE TABLE product_variant_price (id INTEGER PRIMARY KEY, variantId INTEGER, channelId INTEGER, price INTEGER, currencyCode TEXT);
    INSERT INTO channel VALUES (1, 'teste', 'BRL', 1);
    INSERT INTO product VALUES (1, NULL, 1), (2, NULL, 1), (3, '2026-01-01', 1);
    INSERT INTO product_translation VALUES (1, 1, 'en', 'Camiseta'), (2, 2, 'en', 'Tênis 100% algodão'), (3, 3, 'en', 'Apagado');
    INSERT INTO product_variant VALUES (1, 1, 'CAM-P', NULL, 1), (2, 1, 'CAM-G', NULL, 1), (3, 2, 'TEN-42', NULL, 1), (4, 3, 'APA-1', NULL, 1);
    INSERT INTO product_variant_translation VALUES (1, 1, 'en', 'Camiseta P'), (2, 2, 'en', 'Camiseta G'), (3, 3, 'en', 'Tênis 42'), (4, 4, 'en', 'Apagado 1');
    INSERT INTO product_variant_price VALUES (1, 1, 1, 4990, 'BRL'), (2, 2, 1, 5990, 'BRL'), (3, 3, 1, 29990, 'BRL'), (4, 4, 1, 100, 'BRL');
  `);
  db.close();
}

async function conectar(dbPath) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(ROOT, 'src', 'index-catalogo.js')],
    env: { ...process.env, CATALOGO_DB: dbPath },
    stderr: 'ignore',
  });
  const client = new Client({ name: 'smoke-catalogo', version: '0.0.0' });
  await client.connect(transport);
  return client;
}
async function chamar(client, name, a) {
  try {
    const r = await client.callTool({ name, arguments: a });
    return { isError: Boolean(r.isError), text: (r.content ?? []).map((c) => c.text ?? '').join('\n') };
  } catch (e) {
    return { isError: true, text: String(e.message ?? e) };
  }
}

const linhas = [];
let falhas = 0;
const checar = (ok, okTxt, falhaTxt) => { linhas.push(`  ${ok ? '✔' : '✘'} ${ok ? okTxt : falhaTxt}`); if (!ok) falhas++; };

try {
  const teste = await conectar(FIXTURE);
  const { tools } = await teste.listTools();
  const nomes = tools.map((t) => t.name).sort();
  checar(nomes.join() === 'get_channel_pricing,search_catalog_variants', `2 tools, nomes verbo_objeto: ${nomes.join(', ')}`, `tools inesperadas: ${nomes.join(', ')}`);

  const invertido = await chamar(teste, 'search_catalog_variants', { min_price: 9000, max_price: 100 });
  checar(invertido.isError && /swap/i.test(invertido.text), 'min_price > max_price → erro que diz como corrigir', `min > max não deu erro informativo: ${invertido.text.slice(0, 100)}`);

  const limite = await chamar(teste, 'search_catalog_variants', { limit: 51 });
  checar(limite.isError, 'limit 51 é recusado pelo Zod (máximo 50)', 'limit 51 foi aceito');

  const ordem = await chamar(teste, 'search_catalog_variants', { order_by: 'preco' });
  checar(ordem.isError, 'order_by fora do enum é recusado', 'order_by "preco" foi aceito');

  const vazio = await chamar(teste, 'search_catalog_variants', { query: 'inexistente' });
  const v = JSON.parse(vazio.text);
  checar(!vazio.isError && v.total === 0 && v.variants.length === 0, 'busca sem resultado → total 0 e lista vazia, não erro', `busca vazia: ${vazio.text.slice(0, 100)}`);

  const faixa = await chamar(teste, 'search_catalog_variants', { min_price: 5000, max_price: 30000, order_by: 'price_asc' });
  const f = JSON.parse(faixa.text);
  checar(f.total === 2 && f.variants[0].sku === 'CAM-G' && f.variants[0].price === 5990, 'faixa de preço em centavos, em ordem crescente (CAM-G 5990, TEN-42 29990)', `faixa: ${faixa.text.slice(0, 160)}`);

  const coringa = await chamar(teste, 'search_catalog_variants', { query: '%' });
  const c = JSON.parse(coringa.text);
  checar(c.total === 1 && c.variants[0].sku === 'TEN-42', 'o "%" da busca é literal (só o "Tênis 100% algodão" casa)', `"%" virou curinga: total ${c.total}`);

  const apagado = await chamar(teste, 'search_catalog_variants', { query: 'Apagado' });
  checar(JSON.parse(apagado.text).total === 0, 'produto com deletedAt não aparece', 'produto apagado apareceu');

  checar(!/createdAt|updatedAt|deletedAt|"id"/.test(faixa.text), 'retorno sem metadados (createdAt, updatedAt, deletedAt, id)', 'o retorno tem metadados');

  const canal = JSON.parse((await chamar(teste, 'get_channel_pricing', {})).text);
  checar(canal.prices_include_tax === true && canal.discount_base === 'order.subTotalWithTax', 'canal com imposto incluso → base order.subTotalWithTax', `canal: ${JSON.stringify(canal)}`);
  await teste.close();

  // Medida no banco real (somente leitura): o retorno da tool × despejar as tabelas de variantes e preços.
  if (existsSync(REAL)) {
    const antes = statSync(REAL);
    const real = await conectar(REAL);
    const defs = JSON.stringify(tools.map((t) => ({ name: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema }))).length;
    const consulta = await chamar(real, 'search_catalog_variants', { query: 'laptop', limit: 5 });
    const q = JSON.parse(consulta.text);
    const canalReal = JSON.parse((await chamar(real, 'get_channel_pricing', {})).text);
    await real.close();
    const db = new Database(REAL, { readonly: true });
    const despejo = JSON.stringify({ product_variant: db.prepare('SELECT * FROM product_variant').all(), product_variant_price: db.prepare('SELECT * FROM product_variant_price').all() }).length;
    db.close();
    const depois = statSync(REAL);
    checar(antes.mtimeMs === depois.mtimeMs && antes.size === depois.size, 'o vendure.sqlite real não foi alterado (mesmo mtime e tamanho)', 'o vendure.sqlite mudou durante o smoke');
    checar(q.total > 0 && q.returned === Math.min(5, q.total), `banco real: busca "laptop", limit 5 → ${q.returned} de ${q.total} variantes`, `busca real: ${consulta.text.slice(0, 120)}`);
    linhas.push('Medida (tokens estimados = caracteres ÷ 4, à centena)');
    linhas.push(`  definições das 2 tools:                       ~${tokens(defs)}`);
    linhas.push(`  retorno de search_catalog_variants (limit 5):  ~${tokens(consulta.text.length)}`);
    linhas.push(`  despejar product_variant + product_variant_price (SELECT *): ~${tokens(despejo)}`);
    linhas.push(`  canal real: ${JSON.stringify(canalReal)}`);
  } else {
    linhas.push('  … vendure.sqlite não existe: rode "npm run setup" na raiz para ver a medida no banco real');
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log('\nSmoke do servidor catalogo');
console.log(linhas.join('\n'));
console.log(falhas ? `\n✘ ${falhas} falha(s)` : '\n✔ servidor ok');
process.exit(falhas ? 1 : 0);
