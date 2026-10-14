// Padrões de segredo que o servidor recusa gravar no histórico (log_review.summary).
// É um piso, não uma garantia: um filtro por padrão não pega todo segredo, só os formatos conhecidos
// e o valor literal que o diff do PR de exemplo carrega. O prompt e o deny do Read continuam necessários.
const PADROES = [
  ['chave sk_live_/sk_test_', /sk_(live|test)_[A-Za-z0-9_]{6,}/],
  ['token do GitHub', /\b(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/],
  ['chave de acesso AWS', /\bAKIA[0-9A-Z]{16}\b/],
  ['cabeçalho Bearer com token', /\bBearer\s+[A-Za-z0-9._~+/-]{16,}/],
  ['NOME_KEY/TOKEN/SECRET/PASSWORD com valor', /\b[A-Z][A-Z0-9_]*(KEY|TOKEN|SECRET|PASSWORD)\s*[=:]\s*['"]?[^\s'",;]{6,}/],
];

// Devolve o nome do primeiro padrão encontrado em text, ou null. Nunca devolve o trecho casado.
export function findSecret(text) {
  for (const [nome, re] of PADROES) if (re.test(text)) return nome;
  return null;
}
