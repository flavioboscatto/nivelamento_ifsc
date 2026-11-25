// csv.js — gravação de CSV no padrão brasileiro: ";" como separador, vírgula decimal (os textos
// já chegam formatados), UTF-8 com BOM para o Excel reconhecer os acentos. Funções puras.

export const BOM = '﻿';

/** Protege um campo: aspas se tiver ";", aspas ou quebra de linha. */
export function campoCsv(v) {
  const s = String(v ?? '').replace(/\r?\n/g, ' ').trim();
  return /[;"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * @param {string[][]} linhas  primeira linha = cabeçalho
 * @param {{cabecalhoArquivo?: string[]}} op  linhas de identificação antes da tabela (ex.: projeto, norma)
 */
export function gerarCsv(linhas, { cabecalhoArquivo = [] } = {}) {
  const corpo = linhas.map((l) => l.map(campoCsv).join(';'));
  const topo = cabecalhoArquivo.map((t) => campoCsv(t));
  return BOM + [...topo, ...(topo.length ? [''] : []), ...corpo].join('\r\n') + '\r\n';
}
