import { z } from 'zod';
import { listAdrs, listRules } from '../db.js';

// "dependencia" acha "dependência": o agente nem sempre digita o acento.
const normalizar = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function registerAdrTools(server) {
  server.registerTool(
    'search_team_adrs',
    {
      title: 'Search Team ADRs',
      description:
        'Searches ACCEPTED Architecture Decision Records of a team by keyword or id (id, title, context or decision). ' +
        'Use this when a PR touches an architectural concern (money, discounts, shipping, dependencies, dates) or cites an ADR. ' +
        'Returns { adrs, count } with only accepted ADRs; proposed and deprecated ones are excluded, so an ADR cited in a PR but not returned here is not an accepted decision. ' +
        'An unknown team_id is an error that lists the valid teams; a valid team with no matching ADR returns count 0, which is a valid answer, not an error.',
      inputSchema: {
        team_id: z.string().min(1).describe('Team identifier (e.g. "loja").'),
        keyword: z
          .string()
          .min(2)
          .describe('Search term or ADR id, e.g. "desconto", "frete", "centavos", "ADR-002". Case- and accent-insensitive.'),
      },
    },
    async ({ team_id, keyword }) => {
      // Time existe se tem regra ou ADR (o checkout tem regras e nenhuma ADR: lista vazia dele não é erro).
      const times = [...new Set([...listRules(), ...listAdrs()].map((x) => x.team_id))].sort();
      if (!times.includes(team_id)) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Unknown team_id: "${team_id}". Valid teams: ${times.join(', ')}. Retry with one of the valid team ids.` }],
        };
      }
      const k = normalizar(keyword);
      const adrs = listAdrs()
        .filter((a) => a.team_id === team_id && a.status === 'accepted')
        .filter((a) => normalizar([a.id, a.title, a.context, a.decision].join(' ')).includes(k))
        .map(({ id, title, decision }) => ({ id, title, decision }));

      return {
        content: [{ type: 'text', text: JSON.stringify({ adrs, count: adrs.length }) }],
      };
    }
  );
}
