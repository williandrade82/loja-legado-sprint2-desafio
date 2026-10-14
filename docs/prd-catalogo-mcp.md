# PRD: servidor MCP `catalogo` (somente leitura)

Escrito antes da implementação (aula «Criando um PRD para configurar o MCP server minimal»). O agente implementa a partir deste documento.

## Objetivo

Dar ao agente que escreve regras de promoção no `loja-legado` os dados que ele hoje não enxerga: **preços reais do catálogo em centavos** e **como o canal calcula imposto** (`pricesIncludeTax`). Sem isso, o agente inventa valores de teste e erra a base do desconto (`subTotalWithTax` × `subTotal`, regra do `AGENTS.md`).

## Contexto de uso

Tarefa típica: "o frete grátis vale a partir de R$ 100; quais variantes passam desse valor e como o canal soma imposto?". Hoje a resposta exige abrir o Vendure ou o SQLite à mão.

## Fora do escopo

- Qualquer escrita (nenhuma tool de escrita, nenhum `INSERT/UPDATE/DELETE`).
- Clientes, pedidos, endereços, pagamentos e administradores: o servidor não toca essas tabelas.
- SQL livre: o agente não escreve SQL.
- Rede, HTTP, autenticação (transporte stdio local).
- Criar ou alterar entidades, resolvers ou endpoints do Vendure.

## Restrições ("não fazer")

- Não abrir o banco em modo de escrita; abrir com `readonly` e `query_only`.
- Não apagar, recriar nem migrar o `vendure.sqlite`.
- Não ler o arquivo de segredos do projeto nem aceitar caminho de arquivo vindo do agente.
- Não devolver metadados (`createdAt`, `updatedAt`, `deletedAt`, ids internos).
- Não usar `console.log` (stdout é o protocolo stdio).
- Dinheiro sempre em inteiro, na menor unidade (centavos), sem converter para decimal.

## Tools (2, ambas de leitura)

| Tool | Para quê | Entrada | Retorno |
|---|---|---|---|
| `search_catalog_variants` | achar variantes e os preços em centavos | `query` (texto opcional, nome ou SKU), `min_price` e `max_price` (inteiros em centavos, opcionais), `order_by` (enum `name`, `price_asc`, `price_desc`; padrão `name`), `limit` (1 a 50; padrão 10) | `{ total, returned, variants: [{ sku, product, variant, price, currency }] }` |
| `get_channel_pricing` | saber a base do desconto | nenhuma | `{ channel, currency, prices_include_tax, discount_base }` |

## Critérios de aceite

1. `tools/list` devolve exatamente 2 tools, com nome `verbo_objeto` e descrição em três frases (o que faz, quando usar, o que retorna).
2. `min_price > max_price` devolve `isError` dizendo como corrigir; `limit` fora de 1 a 50 é recusado pelo Zod.
3. Busca sem resultado devolve `variants: []` com `total: 0` (resposta válida, não erro).
4. O retorno de `search_catalog_variants` com `limit` 5 custa **menos tokens estimados** do que despejar as tabelas de variantes e preços (medida em `npm --prefix tools/revisor-mcp run smoke:catalogo`).
5. O servidor roda com o banco de teste (`CATALOGO_DB`) sem tocar o `vendure.sqlite` real.
6. Nenhum segredo é lido, impresso ou devolvido.

## Integração com a Sprint 1

- Uso registrado no `CLAUDE.md`.
- O `Read` do arquivo de segredos continua negado em `permissions.deny` e o `guard.sh` continua ativo; o servidor não depende de nenhuma chave.
- A configuração do servidor fica em `mcp.catalogo.json` (mesmo padrão de `mcp.enxuto.json`), fora do `.mcp.json`, para o total de tools ativas do `.mcp.json` continuar em até 12.
