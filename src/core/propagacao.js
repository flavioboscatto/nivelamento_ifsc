// propagacao.js — desvio-padrão das alturas no circuito, na linha e no transporte de RN.
// Doc 4, itens 4.3.2–4.3.6 (D16, D24). Variâncias em m².

/**
 * Variância de uma estação (lance):
 *  - pela leitura (NBR F.1, sem simplificação): Vj = (σL·DHré)² + (σL·DHvante)²
 *  - pelo σ por km: Vj = σkm² · (DHré + DHvante)/1000
 */
export const varianciaEstacaoLeitura = (sigmaL, dhRe, dhVante) => (sigmaL * dhRe) ** 2 + (sigmaL * dhVante) ** 2;
export const varianciaEstacaoKm = (sigmaKm, dhRe, dhVante) => sigmaKm ** 2 * ((dhRe + dhVante) / 1000);

/**
 * (a) Circuito fechado — mesma RN no início e no fim:
 *   σP² = σRN² + Va (VT − Va) / VT
 */
export function sigmaCircuito(sigmaRN, Va, VT) {
  if (!(VT > 0)) return Math.abs(sigmaRN);
  return Math.sqrt(sigmaRN ** 2 + Va * (VT - Va) / VT);
}

/**
 * (b) Linha entre RN distintas A e B:
 *   V1 = σA² + Va;  V2 = σB² + (VT − Va);  σP² = V1·V2 / (V1 + V2)
 */
export function sigmaLinha(sigmaA, sigmaB, Va, VT) {
  const V1 = sigmaA ** 2 + Va;
  const V2 = sigmaB ** 2 + (VT - Va);
  if (V1 + V2 <= 0) return 0;
  return Math.sqrt(V1 * V2 / (V1 + V2));
}

/** (c) Transporte com nivelamento e contranivelamento: σ²RN2 = σ²RN1 + ¼ (Vida + Vvolta). */
export function sigmaTransporte(sigmaRN1, Vida, Vvolta) {
  return Math.sqrt(sigmaRN1 ** 2 + (Vida + Vvolta) / 4);
}

/** (e) Anexo L (modo simplificado): menor σ entre os dois sentidos. */
export function sigmaAnexoLCircuito(sigmaRN, Va, VT) {
  return Math.sqrt(sigmaRN ** 2 + Math.min(Va, VT - Va));
}
export function sigmaAnexoLLinha(sigmaA, sigmaB, Va, VT) {
  return Math.sqrt(Math.min(sigmaA ** 2 + Va, sigmaB ** 2 + (VT - Va)));
}
