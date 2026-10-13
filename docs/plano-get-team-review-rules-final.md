# Plano: `get_team_review_rules` na definição final

Escopo: `tools/revisor-mcp/src/tools/review-rules.js` (servidor enxuto, `src/index.js`) e `tools/revisor-mcp/scripts/smoke.mjs`. Não toca o Vendure nem `src/` da loja.

## Ponto de partida

A tool **já existe** e já faz: filtro por `category`/`severity`, `limit` (1-50, padrão 20), só regras ativas, `""` tratado como omitido, erro `isError` para `team_id` desconhecido (commit `66fe102`). Este plano cobre só a diferença entre o código e a definição final.

## Diferenças a fechar

| # | Definição final | Hoje | Ação |
|---|---|---|---|
| 1 | Ordem estável: severidade e depois `id` | só severidade; empate fica na ordem do arquivo | `sort` com desempate por `id` |
| 2 | Agente sabe se houve corte por `limit` | retorno só tem `count` | devolver `total` (regras que casam com os filtros, antes do `slice`) além de `count` |
| 3 | `description` cita o formato do `id` e diz que ele não vai para o `log_review` | não cita | reescrever a `description` (3 frases, padrão do arquivo) |
| 4 | `.describe` de `limit` avisa do corte | não avisa | citar `total` |

Fora do escopo (decidido): parâmetro `active` (a tool só devolve ativas), `team_id` como enum (continua string validada em runtime), campo de regra violada no `log_review`, mudança em outras tools.

## Passos

1. `review-rules.js`: separar `casadas` (filtros + sort por severidade e `id`) de `rules` (`casadas.slice(0, limit)` mapeado para `id, category, severity, rule`). Retorno: `{ rules, count: rules.length, total: casadas.length }`.
2. `review-rules.js`: ajustar `description` e o `.describe` de `limit` conforme a tabela.
3. `smoke.mjs`: acrescentar checks (a) ordem: `loja` sem filtro vem com todos os `error` antes dos `warning` e, dentro da severidade, `id` crescente; (b) `limit: 1` em `loja` devolve `count 1` e `total` maior que 1. Não alterar os checks existentes (`rules_loja`, `rules_time_inexistente`, `rules_filtro_vazio`) para passarem.
4. Sem mudança em `db.js`, `rules.json`, `index.js`, `index-inchado.js`. Nenhuma dependência nova.

## Verificação (executada pelo dev; reiniciar o `claude` depois)

1. `npm run smoke` em `tools/revisor-mcp`: checks antigos e novos passam; os tokens estimados de `get_team_review_rules` mudam pouco (um campo a mais).
2. `npm run conferir -- 03`.
3. Inspector, manual: `loja` → 8 regras, `R-01` a `R-05` primeiro; `loja` com `limit: 1` → `count 1`, `total 8`; `checkout` + `severity: info` → lista vazia sem erro; `lojas` → erro com `checkout, loja`.
4. `git diff --stat`: só `review-rules.js` e `smoke.mjs` (`package*.json` ficam fora, são anteriores).
5. Subagente `revisor-codigo` revisa o diff antes de dizer pronto.

## Riscos

- `total` acrescenta um campo ao retorno: aumenta poucos tokens; quem lê só `rules` e `count` não quebra.
- O smoke de ordem depende do conteúdo de `rules.json`; se as regras mudarem, ajustar o check, não o dado.
