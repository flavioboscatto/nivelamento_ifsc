// paginas/apoio.js — estatística de séries de observações (etapa 7; AA Exemplo I).
import { analisarSerie, lerSerie } from '../../core/estatistica.js';
import { parseDecimal, formatar, formatarComSinal } from '../../core/numeros.js';
import { criarProjeto, serializarProjeto, lerProjeto, nomeArquivo } from '../../io/projeto.js';

const CHAVE_RASCUNHO = 'nivelamento-ifsc.apoio.v1';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Dados do AA Exemplo I (caso S01 de tests/casos_referencia.json)
const EXEMPLO = {
  grandeza: 'AA Exemplo I — série de 10 observações', unidade: 'm', criterio: '3s', limite: '', remover: true,
  valores: '12,792\n12,785\n12,783\n12,788\n12,794\n12,791\n12,718\n12,798\n12,800\n12,790',
};

let excluidas = new Set(); // índices excluídos à mão

/** Casas decimais digitadas (maior quantidade entre os valores). */
function casasDigitadas(texto) {
  const m = String(texto).split(/[\s;]+/).map((p) => (p.match(/[.,](\d+)$/) || [, ''])[1].length);
  return Math.max(0, ...m);
}

function lerForm() {
  return {
    grandeza: $('grandeza').value, unidade: $('unidade').value, criterio: $('criterio').value,
    limite: $('limite').value, remover: $('remover').checked, valores: $('valores').value,
    excluidas: [...excluidas],
  };
}
function definirForm(d = {}) {
  if (d.grandeza !== undefined) $('grandeza').value = d.grandeza;
  if (d.unidade !== undefined) $('unidade').value = d.unidade;
  if (d.criterio) $('criterio').value = d.criterio;
  if (d.limite !== undefined) $('limite').value = d.limite;
  if (d.remover !== undefined) $('remover').checked = !!d.remover;
  if (d.valores !== undefined) $('valores').value = d.valores;
  excluidas = new Set(d.excluidas || []);
  $('rot-limite').hidden = $('criterio').value !== 'fixo';
}

function recalcular() {
  const d = lerForm();
  $('rot-limite').hidden = d.criterio !== 'fixo';
  const un = d.unidade.trim() || 'm';
  const emMm = un === 'm';
  const { valores, invalidos } = lerSerie(d.valores, parseDecimal);
  excluidas = new Set([...excluidas].filter((i) => i < valores.length));
  const erros = invalidos.map((x) => `O ${x.posicao}º valor ("${x.texto}") não é um número.`);
  const limite = parseDecimal(d.limite);
  if (d.criterio === 'fixo' && !Number.isFinite(limite)) erros.push('Informe o limite fixo (mm) para detectar atípicas.');
  salvarRascunho();

  if (valores.length < 3) {
    $('mensagens').innerHTML = `${erros.length ? `<ul class="msgs erro">${erros.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}<p class="status neutro">Digite pelo menos três observações.</p>`;
    ['resultado-final', 'resumo-todas', 'resumo-final', 'tabela-obs', 'grafico'].forEach((id) => { $(id).innerHTML = ''; });
    return;
  }

  const r = analisarSerie(valores, {
    limiteFixo: d.criterio === 'fixo' && Number.isFinite(limite) ? limite / 1000 : null,
    removerAtipicas: d.remover, excluidas: [...excluidas],
  });
  const c = casasDigitadas(d.valores) || 3;
  const fx = (v, extra = 1) => formatar(v, c + extra);
  const fres = (v) => (emMm ? formatarComSinal(v * 1000, 1) : formatarComSinal(v, c + 1));
  const uRes = emMm ? 'mm' : un;
  const idxAtip = new Set(r.atipicas.map((a) => a.indice));

  const alertas = r.atipicas.map((a) => `Observação ${a.indice + 1} (${fx(a.valor, 0)} ${un}) é atípica: afasta-se ${emMm ? `${formatar(a.afastamento * 1000, 1)} mm` : `${fx(a.afastamento)} ${un}`} da média das demais${d.remover ? ' e foi retirada do resultado' : ''}.`);
  if (r.final.n < 3) erros.push('Restam menos de três observações no resultado final.');
  $('mensagens').innerHTML = `
    ${erros.length ? `<h3 class="titulo-msg erro">Corrija (${erros.length})</h3><ul class="msgs erro">${erros.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
    ${alertas.length ? `<h3 class="titulo-msg alerta">Atenção (${alertas.length})</h3><ul class="msgs alerta">${alertas.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
    ${!erros.length && !alertas.length ? '<p class="status ok">✓ Nenhuma observação atípica.</p>' : ''}`;

  $('resultado-final').innerHTML = Number.isFinite(r.final.sMedia)
    ? `x̄ ± s<sub>x̄</sub> = ${fx(r.final.media, 0)} ± ${fx(r.final.sMedia, 0)} ${esc(un)}<small>${esc(d.grandeza || 'Resultado')} — ${r.final.n} de ${valores.length} observações (média ${fx(r.final.media)}; s<sub>x̄</sub> = ${fx(r.final.sMedia)})</small>`
    : '';

  const bloco = (s) => `<dl class="lista-def">
    <div><dt>Observações (n)</dt><dd>${s.n}</dd></div>
    <div><dt>Média x̄</dt><dd>${fx(s.media)} ${esc(un)}</dd></div>
    <div><dt>Desvio-padrão s</dt><dd>${fx(s.s)} ${esc(un)}</dd></div>
    <div><dt>Desvio-padrão da média s<sub>x̄</sub></dt><dd>${fx(s.sMedia)} ${esc(un)}</dd></div></dl>`;
  $('resumo-todas').innerHTML = bloco(r.todas);
  $('resumo-final').innerHTML = bloco(r.final);

  $('tabela-obs').innerHTML = `<table class="tabela-resultado">
    <thead><tr><th scope="col">Nº</th><th scope="col" class="n">Observação (${esc(un)})</th>
      <th scope="col" class="n">v com todas (${uRes})</th><th scope="col" class="n">v final (${uRes})</th>
      <th scope="col">Situação</th><th scope="col" class="nao-imprimir">Usar</th></tr></thead>
    <tbody>${valores.map((x, i) => {
      const sit = excluidas.has(i) ? 'Excluída à mão' : idxAtip.has(i) ? (d.remover ? 'Atípica — retirada' : 'Atípica — mantida') : 'Usada';
      return `<tr><th scope="row">${i + 1}</th><td class="n">${fx(x, 0)}</td><td class="n">${fres(r.todas.residuos[i])}</td>
        <td class="n">${r.usadas[i] ? fres(r.residuosFinais[i]) : '—'}</td>
        <td class="${r.usadas[i] ? '' : 'txt-falha'}">${sit}</td>
        <td class="nao-imprimir"><input type="checkbox" data-usar="${i}" ${excluidas.has(i) ? '' : 'checked'} aria-label="Usar a observação ${i + 1}"></td></tr>`;
    }).join('')}</tbody></table>`;

  $('grafico').innerHTML = graficoSerie(valores, r, { un, fx });
}

/** Gráfico das observações com a linha da média (como as Figuras 7 e 8 da AA). */
function graficoSerie(obs, r, { un, fx }) {
  const L = 900, A = 340, me = 80, md = 24, mt = 30, mb = 60;
  const n = obs.length;
  const fim = r.final;
  const lim = Number.isFinite(fim.s) ? [fim.media - 3 * fim.s, fim.media + 3 * fim.s] : [];
  let y0 = Math.min(...obs, ...lim), y1 = Math.max(...obs, ...lim);
  const folga = Math.max((y1 - y0) * 0.1, 1e-4); y0 -= folga; y1 += folga;
  const px = (i) => me + (n === 1 ? 0.5 : i / (n - 1)) * (L - me - md);
  const py = (v) => mt + (y1 - v) / (y1 - y0) * (A - mt - mb);
  const linhaH = (v, cls) => `<line class="${cls}" x1="${me}" x2="${L - md}" y1="${py(v)}" y2="${py(v)}"/>`;
  const marcasY = Array.from({ length: 5 }, (_, k) => y0 + (k + 0.5) * (y1 - y0) / 5)
    .map((v) => `<line class="grade" x1="${me}" x2="${L - md}" y1="${py(v)}" y2="${py(v)}"/><text class="eixo" x="${me - 8}" y="${py(v) + 4}" text-anchor="end">${fx(v)}</text>`).join('');
  const pontos = obs.map((v, i) => `<g class="obs${r.usadas[i] ? '' : ' fora'}"><circle cx="${px(i)}" cy="${py(v)}" r="5.5"/>
    <text x="${px(i)}" y="${A - mb + 18}" text-anchor="middle" class="eixo">${i + 1}</text>
    ${r.usadas[i] ? '' : `<text x="${px(i)}" y="${py(v) - 12}" text-anchor="middle">${i + 1}</text>`}
    <title>Observação ${i + 1}: ${fx(v, 0)} ${un}</title></g>`).join('');
  return `<svg class="perfil grafico-serie" viewBox="0 0 ${L} ${A}" role="img" aria-label="Observações e média da série">
    ${marcasY}
    <line class="eixo-linha" x1="${me}" x2="${L - md}" y1="${A - mb}" y2="${A - mb}"/>
    <line class="eixo-linha" x1="${me}" x2="${me}" y1="${mt}" y2="${A - mb}"/>
    ${linhaH(r.todas.media, 'media-todas')}
    ${lim.length ? linhaH(lim[0], 'limite') + linhaH(lim[1], 'limite') : ''}
    ${Number.isFinite(fim.media) ? linhaH(fim.media, 'media') : ''}
    ${pontos}
    <text class="titulo-eixo" x="${(me + L - md) / 2}" y="${A - 22}" text-anchor="middle">Observação</text>
    <text class="titulo-eixo" x="16" y="${(mt + A - mb) / 2}" text-anchor="middle" transform="rotate(-90 16 ${(mt + A - mb) / 2})">Valor (${esc(un)})</text>
    <g class="legenda" transform="translate(${me + 8} ${A - 6})">
      <line class="media" x1="0" x2="26" y1="-4" y2="-4"/><text x="32" y="0">média final</text>
      <line class="media-todas" x1="130" x2="156" y1="-4" y2="-4"/><text x="162" y="0">média com todas</text>
      <line class="limite" x1="300" x2="326" y1="-4" y2="-4"/><text x="332" y="0">média final ± 3 s</text>
    </g>
  </svg>`;
}

function salvarRascunho() {
  try { localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify({ nome: $('nome-projeto').value, ...lerForm() })); } catch { /* sem armazenamento */ }
}

function salvarProjeto() {
  const d = lerForm();
  const p = criarProjeto({ nome: $('nome-projeto').value.trim(), modulo: 'apoio', modo: 'estatistica', cabecalho: d, linhas: [{ valores: d.valores }] });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([serializarProjeto(p)], { type: 'application/json' }));
  a.download = nomeArquivo(p.nome, 'estatistica');
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function abrirProjeto(ev) {
  const arq = ev.target.files?.[0];
  ev.target.value = '';
  if (!arq) return;
  const r = lerProjeto(await arq.text(), { modulo: 'apoio' });
  if (!r.ok) { alert(r.erro); return; }
  $('nome-projeto').value = r.projeto.nome || '';
  definirForm(r.projeto.cabecalho);
  recalcular();
}

function iniciar() {
  let rasc = null;
  try { rasc = JSON.parse(localStorage.getItem(CHAVE_RASCUNHO) || 'null'); } catch { /* */ }
  if (rasc) { $('nome-projeto').value = rasc.nome || ''; definirForm(rasc); }
  $('form-serie').addEventListener('input', recalcular);
  $('form-serie').addEventListener('change', recalcular);
  $('form-serie').addEventListener('submit', (e) => e.preventDefault());
  $('tabela-obs').addEventListener('change', (ev) => {
    const cb = ev.target.closest('[data-usar]');
    if (!cb) return;
    const i = Number(cb.dataset.usar);
    if (cb.checked) excluidas.delete(i); else excluidas.add(i);
    recalcular();
  });
  $('nome-projeto').addEventListener('input', salvarRascunho);
  $('bt-exemplo').addEventListener('click', () => { definirForm(EXEMPLO); recalcular(); });
  $('bt-limpar').addEventListener('click', () => { if (confirm('Apagar os valores digitados?')) { definirForm({ valores: '', excluidas: [] }); recalcular(); } });
  $('bt-imprimir').addEventListener('click', () => window.print());
  $('bt-salvar').addEventListener('click', salvarProjeto);
  $('bt-abrir').addEventListener('click', () => $('arquivo-projeto').click());
  $('arquivo-projeto').addEventListener('change', abrirProjeto);
  recalcular();
}

iniciar();
