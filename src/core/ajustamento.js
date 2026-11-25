// ajustamento.js — distribuição do erro de fechamento (doc 2, 2.2.8).
// Funções puras. Convenção: erro e = H calculada no fecho − H conhecida; correção v = −(parcela de e).

/**
 * (b) Proporcional à distância — NBR 13133:2021, 5.5.2.12 (padrão do programa, D23):
 *   vP = −e · d_acum(P) / d_total
 * @returns {number} correção em m (NaN se faltar a distância)
 */
export function correcaoProporcional(erro_m, distAcum_m, distTotal_m) {
  if (![erro_m, distAcum_m, distTotal_m].every(Number.isFinite) || distTotal_m <= 0) return NaN;
  return -erro_m * distAcum_m / distTotal_m;
}

/**
 * (a) Por estação — método da apostila (AA Eq. 24–26), opção didática não prevista na NBR 2021:
 *   C = e / n_estações;  vP = −N · C  (N = ordem da estação que visou P)
 * `arredondarC` reproduz a apostila (C arredondado a 0,1 mm antes de multiplicar — errata E2).
 */
export function correcaoPorEstacao(erro_m, nEstacoes, N, { arredondarC = false } = {}) {
  if (!Number.isFinite(erro_m) || !(nEstacoes > 0) || !Number.isFinite(N)) return NaN;
  let C = erro_m / nEstacoes;
  if (arredondarC) C = Math.round(C * 10000) / 10000;
  return -N * C;
}

/** C = e / n (m por estação), com ou sem o arredondamento da apostila. */
export function correcaoPorEstacaoC(erro_m, nEstacoes, { arredondarC = false } = {}) {
  let C = erro_m / nEstacoes;
  if (arredondarC) C = Math.round(C * 10000) / 10000;
  return C;
}
