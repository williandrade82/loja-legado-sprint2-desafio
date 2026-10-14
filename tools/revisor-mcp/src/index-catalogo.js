// catalogo: servidor MCP de catálogo e precificação da loja (somente leitura). Ver docs/prd-catalogo-mcp.md.
// 2 tools de leitura. Transporte stdio, sem rede.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerCatalogoTools } from './tools/catalogo.js';

const server = new McpServer({ name: 'catalogo', version: '1.0.0' });

registerCatalogoTools(server);

// Em stdio, stdout é o canal do protocolo: NUNCA use console.log aqui. Use console.error para debug.
const transport = new StdioServerTransport();
await server.connect(transport);
