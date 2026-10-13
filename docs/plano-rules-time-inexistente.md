# Plano: `get_team_review_rules` com erro para time inexistente

Escopo: `tools/revisor-mcp/src/tools/review-rules.js` (servidor enxuto, `src/index.js`). Não toca o Vendure nem `src/` da loja.

## Problema

`get_team_review_rules(team_id: "lojas")` devolve `{"rules":[],"count":0}`. O agente que erra uma letra entende "time sem regras" e um PR sem regra parece aprovável. Hoje "time que não existe" e "filtro sem resultado" são indistinguíveis.

## Regras de comportamento

| Chamada | Resposta |
|---|---|
| `team_id` que não existe em nenhuma regra de `rules.json` | `isError: true`, texto diz o que estava errado e como corrigir |
| time existe, filtro (`category`/`severity`) sem resultado | **continua** `{"rules":[],"count":0}`, sem erro |
| time existe, só com regras inativas | `{"rules":[],"count":0}` (o time existe) |
| time existe, sem filtro | como hoje |

"Time existe" = há ao menos uma regra (ativa ou não) com aquele `team_id`. Comparação exata, sem normalizar caixa ou espaços: o erro lista os times válidos e o agente corrige sozinho.

## Passos

1. `review-rules.js`: dentro do handler, antes dos filtros, calcular `const todas = listRules()` e `times = [...new Set(todas.map(r => r.team_id))].sort()`. Se `!times.includes(team_id)`, devolver
   `{ isError: true, content: [{ type: 'text', text: 'Unknown team_id: "lojas". Valid teams: checkout, loja. Retry with one of the valid team ids.' }] }`.
   Mesmo formato de erro do `get_pr_diff` (helper local `erro`, texto em inglês: o que errou + lista + como corrigir).
2. `review-rules.js`: ajustar `description` (3 frases, no padrão do arquivo) e o `.describe` de `team_id`:
   - frase 3 passa a dizer: "Returns rules ...; an unknown team_id is an error that lists the valid teams, while a valid team whose filters match nothing returns an empty list (count 0), which is a valid answer, not an error."
   - `team_id`: `Team identifier, must exist (e.g. "loja"). An unknown id returns an error listing valid teams.`
3. Sem mudança em `db.js`, `rules.json`, `index.js`, `index-inchado.js`.

## Verificação (executada pelo dev, não pelo Claude; o MCP precisa ser reiniciado)

1. `npm run smoke` (em `tools/revisor-mcp`): já tem os checks `rules_time_inexistente` (isError + cita `time-que-nao-existe` e `loja`) e `rules_filtro_vazio` (`loja` + `performance` → count 0, sem erro). Devem passar; hoje o primeiro falha.
2. `npm run conferir -- 03` para o card correspondente.
3. Inspector, manual: `team_id: "lojas"` → erro com lista `checkout, loja`; `team_id: "checkout"` + `severity: "info"` → lista vazia sem erro; `team_id: "loja"` → 8 regras ativas.
4. `git diff --stat`: só `review-rules.js` (os arquivos já modificados `.mcp.json`, `package*.json` são anteriores e ficam fora).
5. Reiniciar o `claude` para a descrição nova valer (CLAUDE.md: depois de mudar tool/`.mcp.json`, sair e abrir de novo). Subagente `revisor-codigo` revisa o diff antes de dizer pronto.

## Fora do escopo

Mudança em outras tools (`search_team_adrs`, `get_review_metrics` e demais), sugestão de time parecido, normalização de caixa, dependência nova.

## Decisões validadas

- Só `get_team_review_rules` muda; as outras tools ficam intactas.
- Time só com regras inativas existe: devolve lista vazia, sem erro.
