// figuras.js — exporta gráficos SVG da página (perfil, gráfico da série) como imagem PNG.
// Os estilos vêm do CSS da página; por isso são copiados para dentro do SVG antes de desenhar.

const PROPRIEDADES = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'font-size', 'font-weight', 'font-family', 'text-anchor', 'opacity'];

/** SVG independente (com estilos embutidos e fundo branco) em texto. */
export function svgIndependente(svg, { preto = false } = {}) {
  const copia = svg.cloneNode(true);
  const origem = [svg, ...svg.querySelectorAll('*')];
  const destino = [copia, ...copia.querySelectorAll('*')];
  origem.forEach((el, k) => {
    const cs = getComputedStyle(el);
    const estilo = PROPRIEDADES.map((p) => {
      let v = cs.getPropertyValue(p);
      if (preto && (p === 'fill' || p === 'stroke') && v && v !== 'none' && !/255, 255, 255|#fff/i.test(v)) {
        v = el.classList.contains('grade') ? '#bbbbbb' : '#000000';
      }
      return v ? `${p}:${v}` : '';
    }).filter(Boolean).join(';');
    destino[k].setAttribute('style', estilo);
    destino[k].removeAttribute('class');
  });
  const vb = svg.viewBox.baseVal;
  copia.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copia.setAttribute('width', vb.width);
  copia.setAttribute('height', vb.height);
  const fundo = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  fundo.setAttribute('x', vb.x); fundo.setAttribute('y', vb.y);
  fundo.setAttribute('width', vb.width); fundo.setAttribute('height', vb.height);
  fundo.setAttribute('fill', '#ffffff');
  copia.insertBefore(fundo, copia.firstChild);
  return { texto: new XMLSerializer().serializeToString(copia), largura: vb.width, altura: vb.height };
}

/**
 * Converte um <svg> da página em PNG.
 * @returns {Promise<{blob: Blob, bytes: Uint8Array, largura: number, altura: number}>}
 */
export async function svgParaPng(svg, { escala = 2, preto = false } = {}) {
  const { texto, largura, altura } = svgIndependente(svg, { preto });
  const url = URL.createObjectURL(new Blob([texto], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise((ok, falha) => { img.onload = ok; img.onerror = falha; img.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(largura * escala);
    canvas.height = Math.round(altura * escala);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/png'));
    return { blob, bytes: new Uint8Array(await blob.arrayBuffer()), largura: canvas.width, altura: canvas.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Coloca um botão "Baixar figura (.png)" abaixo de cada caixa de gráfico. */
export function botaoPng(idCaixa, nomeArquivo) {
  const caixa = document.getElementById(idCaixa);
  if (!caixa || caixa.nextElementSibling?.classList.contains('acoes-figura')) return;
  const barra = document.createElement('div');
  barra.className = 'acoes-figura nao-imprimir';
  barra.innerHTML = '<button type="button" class="botao botao-secundario">Baixar figura (.png)</button>';
  caixa.after(barra);
  barra.querySelector('button').addEventListener('click', async () => {
    const svg = caixa.querySelector('svg');
    if (!svg) { alert('Ainda não há figura para baixar.'); return; }
    const { blob } = await svgParaPng(svg);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nomeArquivo();
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}
