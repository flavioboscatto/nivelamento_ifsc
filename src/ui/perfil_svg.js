// perfil_svg.js — perfil simples: distância acumulada (x) × altura (y), em SVG próprio.
import { formatar } from '../core/numeros.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Passo "redondo" para os eixos (1, 2 ou 5 × 10^n). */
function passo(amplitude, alvo = 5) {
  const bruto = amplitude / alvo;
  const p10 = 10 ** Math.floor(Math.log10(bruto));
  return [1, 2, 5, 10].map((k) => k * p10).find((k) => k >= bruto) ?? p10 * 10;
}

/**
 * @param {Array<{ponto:string, H:number, distAcum:number, tipo:string}>} pontos
 * @returns {string} SVG ou '' se não houver pontos suficientes
 */
export function perfilSvg(pontos, { rotuloAltura = 'Altura (m)' } = {}) {
  const ps = pontos.filter((p) => Number.isFinite(p.H) && Number.isFinite(p.distAcum))
    .sort((a, b) => a.distAcum - b.distAcum);
  if (ps.length < 2) return '';

  const L = 900, A = 340, me = 70, md = 24, mt = 26, mb = 52;
  const xs = ps.map((p) => p.distAcum), ys = ps.map((p) => p.H);
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (x1 - x0 < 1e-9) x1 = x0 + 1;
  const folga = Math.max((y1 - y0) * 0.15, 0.05);
  y0 -= folga; y1 += folga;
  const px = (x) => me + (x - x0) / (x1 - x0) * (L - me - md);
  const py = (y) => mt + (y1 - y) / (y1 - y0) * (A - mt - mb);

  const grade = [];
  const sx = passo(x1 - x0), sy = passo(y1 - y0);
  for (let v = Math.ceil(x0 / sx) * sx; v <= x1 + 1e-9; v += sx) {
    grade.push(`<line class="grade" x1="${px(v)}" x2="${px(v)}" y1="${mt}" y2="${A - mb}"/>`,
      `<text class="eixo" x="${px(v)}" y="${A - mb + 18}" text-anchor="middle">${formatar(v, 0)}</text>`);
  }
  const casasY = sy < 0.1 ? 2 : sy < 1 ? 1 : 0;
  for (let v = Math.ceil(y0 / sy) * sy; v <= y1 + 1e-9; v += sy) {
    grade.push(`<line class="grade" x1="${me}" x2="${L - md}" y1="${py(v)}" y2="${py(v)}"/>`,
      `<text class="eixo" x="${me - 8}" y="${py(v) + 4}" text-anchor="end">${formatar(v, casasY)}</text>`);
  }

  const linha = ps.map((p) => `${px(p.distAcum).toFixed(1)},${py(p.H).toFixed(1)}`).join(' ');
  const marcas = ps.map((p) => `
    <g class="ponto ${p.tipo}">
      <circle cx="${px(p.distAcum)}" cy="${py(p.H)}" r="${p.tipo === 'irradiado' ? 3.5 : 5}"/>
      <text x="${px(p.distAcum)}" y="${py(p.H) - 10}" text-anchor="middle">${esc(p.ponto)}</text>
      <title>${esc(p.ponto)}: ${formatar(p.H, 3)} m a ${formatar(p.distAcum, 1)} m</title>
    </g>`).join('');

  return `<svg class="perfil" viewBox="0 0 ${L} ${A}" role="img" aria-label="Perfil: altura dos pontos pela distância acumulada">
    ${grade.join('')}
    <line class="eixo-linha" x1="${me}" x2="${L - md}" y1="${A - mb}" y2="${A - mb}"/>
    <line class="eixo-linha" x1="${me}" x2="${me}" y1="${mt}" y2="${A - mb}"/>
    <polyline class="traco" points="${linha}"/>
    ${marcas}
    <text class="titulo-eixo" x="${(me + L - md) / 2}" y="${A - 10}" text-anchor="middle">Distância acumulada (m)</text>
    <text class="titulo-eixo" x="16" y="${(mt + A - mb) / 2}" text-anchor="middle" transform="rotate(-90 16 ${(mt + A - mb) / 2})">${esc(rotuloAltura)}</text>
  </svg>`;
}
