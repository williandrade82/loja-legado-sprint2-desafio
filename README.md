# loja-legado · Projeto prático da Sprint 2

Conecta+ #11 · Engenharia de Software com IA · **Tools que o agente sabe usar: MCP como parte do harness**

Este é o repositório do projeto prático da Sprint 2. A loja (Vendure 3.7, SQLite) continua de onde a Sprint 1 parou: o plugin `cupons` da LOJA-1 (desconto com teto de 30% e um cupom por pedido) e o harness (`CLAUDE.md` com `AGENTS.md`, hooks, deny do `.env`, statusline e o subagente `revisor-codigo`). Agora o agente precisa revisar um PR, o `feature/frete-gratis` (o cupom de frete grátis do time, feito sobre o plugin `cupons`), usando o contexto do time: regras de revisão, ADRs e histórico de reviews, que vivem num servidor MCP em `tools/revisor-mcp/`. O servidor começa inchado de propósito (63 tools) e o PR traz um texto que tenta conduzir o revisor. As tarefas estão no board do Trello; na aula ao vivo o professor resolve as tarefas essenciais neste mesmo repositório.

| | |
|---|---|
| Board do projeto (Trello) | https://trello.com/b/bwXRuNjS |
| Curso base na Alura | [Engenharia de software na era da IA: MCP servers, tools e integrações para agentes de IA](https://cursos.alura.com.br/course/ia-mcp-servers-tools-integracao) (18h estimadas; a seção de Supabase é opcional para este projeto) |
| Lançamento | segunda, 05/10/2026 |
| Aula ao vivo | quinta, 15/10/2026, 9h–10h |
| Entrega do Desafio | sexta, 16/10/2026, por pull request neste repositório (veja `entregas/TEMPLATE.md`) |

## Preparar o ambiente

Você precisa de Node.js 22.12 ou mais novo, git e [Claude Code](https://code.claude.com) 2.1.270 ou mais novo (`claude update`), com conta Claude Pro ou chave de API. Não precisa de Docker nem de banco de dados: a loja usa SQLite.

```bash
git clone https://github.com/alexandreaquiles/loja-legado-sprint2.git
cd loja-legado-sprint2
npm install       # ~2 minutos e ~800 MB: o Vendure inteiro vem em node_modules
npm run setup     # branches locais, .env (segredos falsos), vendure.sqlite e npm install em tools/revisor-mcp
npm test          # testes da loja (vitest, cerca de 1 segundo)
npm run smoke     # sobe o servidor MCP inchado e o enxuto, chama as tools e imprime os tokens estimados, sem LLM
npm run conferir  # confere os cards 00 a 04: no começo só o 00 fica todo ✔
claude            # abre o agente; aprove o servidor MCP "revisor" quando ele perguntar
```

Só quer a parte de MCP? `npm run setup` instala o `tools/revisor-mcp` mesmo sem o `npm install` da loja (ele avisa no fim que a loja falta). Sem a loja, porém, `npm test` falha e o stop-gate da Sprint 1 segura o fim de cada turno do `claude`.

`npm run inspector` dentro de `tools/revisor-mcp` abre o MCP Inspector no navegador (baixa na primeira vez). Com a loja no ar (`npm run dev`): `http://localhost:3000/dashboard` é o admin (superadmin / superadmin). Se o `better-sqlite3` não compilar na sua máquina, abra uma issue neste repositório: há um plano B com `sql.js`.

## Medir o inventário de tools (por que existe `.claude/settings.demo-inchado.json`)

O Claude Code atual já adia as definições de tools MCP (tool search, ligado por padrão): no início da sessão só entram os nomes das tools e as instruções dos servidores, e o `/context` mostra a linha **MCP tools (deferred)**. O curso foi gravado antes disso. Para enxergar o custo das definições, como o curso mostra, abra a sessão com o tool search desligado:

```bash
claude --settings .claude/settings.demo-inchado.json   # "env": { "ENABLE_TOOL_SEARCH": "false" }
/context                                                # linha "MCP tools" e as 63 linhas mcp__revisor__*
```

Use o mesmo comando para medir o inchado (card 01) e o enxuto (card 02), senão a comparação não vale. O tool search não resolve tudo: com 63 tools o agente ainda escolhe entre nomes vagos (`getData`, `fetchDiff`, `run_sql`), cada busca custa uma chamada e o retorno de uma tool mal desenhada (`getData` devolve o banco inteiro) entra no contexto do mesmo jeito. `npm run smoke` dá a estimativa determinística (caracteres ÷ 4) para comparar com o `/context`.

Trocar de servidor é trocar o `.mcp.json` (`mcp.inchado.json` e `mcp.enxuto.json` são as duas opções prontas) e abrir o `claude` de novo.

## Servidores MCP deste repositório

| Servidor | Entrada | Tools | Para quê |
|---|---|---|---|
| `revisor` (enxuto) | `tools/revisor-mcp/src/index.js` | 5 | regras de revisão, ADRs, diff de PR, métricas e `log_review` do time `loja`; prompt `review_pr` |
| `revisor` (inchado) | `tools/revisor-mcp/src/index-inchado.js` | 63 | o ponto de partida do card 01 |
| `catalogo` | `tools/revisor-mcp/src/index-catalogo.js` | 2 | catálogo e precificação do canal da loja, somente leitura (N2 do Desafio; PRD em `docs/prd-catalogo-mcp.md`) |

O `.mcp.json` liga o `revisor` enxuto e o GitHub MCP remoto filtrado por `X-MCP-Tools` (7 tools), num total de 12 tools ativas. O token vai pela variável de ambiente `GITHUB_PAT`, nunca no arquivo. O `catalogo` fica fora do `.mcp.json` para não passar de 12 tools: use `claude --mcp-config mcp.catalogo.json`. Mais detalhes, comandos e variáveis de ambiente em [`tools/revisor-mcp/README.md`](tools/revisor-mcp/README.md).

Testes sem LLM (todos saem com código 1 se falharem):

```bash
npm run smoke                                      # revisor: inventário, validações, defesas do log_review (inclui recusa de segredo no summary)
npm --prefix tools/revisor-mcp run smoke:catalogo  # catalogo: validações, medida contra despejar as tabelas, banco real intacto
npm --prefix tools/revisor-mcp run smoke:injecao   # regra envenenada em data/ → log_review recusa a chave (N3, opção B)
```

A entrega do Desafio está em [`entregas/williandrade82.md`](entregas/williandrade82.md).

## As tarefas

Copie o board do Trello para a sua conta e mova os cards. Resumo:

| # | tarefa | etiqueta |
|---|---|---|
| 00 | Preparar o ambiente e rodar o smoke | Essencial |
| 01 | Sentir o problema: o inventário inchado no `/context` (com o tool search desligado), `getData` que devolve tudo, o PR revisado com um prompt vago | Essencial |
| 02 | Dieta de tools: o `.mcp.json` com o servidor enxuto (até 12 tools) e medir de novo | Essencial |
| 03 | Tool como spec: `get_team_review_rules` devolve erro informativo para time inexistente | Essencial |
| 04 | Prompt seguro: um prompt de revisão que trata o diff como dado, e a revisão do `feature/frete-gratis` registrada com `log_review` | Essencial |
| 05 | Intermediária: uma tool em três frases (autocorreção; não é feita na aula) | Intermediária |
| 06 | Desafio em 3 níveis, no seu repositório ou no `loja-legado` | Desafio |

Cada card termina com `npm run conferir -- NN` (por exemplo `npm run conferir -- 03`): ✔ feito, ✘ falta, … depende de outro card. É feedback, não nota: nada ali usa LLM, e do seu `.env` ele só lê a `PAGAMENTO_API_KEY`, sem imprimir, para procurar vazamento no registro das revisões.

As tarefas essenciais (01 a 04) são as que o professor resolve ao vivo na quinta; a Intermediária e o Desafio ficam com você. Tente antes: a aula rende muito mais quando você já esbarrou no problema.

## Branches

- `main`: o estado inicial, com o servidor inchado configurado em `.mcp.json`.
- `feature/frete-gratis`: o PR em revisão. Os testes passam; não faça merge sem revisar.
- `gabarito`: uma solução de referência para os cards 02 a 04 (`.mcp.json` enxuto, erro informativo, prompt `secure_code_review`, `CLAUDE.md` da sprint), e a referência da Intermediária em `docs/intermediaria/`. Vale mais espiar depois de tentar: `git show gabarito:<arquivo>`. A revisão esperada do PR fica fora do repositório, no Gabarito da tarefa 04 no Trello: aqui, o agente que revisa o PR a leria com um `git show`.

## Como entregar o Desafio

Por pull request neste repositório, até a sexta que fecha a sprint:

1. Faça fork e crie a branch `desafio/<seu-usuario>`.
2. Crie `entregas/<seu-usuario>.md` a partir de `entregas/TEMPLATE.md` (apague os níveis que não fez). Fez no `loja-legado`? O código vai na mesma PR. Fez no repositório do seu time? Só o relatório, sem código.
3. Abra a PR para a `main` com o título `[Desafio S2] <seu-usuario> · N1 N2 N3` (só os níveis que fez).

A PR não é mergeada: fica aberta como vitrine da turma.

**Privacidade:** a PR é pública. Não coloque nela código, métricas, políticas ou nomes internos da sua empresa: anonimize ou use o `loja-legado`; na dúvida, deixe de fora. Não rode código da empresa numa conta pessoal do Claude sem autorização do seu time de segurança.

## Licença

O Vendure é GPLv3. Este repositório de exercício segue a mesma licença.

## Notas do time anterior

Loja no Vendure. Rodar com `npm run dev`. O dashboard é o antigo admin.

Os helpers de `src/misc/` são do relatório do financeiro, não mexer.

Ver com o Fulano antes de mexer no preco.
