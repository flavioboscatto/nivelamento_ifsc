// layout.js — cabeçalho e rodapé comuns a todas as páginas (mesmo padrão do site do curso).
// Uso: <body data-pagina="inicio|geometrico|trigonometrico|sobre"> com <div id="cabecalho"></div> e <div id="rodape"></div>.

const SITE_CURSO = 'https://agrimensura.florianopolis.ifsc.edu.br/';
const REPOSITORIO = 'https://github.com/flavioboscatto/nivelamento_ifsc';

const MENU = [
  { id: 'inicio', rotulo: 'Início', href: 'index.html' },
  { id: 'geometrico', rotulo: 'Geométrico', href: 'geometrico.html' },
  { id: 'trigonometrico', rotulo: 'Trigonométrico', href: 'trigonometrico.html' },
  { id: 'sobre', rotulo: 'Sobre a norma', href: 'sobre.html' },
];

function cabecalho(paginaAtual) {
  const itens = MENU.map((m) =>
    `<li><a href="${m.href}"${m.id === paginaAtual ? ' aria-current="page"' : ''}>${m.rotulo}</a></li>`).join('');
  return `
  <a class="pular-conteudo" href="#conteudo">Pular para o conteúdo</a>
  <header class="cabecalho">
    <div class="container">
      <a class="marca" href="index.html" aria-label="Calculadora de Nivelamento — Curso de Agrimensura IFSC, página inicial">
        <img src="assets/img/logo_agrimensura_fundo_escuro_web.png" alt="Agrimensura — Instituto Federal de Santa Catarina" width="270" height="66">
      </a>
      <button class="botao-menu" type="button" aria-expanded="false" aria-controls="menu-principal">Menu</button>
      <nav aria-label="Principal">
        <ul class="menu" id="menu-principal">
          ${itens}
          <li><a class="externo" href="${SITE_CURSO}" target="_blank" rel="noopener">Site do curso</a></li>
        </ul>
      </nav>
    </div>
  </header>`;
}

function rodape() {
  const ano = new Date().getFullYear();
  return `
  <footer class="rodape">
    <div class="container">
      <div class="rodape-grade">
        <div class="instituicao">
          <strong>Instituto Federal de Santa Catarina</strong>
          Câmpus Florianópolis — Curso Técnico em Agrimensura
          <p style="margin-top:14px">Nivelamento conforme a ABNT NBR 13133:2021. Cálculo no navegador; nenhum dado é enviado.</p>
        </div>
        <div>
          <h2>Links</h2>
          <ul>
            <li><a href="${SITE_CURSO}" target="_blank" rel="noopener">Site do curso</a></li>
            <li><a href="apoio.html">Estatística de séries</a></li>
            <li><a href="sobre.html">Sobre a norma e as fórmulas</a></li>
            <li><a href="${REPOSITORIO}">Código-fonte no GitHub</a></li>
          </ul>
        </div>
      </div>
      <div class="linha-final">
        <span>© ${ano} IFSC Câmpus Florianópolis — Curso Técnico em Agrimensura</span>
        <span>Versão 0.1 — em desenvolvimento</span>
      </div>
    </div>
  </footer>`;
}

export function montarLayout() {
  const pagina = document.body.dataset.pagina || '';
  const alvoCab = document.getElementById('cabecalho');
  const alvoRod = document.getElementById('rodape');
  if (alvoCab) alvoCab.outerHTML = cabecalho(pagina);
  if (alvoRod) alvoRod.outerHTML = rodape();

  // Menu "hambúrguer" no celular
  const botao = document.querySelector('.botao-menu');
  const menu = document.getElementById('menu-principal');
  botao?.addEventListener('click', () => {
    const aberto = menu.classList.toggle('aberto');
    botao.setAttribute('aria-expanded', String(aberto));
  });
}

montarLayout();

// Funcionamento sem internet (uso em campo): guarda o site no navegador na primeira visita.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* sem suporte: segue online */ }); });
}

// Aviso discreto quando está sem internet
function avisoConexao() {
  let aviso = document.getElementById('aviso-offline');
  if (navigator.onLine) { aviso?.remove(); return; }
  if (!aviso) {
    aviso = document.createElement('div');
    aviso.id = 'aviso-offline';
    aviso.className = 'aviso-offline nao-imprimir';
    aviso.setAttribute('role', 'status');
    aviso.textContent = 'Sem internet — usando a cópia guardada no navegador.';
    document.body.prepend(aviso);
  }
}
window.addEventListener('online', avisoConexao);
window.addEventListener('offline', avisoConexao);
avisoConexao();
