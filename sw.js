// sw.js — funcionamento sem internet (uso em campo).
// Estratégia: rede primeiro (sempre a versão mais nova quando há internet) e, sem internet,
// a cópia guardada. Ao publicar mudanças, aumentar VERSAO para renovar a cópia.
const VERSAO = 'nivelamento-ifsc-v2';

const ARQUIVOS = [
  './', 'index.html', 'geometrico.html', 'trigonometrico.html', 'apoio.html', 'sobre.html', '404.html',
  'manifest.webmanifest',
  'assets/css/tokens.css', 'assets/css/base.css', 'assets/css/componentes.css', 'assets/css/impressao.css',
  'assets/img/favicon.svg', 'assets/img/logo_agrimensura_fundo_escuro_web.png', 'assets/img/logo_agrimensura_fundo_claro_web.png',
  'assets/img/icone_192.png', 'assets/img/icone_512.png', 'assets/img/icone_maskable_512.png', 'assets/img/apple-touch-icon.png',
  'src/core/numeros.js', 'src/core/angulos.js', 'src/core/estatistica.js', 'src/core/geometrico.js', 'src/core/tolerancias.js',
  'src/core/ajustamento.js', 'src/core/propagacao.js', 'src/core/fechamento.js', 'src/core/trigonometrico.js',
  'src/core/taqueometria.js', 'src/core/passos.js',
  'src/io/projeto.js', 'src/io/csv.js', 'src/io/zip.js', 'src/io/xlsx.js', 'src/io/docx.js',
  'src/ui/layout.js', 'src/ui/caderneta.js', 'src/ui/perfil_svg.js', 'src/ui/relatorio.js', 'src/ui/figuras.js', 'src/ui/mensagens.js',
  'src/ui/paginas/geometrico.js', 'src/ui/paginas/trigonometrico.js', 'src/ui/paginas/apoio.js',
  'data/norma_nbr13133_2021.json', 'data/instrumentos.json',
  'data/exemplos/nbr_f2.json', 'data/exemplos/aa_ex1_transporte.json', 'data/exemplos/aa_tab9_circuito.json', 'data/exemplos/aa_ex5_taqueometria.json',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(caches.keys()
    .then((nomes) => Promise.all(nomes.filter((n) => n.startsWith('nivelamento-ifsc') && n !== VERSAO).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    ev.respondWith(
      fetch(req)
        .then((resp) => {
          if (resp.ok) { const copia = resp.clone(); caches.open(VERSAO).then((c) => c.put(req, copia)); }
          return resp;
        })
        .catch(async () => (await caches.match(req, { ignoreSearch: true }))
          ?? (req.mode === 'navigate' ? caches.match('index.html') : Response.error())),
    );
    return;
  }

  // Fonte do Google: usa a cópia guardada e atualiza em segundo plano
  if (/(^|\.)(googleapis|gstatic)\.com$/.test(url.hostname)) {
    ev.respondWith(caches.open(VERSAO).then(async (c) => {
      const guardada = await c.match(req);
      const rede = fetch(req).then((resp) => { c.put(req, resp.clone()); return resp; }).catch(() => guardada);
      return guardada ?? rede;
    }));
  }
});
