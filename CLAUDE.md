@AGENTS.md

## Claude Code neste repositório

- Hooks em `.claude/settings.json`: `guard.sh` bloqueia comandos da lista "Nunca"; `test-after-edit.sh` roda `npm test` depois de cada Edit/Write em `src/` ou `test/`; `stop-gate.sh` não deixa encerrar com teste vermelho (até 3 voltas; em plan mode não roda). Se um hook devolver erro, leia o motivo e corrija; não tente contornar.
- O `.env` está negado em `permissions.deny`: não tente ler por outro caminho.
- Tarefa com spec: planeje em `docs/plano.md` antes de implementar. Antes de dizer pronto, peça ao subagente `revisor-codigo` para revisar o diff contra a spec.

## Servidor MCP do time

- `tools/revisor-mcp/` é o servidor MCP `revisor` (stdio, dados em `data/*.json`): regras de revisão, ADRs e histórico de reviews do time `loja`. O `.mcp.json` escolhe a versão (`src/index-inchado.js` ou `src/index.js`). Depois de mudar o `.mcp.json`, saia e abra o `claude` de novo.
- `catalogo` (`tools/revisor-mcp/src/index-catalogo.js`, PRD em `docs/prd-catalogo-mcp.md`, config em `mcp.catalogo.json`): somente leitura, 2 tools. Antes de escrever promoção ou teste com valores, use `search_catalog_variants` (preços reais em centavos) e `get_channel_pricing` (base do desconto: `subTotalWithTax` ou `subTotal`). Ele não lê pedidos nem clientes e não escreve no `vendure.sqlite`; não o ligue ao `.mcp.json` sem rever o teto de 12 tools ativas. `npm --prefix tools/revisor-mcp run smoke:catalogo` testa sem LLM.
- `npm run smoke` sobe o servidor sem LLM, chama as tools e imprime os tokens estimados; `npm run conferir -- NN` confere um card.
