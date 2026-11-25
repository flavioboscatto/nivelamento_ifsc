// O service worker deve guardar todos os arquivos que o site usa (senão falha sem internet).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const raiz = new URL('..', import.meta.url).pathname;
const sw = readFileSync(join(raiz, 'sw.js'), 'utf8');
const lista = [...sw.matchAll(/'([^']+\.(?:html|css|js|json|png|svg|webmanifest))'/g)].map((m) => m[1]);

function arquivos(dir, ext) {
  return readdirSync(join(raiz, dir)).flatMap((n) => {
    const rel = `${dir}/${n}`;
    return statSync(join(raiz, rel)).isDirectory() ? arquivos(rel, ext) : (ext.test(n) ? [rel] : []);
  });
}

test('service worker guarda todos os módulos, dados, estilos e páginas', () => {
  const esperados = [
    ...arquivos('src', /\.js$/), ...arquivos('data', /\.json$/), ...arquivos('assets/css', /\.css$/),
    ...readdirSync(raiz).filter((n) => n.endsWith('.html')), 'manifest.webmanifest',
  ];
  const faltando = esperados.filter((f) => !lista.includes(f));
  assert.deepEqual(faltando, [], `Acrescente em sw.js: ${faltando.join(', ')}`);
  for (const f of lista) assert.ok(statSync(join(raiz, f)), `arquivo da lista não existe: ${f}`);
});

test('manifesto com ícones 192 e 512', () => {
  const m = JSON.parse(readFileSync(join(raiz, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.lang, 'pt-BR');
  assert.ok(m.icons.some((i) => i.sizes === '192x192'));
  assert.ok(m.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'));
  for (const i of m.icons) assert.ok(statSync(join(raiz, i.src)));
});

// Simulação do service worker no Node: instala, guarda os arquivos e responde sem internet.
import vm from 'node:vm';

function ambienteSW({ online }) {
  const armazem = new Map(); // nome do cache → Map(url → Response)
  const ouvintes = {};
  const origem = 'https://nivelamentoifsc.netlify.app';
  const abs = (u) => new URL(typeof u === 'string' ? u : u.url, `${origem}/sw.js`).href;
  const caches = {
    async open(nome) {
      if (!armazem.has(nome)) armazem.set(nome, new Map());
      const m = armazem.get(nome);
      return {
        async addAll(lista) { for (const u of lista) m.set(abs(u), new Response(`conteúdo de ${u}`)); },
        async put(req, resp) { m.set(abs(req), resp); },
        async match(req) { return m.get(abs(req))?.clone(); },
        async keys() { return [...m.keys()]; },
      };
    },
    async keys() { return [...armazem.keys()]; },
    async delete(n) { return armazem.delete(n); },
    async match(req, op = {}) {
      for (const m of armazem.values()) {
        const u = abs(req);
        const r = m.get(op.ignoreSearch ? u.split('?')[0] : u);
        if (r) return r.clone();
      }
      return undefined;
    },
  };
  const self = {
    location: new URL(`${origem}/sw.js`),
    addEventListener: (t, f) => { ouvintes[t] = f; },
    skipWaiting: async () => {}, clients: { claim: async () => {} },
  };
  const fetchFalso = async (req) => {
    if (!online) throw new TypeError('sem rede');
    return new Response(`rede: ${abs(req)}`, { status: 200 });
  };
  vm.runInNewContext(readFileSync(join(raiz, 'sw.js'), 'utf8'), { self, caches, fetch: fetchFalso, Response, URL, Promise, console });
  const disparar = async (tipo, extra = {}) => {
    let promessa;
    const ev = { ...extra, waitUntil: (p) => { promessa = p; }, respondWith: (p) => { promessa = p; } };
    ouvintes[tipo](ev);
    return promessa;
  };
  return { disparar, caches, origem };
}

test('service worker: instala e responde sem internet com a cópia guardada', async () => {
  const sw = ambienteSW({ online: false });
  await sw.disparar('install');
  const req = (url, mode = 'no-cors') => ({ url: `${sw.origem}/${url}`, method: 'GET', mode });
  const r1 = await sw.disparar('fetch', { request: req('src/core/geometrico.js') });
  assert.equal(await r1.text(), 'conteúdo de src/core/geometrico.js');
  const r2 = await sw.disparar('fetch', { request: req('geometrico.html?x=1', 'navigate') });
  assert.equal(await r2.text(), 'conteúdo de geometrico.html', 'ignora parâmetros da URL');
  const r3 = await sw.disparar('fetch', { request: req('pagina-inexistente', 'navigate') });
  assert.equal(await r3.text(), 'conteúdo de index.html', 'navegação desconhecida cai na página inicial');
});

test('service worker: com internet usa a rede e atualiza a cópia', async () => {
  const sw = ambienteSW({ online: true });
  await sw.disparar('install');
  const r = await sw.disparar('fetch', { request: { url: `${sw.origem}/index.html`, method: 'GET', mode: 'navigate' } });
  assert.match(await r.text(), /^rede:/);
});
