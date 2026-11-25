// Testes do passo a passo (modo aula): as contas mostradas usam os mesmos números do cálculo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcularNivelamento } from '../src/core/fechamento.js';
import { calcularTaqueometria } from '../src/core/taqueometria.js';
import { analisarSerie } from '../src/core/estatistica.js';
import { passosGeometrico, passosTaqueometria, passosSerie } from '../src/core/passos.js';

const casos = JSON.parse(readFileSync(new URL('./casos_referencia.json', import.meta.url), 'utf8'));
const norma = JSON.parse(readFileSync(new URL('../data/norma_nbr13133_2021.json', import.meta.url), 'utf8'));
const caso = (id) => Object.values(casos).flat().find((c) => c && c.id === id);
const texto = (g) => g.flatMap((x) => [x.titulo, ...x.linhas]).join('\n');

test('G01 — passo a passo da irradiação (NBR F.2)', () => {
  const r = calcularNivelamento([
    { estacao: '01', ponto: 'RN80', re: '1,335', dh: '60,325' },
    { ponto: 'A1', vante: '1,511', dh: '55,078' },
  ], { metodo: 'irradiacao', H_ref: '9,315', sigmaRef_m: 0.0034, pontoRef: 'RN80', sigmaL: 2e-5 });
  const t = texto(passosGeometrico(r, { sigmaL: 2e-5 }));
  assert.match(t, /APV = Cota\(RN80\) \+ L ré = 9,315 \+ 1,335 = 10,650 m/);
  assert.match(t, /Cota\(A1\) = APV − L = 10,650 − 1,511 = 9,139 m \(desnível -0,176 m\)/);
  assert.match(t, /σ = .* = 3,8 mm/);
});

test('G06 — passo a passo do fechamento por estação', () => {
  const g = caso('G06');
  const dh = caso('P01').estacoes_dh;
  const linhas = [];
  let p = 'RN2';
  g.estacoes.forEach((e, j) => {
    linhas.push({ estacao: String(j + 1), ponto: p, re: e.re, dh: dh[j][1] });
    linhas.push({ ponto: e.mudanca[0], vante: e.mudanca[1], dh: dh[j][2] });
    p = e.mudanca[0];
  });
  const r = calcularNivelamento(linhas, { metodo: 'circuito', H_ref: 6.5, pontoRef: 'RN2', sigmaL: 2e-5, distribuicao: 'estacao', classes: norma.geometrico, classeId: 'IN-3' });
  const t = texto(passosGeometrico(r));
  assert.match(t, /e = Cota calculada − Cota conhecida = 6,489 − 6,500 = -11,0 mm/);
  assert.match(t, /K = Σ DH = 718,254 m = 0,7183 km/);
  assert.match(t, /T = 12 × √0,7183 = 10,2 mm → \|e\| = 11,0 mm: não atende/);
  assert.match(t, /C = e \/ n = \(-0,0110\) \/ 7 = -0,00157 m/);
});

test('Q01 — passo a passo da taqueometria (ponto 12)', () => {
  const q = caso('Q01');
  const p = q.pontos[0];
  const r = calcularTaqueometria([{ estacao: '100', i: q.estacao.i }, { ponto: p.p, fs: p.FS, fm: p.FM, fi: p.FI, z: p.Z, hz: p.Hz }],
    { H_ref: q.estacao.H, X_ref: q.estacao.X, Y_ref: q.estacao.Y, pontoRef: '100' });
  const t = texto(passosTaqueometria(r));
  assert.match(t, /S = FS − FI = 1,129 − 0,888 = 0,241 m/);
  assert.match(t, /DH = C · S · sen²Z = 100 × 0,241 × sen² 95°37'31" = 23,868 m/);
  assert.match(t, /Cota\(12\) = 40,034 − 1,790 = 38,244 m/);
  assert.match(t, /X = 1000,000 \+ 23,868 × sen Az = 979,803 m/);
});

test('S02 — passo a passo da média e do desvio-padrão', () => {
  const obs = casos.estatistica[0].obs;
  const t = texto(passosSerie(obs, analisarSerie(obs)));
  assert.match(t, /x̄ = Σx \/ n = 115,121 \/ 9 = 12,7912 m/);
  assert.match(t, /= 0,0056 m/);
  assert.match(t, /= 0,0019 m/);
});
