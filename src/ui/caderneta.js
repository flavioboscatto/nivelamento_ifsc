// caderneta.js — tabela editável igual à caderneta de papel.
// Teclado: Enter/Tab avançam, Shift+Enter volta, ↑/↓ mudam de linha na mesma coluna.
// Colar um bloco copiado do Excel/LibreOffice (colunas separadas por tabulação) preenche
// a partir da célula atual, criando linhas se preciso (colunas de lista são puladas).
// Coluna de status (lista): mostra em qual coluna de leitura está o valor; trocar o status
// move a leitura para a coluna escolhida (dados importados do nível vêm sem código).

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * @param {object} cfg
 *   alvo: elemento onde a tabela é montada
 *   colunas: editáveis — [{ id, rotulo, titulo?, numero?, classe? }]
 *            ou lista de status — [{ id, rotulo, opcoes: [[valor, rótulo]], moverEntre: ['re', …] }]
 *   calculadas: [{ id, rotulo, titulo? }] (somente leitura)
 *   aoMudar: () => void
 *   linhasIniciais: número de linhas vazias
 */
export function criarCaderneta({ alvo, colunas, calculadas, aoMudar, linhasIniciais = 6 }) {
  let linhas = Array.from({ length: linhasIniciais }, () => ({}));
  const editaveis = colunas.filter((c) => !c.opcoes);   // recebem texto colado
  const lista = colunas.find((c) => c.opcoes);

  const cab = `
    <thead><tr>
      <th scope="col" class="num-linha">Nº</th>
      ${colunas.map((c) => `<th scope="col" data-cab="${c.id}"${c.titulo ? ` title="${esc(c.titulo)}"` : ''}>${c.rotulo}</th>`).join('')}
      ${calculadas.map((c) => `<th scope="col" class="calc" data-cab="${c.id}"${c.titulo ? ` title="${esc(c.titulo)}"` : ''}>${c.rotulo}</th>`).join('')}
      <th scope="col" class="acao nao-imprimir"><span class="sr">Excluir</span></th>
    </tr></thead>`;
  alvo.innerHTML = `<table class="caderneta">${cab}<tbody></tbody></table>`;
  const tbody = alvo.querySelector('tbody');

  /** Status derivado: primeira coluna de leitura preenchida (ou o escolhido sem leitura). */
  const statusDe = (l) => {
    if (!lista) return '';
    if (!lista.moverEntre) return l[lista.id] ?? '';
    return lista.moverEntre.find((k) => String(l[k] ?? '').trim() !== '') ?? l._status ?? '';
  };

  function celula(c, l, i) {
    if (c.opcoes) {
      const v = statusDe(l);
      return `<td class="t lista"><select data-col="${c.id}" aria-label="${esc(c.rotulo)} — linha ${i + 1}">
        ${c.opcoes.map(([valor, rot]) => `<option value="${valor}"${valor === v ? ' selected' : ''}>${esc(rot)}</option>`).join('')}
      </select></td>`;
    }
    return `<td class="${c.numero ? 'n' : 't'} ${c.classe || ''}"><input
      data-col="${c.id}" value="${esc(l[c.id])}" ${c.numero ? 'inputmode="decimal"' : ''}
      autocomplete="off" spellcheck="false" aria-label="${esc(c.rotulo)} — linha ${i + 1}"></td>`;
  }

  function desenhar() {
    tbody.innerHTML = linhas.map((l, i) => `
      <tr data-i="${i}">
        <th scope="row" class="num-linha">${i + 1}</th>
        ${colunas.map((c) => celula(c, l, i)).join('')}
        ${calculadas.map((c) => `<td class="calc n" data-calc="${c.id}"></td>`).join('')}
        <td class="acao nao-imprimir"><button type="button" class="excluir" data-excluir="${i}" title="Excluir a linha ${i + 1}" aria-label="Excluir a linha ${i + 1}">×</button></td>
      </tr>`).join('');
  }

  function focar(i, col) {
    const el = tbody.querySelector(`tr[data-i="${i}"] [data-col="${col}"]`);
    if (el) { el.focus(); el.select?.(); }
  }

  function excluir(i) {
    if (linhas.length <= 1) linhas = [{}]; else linhas.splice(i, 1);
    desenhar();
    aoMudar();
    focar(Math.min(i, linhas.length - 1), colunas[0].id);
  }

  tbody.addEventListener('input', (ev) => {
    const inp = ev.target.closest('input');
    if (!inp) return;
    const tr = inp.closest('tr');
    const i = Number(tr.dataset.i);
    linhas[i][inp.dataset.col] = inp.value;
    if (lista?.moverEntre?.includes(inp.dataset.col)) {
      const sel = tr.querySelector(`select[data-col="${lista.id}"]`);
      if (sel) sel.value = statusDe(linhas[i]);
    }
    aoMudar();
  });

  tbody.addEventListener('change', (ev) => {
    const sel = ev.target.closest('select');
    if (!sel) return;
    const i = Number(sel.closest('tr').dataset.i);
    const l = linhas[i];
    if (!lista.moverEntre) { l[lista.id] = sel.value; aoMudar(); return; }
    const atual = statusDe(l);
    const novo = sel.value;
    const valor = atual ? l[atual] : '';
    for (const k of lista.moverEntre) l[k] = '';
    if (novo) { l[novo] = valor ?? ''; l._status = novo; } else delete l._status;
    // Redesenha só as células de leitura da linha
    for (const k of lista.moverEntre) {
      const inp = sel.closest('tr').querySelector(`input[data-col="${k}"]`);
      if (inp) inp.value = l[k] ?? '';
    }
    aoMudar();
    if (novo && !valor) focar(i, novo);
  });

  tbody.addEventListener('click', (ev) => {
    const bt = ev.target.closest('[data-excluir]');
    if (bt) excluir(Number(bt.dataset.excluir));
  });

  tbody.addEventListener('keydown', (ev) => {
    const el = ev.target.closest('input, select');
    if (!el) return;
    const i = Number(el.closest('tr').dataset.i);
    const ci = colunas.findIndex((c) => c.id === el.dataset.col);
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
      if (j >= 0 && j < linhas.length) { ev.preventDefault(); focar(j, el.dataset.col); }
    }
  });

  tbody.addEventListener('paste', (ev) => {
    const inp = ev.target.closest('input');
    const texto = ev.clipboardData?.getData('text/plain') ?? '';
    if (!inp || !/[\t\n]/.test(texto.trim())) return; // valor simples: colagem normal
    ev.preventDefault();
    const i0 = Number(inp.closest('tr').dataset.i);
    const c0 = editaveis.findIndex((c) => c.id === inp.dataset.col);
    const blocos = texto.replace(/\r/g, '').replace(/\n+$/, '').split('\n').map((r) => r.split('\t'));
    blocos.forEach((cels, k) => {
      const i = i0 + k;
      while (linhas.length <= i) linhas.push({});
      cels.forEach((v, d) => {
        const col = editaveis[c0 + d];
        if (col) linhas[i][col.id] = v.trim();
      });
    });
    desenhar();
    aoMudar();
    focar(i0, editaveis[c0].id);
  });

  desenhar();

  return {
    obterLinhas: () => linhas.map((l) => {
      const { _status, ...resto } = l;
      return { ...resto };
    }),
    definirLinhas(novas) {
      linhas = novas.length ? novas.map((l) => ({ ...l })) : [{}];
      while (linhas.length < linhasIniciais) linhas.push({});
      desenhar();
      aoMudar();
    },
    adicionarLinha() { linhas.push({}); desenhar(); aoMudar(); focar(linhas.length - 1, colunas[0].id); },
    excluirLinha: excluir,
    /** Troca o texto do cabeçalho de uma coluna (ex.: "Cota (m)" ↔ "Altitude (m)"). */
    renomearColuna(id, rotulo) {
      const th = alvo.querySelector(`th[data-cab="${id}"]`);
      if (th) th.textContent = rotulo;
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
      for (const c of editaveis) {
        const inp = tr.querySelector(`input[data-col="${c.id}"]`);
        inp.placeholder = placeholders[c.id] ?? '';
      }
    },
  };
}
