// mensagens.js — lista de erros e avisos na tela, agrupando o mesmo aviso de várias linhas
// ("Linhas 2, 3 e 4: sem DH…") para não repetir o texto.

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function agruparMensagens(lista) {
  const grupos = new Map();
  const soltas = [];
  for (const m of lista) {
    const r = m.match(/^Linha (\d+)(?: \([^)]*\))?: (.+)$/);
    if (!r) { soltas.push({ ordem: soltas.length + grupos.size, texto: m }); continue; }
    const g = grupos.get(r[2]) ?? { ordem: soltas.length + grupos.size, linhas: [], primeira: m };
    g.linhas.push(r[1]);
    grupos.set(r[2], g);
  }
  const juntar = (l) => (l.length === 1 ? l[0] : `${l.slice(0, -1).join(', ')} e ${l.at(-1)}`);
  const agrupadas = [...grupos.entries()].map(([txt, g]) => ({
    ordem: g.ordem, texto: g.linhas.length === 1 ? g.primeira : `Linhas ${juntar(g.linhas)}: ${txt}`,
  }));
  return [...soltas, ...agrupadas].sort((a, b) => a.ordem - b.ordem).map((x) => x.texto);
}

/** HTML do bloco de mensagens (erros, avisos ou "sem erros"). */
export function htmlMensagens(erros, alertas, { okTexto = '✓ Sem erros nem alertas.', mostrarOk = true } = {}) {
  const e = agruparMensagens(erros), a = agruparMensagens(alertas);
  return `
    ${e.length ? `<h3 class="titulo-msg erro">Corrija (${e.length})</h3><ul class="msgs erro">${e.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
    ${a.length ? `<h3 class="titulo-msg alerta">Atenção (${a.length})</h3><ul class="msgs alerta">${a.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
    ${!e.length && !a.length && mostrarOk ? `<p class="status ok">${okTexto}</p>` : ''}`;
}

/** HTML do passo a passo (modo aula). Só <sub> é permitido no texto; o resto é escapado. */
export function htmlPassos(grupos) {
  if (!grupos.length) return '<p class="ajuda-curta">Digite a caderneta para ver as contas.</p>';
  const linha = (t) => esc(t).replace(/&lt;(\/?)sub&gt;/g, '<$1sub>');
  return grupos.map((g) => `<h4>${esc(g.titulo)}</h4><ul>${g.linhas.map((l) => `<li>${linha(l)}</li>`).join('')}</ul>`).join('');
}
