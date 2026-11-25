// numeros.js — leitura e formatação de números no padrão brasileiro.
// Funções puras, sem DOM. Ver docs/02_METODOS_E_FORMULAS.md, item 2.8.

/**
 * Converte texto digitado em número (float64).
 * Aceita vírgula ou ponto decimal e separador de milhar ("1.234,567" ou "1,234.567").
 * Retorna NaN para vazio ou texto inválido (quem chama decide a mensagem).
 */
export function parseDecimal(valor) {
  if (typeof valor === 'number') return valor;
  if (valor === null || valor === undefined) return NaN;
  let s = String(valor).trim().replace(/\s+/g, '');
  if (s === '') return NaN;

  const temVirgula = s.includes(',');
  const temPonto = s.includes('.');
  if (temVirgula && temPonto) {
    // O último separador é o decimal; o outro é de milhar.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (temVirgula) {
    if ((s.match(/,/g) || []).length > 1) return NaN;
    s = s.replace(',', '.');
  }
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return NaN;
  return Number(s);
}

/** Formata com vírgula decimal e número fixo de casas. Vazio para valores inválidos. */
export function formatar(valor, casas = 3) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '';
  // Evita "-0,000"
  const v = Math.abs(valor) < 0.5 * 10 ** -casas ? 0 : valor;
  return v.toFixed(casas).replace('.', ',');
}

/** Formata com sinal explícito (+/−), útil para desníveis e correções. */
export function formatarComSinal(valor, casas = 3) {
  const s = formatar(valor, casas);
  if (s === '') return '';
  return valor > 0 && Number(s.replace(',', '.')) !== 0 ? '+' + s : s;
}

/** Metros → milímetros. */
export const mm = (m) => m * 1000;
