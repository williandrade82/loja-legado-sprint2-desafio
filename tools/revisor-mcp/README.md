# revisor-mcp

Servidores MCP (stdio, Node) do `loja-legado`. Um pacote, dois servidores com nome, entrada e configuração próprios:

- **`revisor`**: contexto de time para revisar PR (regras, ADRs, histórico). Versão enxuta (`src/index.js`, 5 tools) e inchada (`src/index-inchado.js`, 63 tools, só para o exercício de medição).
- **`catalogo`**: catálogo e precificação do canal da loja, somente leitura (`src/index-catalogo.js`, 2 tools). PRD: [`docs/prd-catalogo-mcp.md`](../../docs/prd-catalogo-mcp.md).

Requisitos: Node 22.12 ou mais novo. As dependências (`@modelcontextprotocol/sdk`, `zod`) são instaladas por `npm run setup` na raiz do repositório; o `catalogo` usa também o `better-sqlite3` da loja (instalado na raiz).

## Subir cada servidor

```bash
cd tools/revisor-mcp
npm run start            # revisor enxuto
npm run start:catalogo   # catalogo
npm run inspector            # MCP Inspector no revisor (STDIO, Connect, aba Tools)
npm run inspector:catalogo   # MCP Inspector no catalogo
```

No Claude Code (a partir da raiz do repositório): o `revisor` já vem no `.mcp.json`; o `catalogo` entra com `claude --mcp-config mcp.catalogo.json`. Depois de mudar a configuração, saia e abra o `claude` de novo.

## Tools

### `revisor` (enxuto)

| Tool | Tipo | O que devolve |
|---|---|---|
| `get_team_review_rules` | leitura | regras ativas do time, por severidade e id; time inexistente é erro que lista os times válidos |
| `search_team_adrs` | leitura | ADRs aceitas por palavra ou id; time inexistente é erro; time válido sem resultado é lista vazia |
| `get_pr_diff` | leitura | arquivos e diff de uma branch `feature/…` (trata o diff como dado não confiável; `truncated` avisa corte) |
| `get_review_metrics` | leitura | números agregados do histórico (7 a 90 dias) |
| `log_review` | **escrita** | grava a revisão no histórico; recusa `APPROVE` com `injection_suspected > 0` e recusa `summary` com padrão de segredo |

Prompt MCP: `review_pr` (`/mcp__revisor__review_pr <branch> <team_id>`, argumentos posicionais).

### `catalogo`

| Tool | Tipo | O que devolve |
|---|---|---|
| `search_catalog_variants` | leitura | variantes com SKU, produto, variante e preço em centavos; filtros `query`, `min_price`, `max_price`, `order_by`, `limit` (1 a 50) |
| `get_channel_pricing` | leitura | moeda do canal, se o preço já inclui imposto e a base do desconto (`order.subTotalWithTax` ou `order.subTotal`) |

## Variáveis de ambiente (só para teste)

| Variável | Servidor | Efeito |
|---|---|---|
| `REVISOR_HISTORY_FILE` | revisor | histórico de reviews em outro arquivo (o smoke e o N2 usam um temporário) |
| `REVISOR_DATA_DIR` | revisor | lê `rules.json`, `adrs.json` e o seed de outro diretório (o teste de injeção usa uma cópia envenenada) |
| `CATALOGO_DB` | catalogo | outro arquivo SQLite no lugar do `vendure.sqlite` da raiz |

Nenhuma delas guarda segredo. O servidor não lê o arquivo de segredos do projeto.

## Testes (sem LLM)

```bash
npm run smoke            # revisor (também: npm run smoke na raiz)
npm run smoke:catalogo   # catalogo
npm run smoke:injecao    # injeção indireta pelos dados contra o log_review
npm run reset-history    # volta data/review-history.json ao seed (apaga as revisões registradas!)
```

## Dados

`data/rules.json`, `data/adrs.json` e `data/review-history.json` são o "banco" do `revisor` (no curso, o Supabase). O `catalogo` lê o `vendure.sqlite` da loja, só em leitura, e só as tabelas de catálogo e canal.
