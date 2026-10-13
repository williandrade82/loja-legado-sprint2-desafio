import { z } from 'zod';
import { listRules } from '../db.js';

// Anatomia de uma tool bem desenhada (4 pilares do curso: clareza, granularidade,
// eficiência, previsibilidade):
//   nome      -> verbo + objeto, snake_case
//   descrição -> 3 frases: o que faz / quando usar / o que retorna
//   schema    -> Zod com enum, optional, default e describe (documentação viva)
//   retorno   -> só o que o agente precisa, sem metadata
// Clientes como o MCP Inspector enviam "" para campo deixado em branco; trata como omitido.
const vazioComoOmitido = (schema) => z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

export function registerReviewRulesTools(server) {
  server.registerTool(
    'get_team_review_rules',
    {
      title: 'Get Team Review Rules',
      description:
        'Retrieves the ACTIVE code review rules of a team. ' +
        'Use this when reviewing a PR to know which standards the team enforces. ' +
        'Returns rules with category and severity; "error" = must fix (blocks the PR), "warning" = should fix, "info" = nice to have. ' +
        'An unknown team_id is an error that lists the valid teams; a valid team whose filters match nothing returns an empty list (count 0), which is a valid answer, not an error.',
      inputSchema: {
        team_id: z.string().min(1).describe('Team identifier, must exist (e.g. "loja"). An unknown id returns an error listing the valid teams.'),
        category: vazioComoOmitido(z.enum(['security', 'architecture', 'style', 'performance']))
          .describe('Filter by category. Omit to get all categories.'),
        severity: vazioComoOmitido(z.enum(['error', 'warning', 'info']))
          .describe('Filter by severity. Omit to get all severities.'),
        limit: z.number().int().min(1).max(50).default(20).describe('Max rules to return (1-50, default 20).'),
      },
    },
    async ({ team_id, category, severity, limit }) => {
      const todas = listRules();
      // Time existe se tem ao menos uma regra (ativa ou não); lista vazia de time válido não é erro.
      const times = [...new Set(todas.map((r) => r.team_id))].sort();
      if (!times.includes(team_id)) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Unknown team_id: "${team_id}". Valid teams: ${times.join(', ')}. Retry with one of the valid team ids.`,
            },
          ],
        };
      }

      const order = { error: 0, warning: 1, info: 2 };
      const rules = todas
        .filter((r) => r.team_id === team_id && r.active)
        .filter((r) => !category || r.category === category)
        .filter((r) => !severity || r.severity === severity)
        .sort((a, b) => order[a.severity] - order[b.severity])
        .slice(0, limit)
        .map(({ id, category, severity, rule }) => ({ id, category, severity, rule }));

      return {
        content: [{ type: 'text', text: JSON.stringify({ rules, count: rules.length }) }],
      };
    }
  );
}
