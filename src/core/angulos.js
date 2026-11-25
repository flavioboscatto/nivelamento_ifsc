// angulos.js — conversões angulares e séries conjugadas (PD/PI).
// Unidade interna: radianos. Ver docs/02_METODOS_E_FORMULAS.md, itens 2.3.3 e 2.7.

import { parseDecimal, formatar } from './numeros.js';

export const RAD_POR_GRAU = Math.PI / 180;
export const RAD_POR_SEGUNDO = Math.PI / 648000;

export const grausParaRad = (g) => g * RAD_POR_GRAU;
export const radParaGraus = (r) => r / RAD_POR_GRAU;
export const gonParaRad = (gon) => gon * 0.9 * RAD_POR_GRAU;
export const radParaGon = (r) => radParaGraus(r) / 0.9;
export const segundosParaRad = (s) => s * RAD_POR_SEGUNDO;

/** Graus, minutos e segundos → graus decimais. O sinal vem dos graus (ou de "-" no texto). */
export function dmsParaGraus(g, m = 0, s = 0, negativo = false) {
  const v = Math.abs(g) + m / 60 + s / 3600;
  return (negativo || g < 0) ? -v : v;
}

/** Graus decimais → {g, m, s} com segundos arredondados a `casasSeg` casas, sem gerar 60". */
export function grausParaDms(graus, casasSeg = 0) {
  const neg = graus < 0;
  let total = Math.abs(graus) * 3600;
  const f = 10 ** casasSeg;
  total = Math.round(total * f) / f;
  const g = Math.floor(total / 3600);
  const m = Math.floor((total - g * 3600) / 60);
  const s = total - g * 3600 - m * 60;
  return { neg, g, m, s: Math.round(s * f) / f };
}

/** Formata radianos como 91°19'40" (ou com décimos de segundo). */
export function formatarDms(rad, casasSeg = 0) {
  const { neg, g, m, s } = grausParaDms(radParaGraus(rad), casasSeg);
  const ss = casasSeg > 0 ? formatar(s, casasSeg).padStart(3 + casasSeg, '0') : String(Math.round(s)).padStart(2, '0');
  return `${neg ? '-' : ''}${g}°${String(m).padStart(2, '0')}'${ss}"`;
}

/**
 * Interpreta um ângulo digitado e devolve radianos (NaN se inválido).
 * Formatos aceitos:
 *   91°19'40"  |  91°19'40,5"  |  91 19 40  |  91-19-40
 *   91,32778 ou 91.32778 (graus decimais)
 *   101,4753g  ou  101,4753 gon  (grados)
 * Opção `ddmmss: true` interpreta "91.1940" como 91°19'40" (formato de calculadora).
 */
export function parseAngulo(texto, { ddmmss = false } = {}) {
  if (typeof texto === 'number') return grausParaRad(texto);
  if (texto === null || texto === undefined) return NaN;
  let s = String(texto).trim().toLowerCase();
  if (s === '') return NaN;
  const neg = s.startsWith('-');
  if (neg) s = s.slice(1).trim();

  // Grados
  const mGon = s.match(/^([\d.,]+)\s*(g|gon|grd)$/);
  if (mGon) {
    const v = parseDecimal(mGon[1]);
    return Number.isFinite(v) ? (neg ? -1 : 1) * gonParaRad(v) : NaN;
  }

  // Sexagesimal com símbolos ou separado por espaço/hífen
  const partes = s
    .replace(/[°º]/g, ' ').replace(/[’'′]/g, ' ').replace(/["”″]|''/g, ' ')
    .replace(/-/g, ' ').trim().split(/\s+/);
  if (partes.length >= 2 && partes.length <= 3) {
    const g = parseDecimal(partes[0]);
    const m = parseDecimal(partes[1]);
    const segundos = partes.length === 3 ? parseDecimal(partes[2]) : 0;
    if (![g, m, segundos].every(Number.isFinite)) return NaN;
    if (m >= 60 || segundos >= 60 || m < 0 || segundos < 0) return NaN;
    return grausParaRad(dmsParaGraus(g, m, segundos, neg));
  }

  // Número simples: decimal ou DD.MMSS
  const v = parseDecimal(s);
  if (!Number.isFinite(v)) return NaN;
  if (ddmmss) {
    const g = Math.trunc(v);
    const resto = Math.round((v - g) * 1e6) / 1e6; // 0.1940
    const m = Math.trunc(resto * 100 + 1e-9);
    const seg = (resto * 100 - m) * 100;
    if (m >= 60 || seg >= 60) return NaN;
    return grausParaRad(dmsParaGraus(g, m, seg, neg));
  }
  return grausParaRad(neg ? -v : v);
}

/** Reduz ângulo a [0, 2π). */
export function reduzir2Pi(rad) {
  const r = rad % (2 * Math.PI);
  return r < 0 ? r + 2 * Math.PI : r;
}

/**
 * Série conjugada de ângulo zenital (NBR 13133:2021, 5.2.10).
 * Z = (Z_PD − Z_PI + 360°)/2 ; erro de índice ε = (Z_PD + Z_PI − 360°)/2
 */
export function zenitalPdPi(zPD, zPI) {
  const volta = 2 * Math.PI;
  return {
    z: (zPD - zPI + volta) / 2,
    erroIndice: (zPD + zPI - volta) / 2,
  };
}
