// caderneta.js — tabela editável igual à caderneta de papel.
// Teclado: Enter/Tab avançam, Shift+Enter volta, ↑/↓ mudam de linha na mesma coluna.
// Colar um bloco copiado do Excel/LibreOffice (colunas separadas por tabulação) preenche
// a partir da célula atual, criando linhas se preciso.

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * @param {object} cfg
 *   alvo: elemento onde a tabela é montada
 *   colunas: [{ id, rotulo, titulo?, numero?: bool, classe? }]   (editáveis)
 *   calculadas: [{ id, rotulo, titulo? }]                           (somente leitura)
 *   aoMudar: () => void
 *   linhasIniciais: número de linhas vazias
 */
export function criarCaderneta({ alvo, colunas, calculadas, aoMudar, linhasIniciais = 6 }) {
  let linhas = Array.from({ length: linhasIniciais }, () => ({}));
  let ultimaLinha = null; // linha que teve foco por último (para "Remover linha")

  const cab = `
    <thead><tr>
      <th scope="col" class="num-linha">Nº</th>
      ${colunas.map((c) => `<th scope="col"${c.titulo ? ` title="${esc(c.titulo)}"` : ''}>${c.rotulo}</th>`).join('')}
      ${calculadas.map((c) => `<th scope="col" class="calc"${c.titulo ? ` title="${esc(c.titulo)}"` : ''}>${c.rotulo}</th>`).join('')}
    </tr></thead>`;
  alvo.innerHTML = `<table class="caderneta">${cab}<tbody></tbody></table>`;
  const tbody = alvo.querySelector('tbody');

  function desenhar() {
    tbody.innerHTML = linhas.map((l, i) => `
      <tr data-i="${i}">
        <th scope="row" class="num-linha">${i + 1}</th>
        ${colunas.map((c) => `<td class="${c.numero ? 'n' : 't'} ${c.classe || ''}"><input
            data-col="${c.id}" value="${esc(l[c.id])}" ${c.numero ? 'inputmode="decimal"' : ''}
            autocomplete="off" spellcheck="false" aria-label="${esc(c.rotulo)} — linha ${i + 1}"></td>`).join('')}
        ${calculadas.map((c) => `<td class="calc n" data-calc="${c.id}"></td>`).join('')}
      </tr>`).join('');
  }

  function focar(i, col) {
    const inp = tbody.querySelector(`tr[data-i="${i}"] input[data-col="${col}"]`);
    if (inp) { inp.focus(); inp.select(); }
  }

  tbody.addEventListener('focusin', (ev) => {
    const tr = ev.target.closest('tr[data-i]');
    if (tr) ultimaLinha = Number(tr.dataset.i);
  });

  tbody.addEventListener('input', (ev) => {
    const inp = ev.target.closest('input');
    if (!inp) return;
    const i = Number(inp.closest('tr').dataset.i);
    linhas[i][inp.dataset.col] = inp.value;
    aoMudar();
  });

  tbody.addEventListener('keydown', (ev) => {
    const inp = ev.target.closest('input');
    if (!inp) return;
    const i = Number(inp.closest('tr').dataset.i);
    const ci = colunas.findIndex((c) => c.id === inp.dataset.col);
    if (ev.key === 'Enter') {
      ev.preventDefault();
      if (ev.shiftKey) {
        if (ci > 0) focar(i, colunas[ci - 1].id);
        else if (i > 0) focar(i - 1, colunas.at(-1).id);
        return;
      }
      if (ci < colunas.length - 1) focar(i, colunas[ci + 1].id);
      else {
        if (i === linhas.length - 1) { linhas.push({}); desenhar(); aoMudar(); }
        focar(i + 1, colunas[0].id);
      }
    } else if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      const j = i + (ev.key === 'ArrowDown' ? 1 : -1);
      if (j >= 0 && j < linhas.length) { ev.preventDefault(); focar(j, inp.dataset.col); }
    }
  });

  tbody.addEventListener('paste', (ev) => {
    const inp = ev.target.closest('input');
    const texto = ev.clipboardData?.getData('text/plain') ?? '';
    if (!inp || !/[\t\n]/.test(texto.trim())) return; // valor simples: colagem normal
    ev.preventDefault();
    const i0 = Number(inp.closest('tr').dataset.i);
    const c0 = colunas.findIndex((c) => c.id === inp.dataset.col);
    const blocos = texto.replace(/\r/g, '').replace(/\n+$/, '').split('\n').map((r) => r.split('\t'));
    blocos.forEach((cels, k) => {
      const i = i0 + k;
      while (linhas.length <= i) linhas.push({});
      cels.forEach((v, d) => {
        const col = colunas[c0 + d];
        if (col) linhas[i][col.id] = v.trim();
      });
    });
    desenhar();
    aoMudar();
    focar(i0, colunas[c0].id);
  });

  desenhar();

  return {
    obterLinhas: () => linhas.map((l) => ({ ...l })),
    definirLinhas(novas) {
      linhas = novas.length ? novas.map((l) => ({ ...l })) : [{}];
      while (linhas.length < linhasIniciais) linhas.push({});
      desenhar();
      aoMudar();
    },
    adicionarLinha() { linhas.push({}); desenhar(); aoMudar(); focar(linhas.length - 1, colunas[0].id); },
    /** Remove a linha que teve foco por último (ou a última). */
    removerLinha() {
      const i = ultimaLinha !== null && ultimaLinha < linhas.length ? ultimaLinha : linhas.length - 1;
      if (linhas.length <= 1) linhas = [{}]; else linhas.splice(i, 1);
      desenhar();
      aoMudar();
      focar(Math.min(i, linhas.length - 1), colunas[0].id);
    },
    /** Atualiza células calculadas, estado e dicas da linha i. */
    mostrarLinha(i, { valores = {}, estado = '', placeholders = {}, dica = '' } = {}) {
      const tr = tbody.querySelector(`tr[data-i="${i}"]`);
      if (!tr) return;
      for (const c of calculadas) {
        const td = tr.querySelector(`[data-calc="${c.id}"]`);
        td.textContent = valores[c.id] ?? '';
      }
      tr.classList.toggle('com-erro', estado === 'erro');
      tr.classList.toggle('com-alerta', estado === 'alerta');
      tr.title = dica;
      for (const c of colunas) {
        const inp = tr.querySelector(`input[data-col="${c.id}"]`);
        inp.placeholder = placeholders[c.id] ?? '';
      }
    },
  };
}
