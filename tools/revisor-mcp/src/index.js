// revisor-mcp: servidor MCP customizado (versão enxuta).
// 5 tools (4 de leitura + 1 de escrita). Transporte stdio, sem rede.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerReviewRulesTools } from './tools/review-rules.js';
import { registerAdrTools } from './tools/adrs.js';
import { registerPrDiffTools } from './tools/pr-diff.js';
import { registerReviewHistoryTools } from './tools/review-history.js';
import { registerReviewPrompts } from './prompts/review-pr.js';

const server = new McpServer({ name: 'revisor', version: '1.1.0' });

registerReviewRulesTools(server);
registerAdrTools(server);
registerPrDiffTools(server);
registerReviewHistoryTools(server);
// Prompts (a terceira primitiva do MCP): viram slash commands no Claude Code (/mcp__revisor__<nome>).
registerReviewPrompts(server);

// Em stdio, stdout é o canal do protocolo: NUNCA use console.log aqui. Use console.error para debug.
const transport = new StdioServerTransport();
await server.connect(transport);
