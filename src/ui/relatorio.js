// relatorio.js — relatório para impressão/PDF e exportação CSV, comum às páginas de cálculo.
// O relatório é montado a partir do que já está calculado na tela (tabelas, cartões, perfil),
// com as entradas trocadas por texto. Fontes pretas, tabelas sem preenchimento, títulos numerados,
// rodapé com o nome do programa, data/hora e página (NBR 13133:2021, 5.8: itens aplicáveis).

import { gerarCsv } from '../io/csv.js';
import { gerarXlsx } from '../io/xlsx.js';
import { gerarDocx } from '../io/docx.js';
import { svgParaPng } from './figuras.js';
import { nomeArquivo } from '../io/projeto.js';

const PROGRAMA = 'Calculadora de Nivelamento IFSC';
const NORMA = 'ABNT NBR 13133:2021';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const CAMPOS_RELATORIO = {
  objeto: ['rel-objeto', 'Objeto / serviço'],
  finalidade: ['rel-finalidade', 'Finalidade'],
  local: ['rel-local', 'Local'],
  data: ['rel-data', 'Data do levantamento'],
  equipe: ['rel-equipe', 'Equipe'],
  operador: ['rel-operador', 'Operador do instrumento'],
};

export function obterDadosRelatorio() {
  return Object.fromEntries(Object.entries(CAMPOS_RELATORIO).map(([k, [id]]) => [k, $(id)?.value ?? '']));
}
export function definirDadosRelatorio(d = {}) {
  for (const [k, [id]] of Object.entries(CAMPOS_RELATORIO)) if ($(id) && d[k] !== undefined) $(id).value = d[k];
}

const agoraTexto = () => new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const dataBr = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : iso);

/** Cópia estática de um elemento: entradas viram texto; botões e itens de tela saem. */
export function clonarEstatico(el) {
  if (!el) return null;
  const c = el.cloneNode(true);
  const origem = el.querySelectorAll('input, select, textarea');
  c.querySelectorAll('input, select, textarea').forEach((campo, k) => {
    const o = origem[k];
    let txt = '';
    if (o.tagName === 'SELECT') txt = o.value ? o.selectedOptions[0]?.textContent ?? '' : '';
    else if (o.type === 'checkbox' || o.type === 'radio') txt = o.checked ? '✓' : '';
    else txt = o.value || (o.placeholder && o.closest('td') ? o.placeholder : '');
    const span = document.createElement('span');
    span.textContent = txt;
    if (!o.value && o.placeholder && o.closest('td')) span.className = 'calculado';
    campo.replaceWith(span);
  });
  c.querySelectorAll('.nao-imprimir, .acao, button, [hidden]').forEach((x) => x.remove());
  c.removeAttribute('id');
  c.querySelectorAll('[id]').forEach((x) => x.removeAttribute('id'));
  return c;
}

/** Tabela estática sem linhas vazias e sem colunas vazias (ex.: FS/FI não usados). */
export function tabelaEnxuta(tabela, { tirarColunas = [] } = {}) {
  const t = clonarEstatico(tabela);
  if (!t) return null;
  const corpo = [...t.querySelectorAll('tbody tr')];
  corpo.forEach((tr) => {
    const celulas = [...tr.children].slice(1);
    if (celulas.every((td) => td.textContent.trim() === '')) tr.remove();
  });
  const linhas = [...t.querySelectorAll('tr')];
  const nCol = Math.max(...linhas.map((tr) => tr.children.length));
  const cab = [...(t.querySelector('thead tr')?.children ?? [])].map((th) => th.textContent.trim());
  for (let j = nCol - 1; j >= 1; j--) {
    const vazia = [...t.querySelectorAll('tbody tr')].every((tr) => (tr.children[j]?.textContent.trim() ?? '') === '');
    if (vazia || tirarColunas.includes(cab[j])) linhas.forEach((tr) => tr.children[j]?.remove());
  }
  return t;
}

/** Linhas de texto de uma tabela (para CSV). */
export function linhasDaTabela(tabela) {
  if (!tabela) return [];
  const t = tabela.cloneNode(true);
  t.querySelectorAll('br').forEach((br) => br.replaceWith(' '));
  return [...t.querySelectorAll('tr')].map((tr) => [...tr.children].map((c) => c.textContent.replace(/\s+/g, ' ').trim()));
}

function baixar(texto, nome, tipo) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([texto], { type: tipo }));
  a.download = nome;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/**
 * Liga os botões e monta o relatório.
 * @param {object} cfg
 *   pagina: chave para guardar os dados do relatório no navegador
 *   contexto: () => ({ titulo, projeto, modo, identificacao: [[rótulo, valor]], secoes: [{titulo, conteudo: Element|string|null}],
 *                      memoria: string[], tabelaResultados: Element, tabelaCaderneta: Element|null })
 */
export function iniciarRelatorio({ pagina, contexto }) {
  const chave = `nivelamento-ifsc.relatorio.${pagina}`;
  try { definirDadosRelatorio(JSON.parse(localStorage.getItem(chave) || '{}')); } catch { /* */ }
  $('dados-relatorio')?.addEventListener('input', () => {
    try { localStorage.setItem(chave, JSON.stringify(obterDadosRelatorio())); } catch { /* */ }
  });

  let alvo = $('relatorio');
  if (!alvo) {
    alvo = document.createElement('div');
    alvo.id = 'relatorio';
    alvo.className = 'relatorio';
    document.body.append(alvo);
  }
  let estilo = $('estilo-relatorio');
  if (!estilo) {
    estilo = document.createElement('style');
    estilo.id = 'estilo-relatorio';
    document.head.append(estilo);
  }

  function identificacao(ctx) {
    const dados = obterDadosRelatorio();
    const ident = [
      ['Projeto', ctx.projeto],
      ...Object.entries(CAMPOS_RELATORIO).map(([k, [, rot]]) => [rot, k === 'data' ? dataBr(dados[k]) : dados[k]]),
      ['Norma', NORMA],
      ...(ctx.identificacao || []),
    ].filter(([, v]) => String(v ?? '').trim() !== '');
    // Itens do cartão "Parâmetros do cálculo" que ainda não estão na identificação
    // (distribuição do erro, propagação, curvatura e refração…)
    const jaTem = new Set(ident.map(([r]) => r));
    const ignorar = new Set(['Norma', 'Método', 'Nível', 'Trabalhando com', 'Estação total']);
    for (const d of (ctx.parametros ? $(ctx.parametros)?.querySelectorAll('.lista-def > div') ?? [] : [])) {
      const dt = d.querySelector('dt')?.textContent.trim();
      const dd = d.querySelector('dd')?.cloneNode(true);
      if (!dt || !dd || jaTem.has(dt) || ignorar.has(dt)) continue;
      dd.querySelectorAll('br').forEach((br) => br.replaceWith(' — '));
      ident.push([dt, dd.textContent.trim()]);
    }
    return ident;
  }

  function montar() {
    const ctx = contexto();
    const emitido = agoraTexto();
    const ident = identificacao(ctx);

    const secoes = [{ titulo: 'Identificação', conteudo: `<dl class="rel-ident">${ident.map(([r, v]) => `<div><dt>${esc(r)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` },
      ...ctx.secoes,
      { titulo: 'Memória de cálculo', conteudo: `<ol class="rel-memoria">${(ctx.memoria || []).map((m) => `<li>${m}</li>`).join('')}</ol>` }]
      .filter((s) => s.conteudo && (typeof s.conteudo === 'string' ? s.conteudo.trim() : s.conteudo.textContent.trim() || s.conteudo.querySelector('svg')));

    alvo.innerHTML = `
      <div class="barra-previa nao-imprimir">
        <strong>Prévia do relatório (A4)</strong>
        <button type="button" class="botao botao-primario" data-acao="imprimir">Imprimir / salvar PDF</button>
        <button type="button" class="botao botao-secundario" data-acao="fechar">Fechar prévia</button>
      </div>
      <article class="folha">
        <header class="rel-cab">
          <img src="assets/img/logo_agrimensura_fundo_claro_web.png" alt="Agrimensura — IFSC" width="200" height="49">
          <div><h1>${esc(ctx.titulo)}</h1><p>${PROGRAMA} · ${NORMA} · emitido em ${esc(emitido)}</p></div>
        </header>
        ${secoes.map((s, k) => `<section class="rel-secao"><h2>${k + 1}. ${esc(s.titulo)}</h2><div class="rel-conteudo" data-k="${k}"></div></section>`).join('')}
        <footer class="rel-rodape-tela">${PROGRAMA} — ${NORMA} — emitido em ${esc(emitido)}</footer>
      </article>`;
    secoes.forEach((s, k) => {
      const caixa = alvo.querySelector(`.rel-conteudo[data-k="${k}"]`);
      if (typeof s.conteudo === 'string') caixa.innerHTML = s.conteudo; else caixa.append(s.conteudo);
    });
    alvo.querySelector('[data-acao="imprimir"]').onclick = () => window.print();
    alvo.querySelector('[data-acao="fechar"]').onclick = () => document.body.classList.remove('previa');

    const rod = `${PROGRAMA} — ${NORMA} — emitido em ${emitido}`.replace(/"/g, '\\"');
    estilo.textContent = `@page { size: A4; margin: 15mm 14mm 18mm;
      @bottom-left { content: "${rod}"; font: 8pt Arial, sans-serif; color: #000; }
      @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 8pt Arial, sans-serif; color: #000; } }`;
  }

  function csv(tipo) {
    const ctx = contexto();
    const tabela = tipo === 'caderneta' ? ctx.tabelaCaderneta : ctx.tabelaResultados;
    const linhas = linhasDaTabela(tipo === 'caderneta' ? tabelaEnxuta(tabela, { tirarColunas: ['Situação'] }) : tabela);
    if (linhas.length < 2) { alert('Não há dados para exportar.'); return; }
    const texto = gerarCsv(linhas, { cabecalhoArquivo: [`${PROGRAMA} — ${ctx.titulo}`, `Projeto: ${ctx.projeto || '—'}`, NORMA, ...(ctx.identificacao || []).map(([r, v]) => `${r}: ${v}`), `Emitido em ${agoraTexto()}`] });
    baixar(texto, nomeArquivo(ctx.projeto, ctx.modo).replace(/\.niv$/, `_${tipo}.csv`), 'text/csv;charset=utf-8');
  }

  // ---------- Planilha .xlsx ----------
  function xlsx() {
    const ctx = contexto();
    const ident = identificacao(ctx);
    const abas = [{ nome: 'Identificação', linhas: [[`${PROGRAMA} — ${ctx.titulo}`, ''], ...ident, ['Emitido em', agoraTexto()]], cabecalho: 0, larguras: [28, 90] }];
    if (ctx.tabelaCaderneta) abas.push({ nome: 'Caderneta', linhas: linhasDaTabela(tabelaEnxuta(ctx.tabelaCaderneta, { tirarColunas: ['Situação'] })) });
    if (ctx.tabelaResultados) abas.push({ nome: 'Resultados', linhas: linhasDaTabela(ctx.tabelaResultados) });
    for (const ex of ctx.planilhasExtras || []) if (ex.tabela) abas.push({ nome: ex.nome, linhas: linhasDaTabela(ex.tabela) });
    if (abas.length === 1 || abas.slice(1).every((a) => a.linhas.length < 2)) { alert('Não há dados para exportar.'); return; }
    baixar(gerarXlsx(abas), nomeArquivo(ctx.projeto, ctx.modo).replace(/\.niv$/, '.xlsx'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }

  // ---------- Relatório .docx (editável) ----------
  async function docx() {
    const ctx = contexto();
    montar();
    const folha = alvo.querySelector('.folha');
    const blocos = [];
    try {
      const r = await fetch(new URL('../../assets/img/logo_agrimensura_fundo_claro_web.png', import.meta.url));
      const bytes = new Uint8Array(await r.arrayBuffer());
      const dv = new DataView(bytes.buffer);
      blocos.push({ tipo: 'imagem', bytes, largura: dv.getUint32(16), altura: dv.getUint32(20), larguraCm: 5, alinhar: 'esquerda' });
    } catch { /* sem logo */ }
    blocos.push({ tipo: 'titulo', nivel: 1, texto: folha.querySelector('.rel-cab h1').textContent });
    blocos.push({ tipo: 'paragrafo', texto: folha.querySelector('.rel-cab p').textContent, tamanho: 8 });
    for (const sec of folha.querySelectorAll('.rel-secao')) {
      blocos.push({ tipo: 'titulo', nivel: 2, texto: sec.querySelector('h2').textContent });
      await blocosDe(sec.querySelector('.rel-conteudo'), blocos);
    }
    const rodape = `${PROGRAMA} — ${NORMA} — emitido em ${agoraTexto()}`;
    baixar(gerarDocx(blocos, { rodape, titulo: ctx.titulo, autor: obterDadosRelatorio().operador }),
      nomeArquivo(ctx.projeto, ctx.modo).replace(/\.niv$/, '_relatorio.docx'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  }

  // Menu "Exportar": fecha ao escolher uma opção ou ao clicar fora
  document.querySelectorAll('.menu-exportar').forEach((menu) => {
    menu.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { menu.open = false; }));
    document.addEventListener('click', (ev) => { if (menu.open && !menu.contains(ev.target)) menu.open = false; });
  });

  window.addEventListener('beforeprint', montar);
  $('bt-xlsx')?.addEventListener('click', xlsx);
  $('bt-docx')?.addEventListener('click', () => docx().catch((e) => alert(`Não foi possível gerar o relatório .docx: ${e.message}`)));
  $('bt-relatorio')?.addEventListener('click', () => { montar(); window.print(); });
  $('bt-previa')?.addEventListener('click', () => { montar(); document.body.classList.add('previa'); window.scrollTo(0, 0); });
  $('bt-csv-resultados')?.addEventListener('click', () => csv('resultados'));
  $('bt-csv-caderneta')?.addEventListener('click', () => csv('caderneta'));
  return { montar };
}

/** Cartões de resultado (pelo id do conteúdo) lado a lado no relatório; ignora os ocultos e vazios. */
export function cartoes(...ids) {
  const div = document.createElement('div');
  div.className = 'grade-rel';
  for (const id of ids) {
    const el = $(id);
    if (!el || el.closest('[hidden]') || !el.textContent.trim()) continue;
    div.append(clonarEstatico(el.closest('.cartao-resumo') || el));
  }
  return div.children.length ? div : null;
}

/** Cópia de um bloco (tabela, perfil, mensagens) se estiver visível e com conteúdo. */
export function bloco(id) {
  const el = $(id);
  if (!el || el.closest('[hidden]') || (!el.textContent.trim() && !el.querySelector('svg'))) return null;
  return clonarEstatico(el);
}

// ---------- Conversão do relatório (HTML) em blocos do .docx ----------
function partesDe(no, fmt = {}, saida = []) {
  for (const n of no.childNodes) {
    if (n.nodeType === 3) {
      const t = n.textContent.replace(/\s+/g, ' ');
      if (t.trim() || (t === ' ' && saida.length)) saida.push({ texto: t, ...fmt });
    } else if (n.nodeType === 1) {
      const tag = n.tagName;
      if (tag === 'BR') { saida.push({ quebra: true }); continue; }
      if (tag === 'SMALL' && saida.length) saida.push({ quebra: true }); // <small> do resultado aparece em linha própria
      const f = { ...fmt };
      if (tag === 'STRONG' || tag === 'B') f.negrito = true;
      if (tag === 'EM' || tag === 'I' || n.classList.contains('calculado')) f.italico = true;
      if (tag === 'SUB') f.sub = true;
      if (tag === 'SUP') f.sup = true;
      partesDe(n, f, saida);
    }
  }
  return saida;
}

async function blocosDe(el, blocos) {
  for (const e of el.children) {
    const tag = e.tagName;
    if (tag === 'TABLE') {
      const thead = e.querySelectorAll('thead tr').length;
      const linhas = [...e.querySelectorAll('tr')].map((tr) => [...tr.children].map((c) => partesDe(c)));
      const primeira = e.querySelector('tbody tr');
      const direita = primeira ? [...primeira.children].map((c, k) => (c.classList.contains('n') ? k : -1)).filter((k) => k >= 0) : [];
      const nCol = Math.max(...linhas.map((l) => l.length));
      blocos.push({ tipo: 'tabela', linhas, cabecalho: thead, direita, tamanho: nCol > 9 ? 6.5 : nCol > 6 ? 7.5 : 8.5 });
    } else if (tag === 'svg' || tag === 'SVG') {
      const original = document.querySelector(`svg.${[...e.classList].join('.')}`) || e;
      const png = await svgParaPng(original.isConnected ? original : e, { preto: true });
      blocos.push({ tipo: 'imagem', bytes: png.bytes, largura: png.largura, altura: png.altura, larguraCm: 17 });
    } else if (tag === 'DL') {
      for (const d of e.querySelectorAll(':scope > div')) {
        const dt = d.querySelector('dt'), dd = d.querySelector('dd');
        blocos.push({ tipo: 'paragrafo', partes: [{ texto: `${dt?.textContent.trim()}: `, negrito: true }, ...(dd ? partesDe(dd) : [])], espacoDepois: 20, tamanho: 9 });
      }
    } else if (tag === 'H3') {
      blocos.push({ tipo: 'titulo', nivel: 3, texto: e.textContent.trim() });
    } else if (tag === 'UL' || tag === 'OL') {
      [...e.children].forEach((li, k) => blocos.push({ tipo: 'paragrafo', partes: [{ texto: tag === 'OL' ? `${k + 1}. ` : '• ' }, ...partesDe(li)], espacoDepois: 30, tamanho: 9 }));
    } else if (tag === 'P' || (!e.children.length && e.textContent.trim())) {
      if (e.textContent.trim()) blocos.push({ tipo: 'paragrafo', partes: partesDe(e), negrito: e.classList.contains('status') || e.classList.contains('resultado-final') });
    } else {
      await blocosDe(e, blocos);
    }
  }
}
