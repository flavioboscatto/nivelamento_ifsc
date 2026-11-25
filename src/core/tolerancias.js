// tolerancias.js — classificação pela NBR 13133:2021.
// Os limites vêm sempre de data/norma_nbr13133_2021.json (passados como argumento).
// Ver docs/03_PARAMETROS_NBR13133.md, 3.1.3. As tolerâncias de fechamento entram na etapa 4.

import { formatar } from './numeros.js';

/**
 * Classe do nível (Tabela 3) pelo desvio-padrão de 1 km de duplo nivelamento.
 * @param {number} sigmaKm_mm
 * @param {Array<number|null>} limites  ex.: [1, 2, 6, null] (null = sem limite superior)
 * @returns {{classe:number, rotulo:string}|null}
 */
export function classeDoNivel(sigmaKm_mm, limites) {
  if (!Number.isFinite(sigmaKm_mm) || sigmaKm_mm <= 0) return null;
  for (let i = 0; i < limites.length; i++) {
    const lim = limites[i];
    if (lim === null || sigmaKm_mm <= lim) {
      const classe = i + 1;
      const faixa = lim === null ? `> ${formatar(limites[i - 1], 0)} mm/km` : `≤ ${formatar(lim, 0)} mm/km`;
      return { classe, rotulo: `classe ${classe} (NBR 2021) — ${faixa}` };
    }
  }
  return null;
}

/**
 * Tolerância de fechamento do nivelamento geométrico (NBR 13133:2021, Tabela 5): T = t · √K.
 * @param {number} tol_mm_raizK  t em mm (6, 8 ou 12 — do JSON da norma)
 * @param {number} K_km          extensão nivelada em um sentido (km)
 * @returns {number} T em mm
 */
export function toleranciaFechamento_mm(tol_mm_raizK, K_km) {
  if (!Number.isFinite(tol_mm_raizK) || !Number.isFinite(K_km) || K_km < 0) return NaN;
  return tol_mm_raizK * Math.sqrt(K_km);
}

/**
 * Avalia o erro de fechamento em todas as classes da Tabela 5.
 * @param {number} erro_m
 * @param {number} K_km
 * @param {Array<{id, rotulo, tol_mm_raizK}>} classes  norma.geometrico
 * @returns {Array<{id, rotulo, t, T_mm, atende}>}
 */
export function avaliarFechamento(erro_m, K_km, classes) {
  const e_mm = Math.abs(erro_m * 1000);
  return classes.map((c) => {
    const T_mm = toleranciaFechamento_mm(c.tol_mm_raizK, K_km);
    return { id: c.id, rotulo: c.rotulo, t: c.tol_mm_raizK, T_mm, atende: Number.isFinite(T_mm) && e_mm <= T_mm };
  });
}
