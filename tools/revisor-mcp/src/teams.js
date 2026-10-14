import { listRules, listAdrs } from './db.js';

// Time existe se tem ao menos uma regra ou ADR. Devolve o resultado de erro da tool (com os times válidos) ou null.
// Mesmo contrato de get_team_review_rules e search_team_adrs: id desconhecido é erro, não "dado vazio".
export function erroDeTime(team_id) {
  const times = [...new Set([...listRules(), ...listAdrs()].map((x) => x.team_id))].sort();
  if (times.includes(team_id)) return null;
  return {
    isError: true,
    content: [{ type: 'text', text: `Unknown team_id: "${team_id}". Valid teams: ${times.join(', ')}. Retry with one of the valid team ids.` }],
  };
}
