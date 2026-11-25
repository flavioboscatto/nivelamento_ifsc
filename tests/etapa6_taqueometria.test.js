// Testes da Etapa 6 — estadimetria e taqueometria.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { estadimetria, calcularTaqueometria, sigmasTaqueometria } from '../src/core/taqueometria.js';
import { parseAngulo, RAD_POR_SEGUNDO } from '../src/core/angulos.js';

const casos = JSON.parse(readFileSync(new URL('./casos_referencia.json', import.meta.url), 'utf8'));
const caso = (id) => Object.values(casos).flat().find((c) => c && c.id === id);
const perto = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: obtido ${a}, esperado ${b}`);
const TOL = casos.tolerancia_numerica.altura_m;

test('E01 — AA Exemplo II: DH = 100 × 0,094 × sen²(91°19\'40") = 9,395 m', () => {
  const e = caso('E01');
  const r = estadimetria({ FS: e.FS, FI: e.FI, Z: parseAngulo(e.Z), C: e.C });
  perto(r.DH, e.esperado.DH, TOL, 'DH');
  perto(r.S, 0.094, 1e-12, 'número gerador');
});

test('DV = ½·C·S·sen 2Z coincide com DH·cot Z', () => {
  const Z = parseAngulo('85 30 00');
  const r = estadimetria({ FS: 1.5, FI: 1.2, Z });
  perto(r.DV, r.DH / Math.tan(Z), 1e-12, 'DV');
});

test('Q01 — AA Exercício V (a conferir pelo professor): DH, H, X, Y dos pontos 12 a 15', () => {
  const q = caso('Q01');
  const linhas = [
    { estacao: '100', i: q.estacao.i },
    ...q.pontos.map((p) => ({ ponto: p.p, fs: p.FS, fm: p.FM, fi: p.FI, z: p.Z, hz: p.Hz })),
  ];
  const r = calcularTaqueometria(linhas, {
    H_ref: q.estacao.H, X_ref: q.estacao.X, Y_ref: q.estacao.Y, pontoRef: '100', azRef: q.estacao.Az_ref,
  });
  assert.deepEqual(r.erros, []);
  for (const p of q.pontos) {
    const pt = r.pontos.find((x) => x.ponto === p.p);
    perto(pt.DH, p.esperado.DH, TOL, `DH ${p.p}`);
    perto(pt.H, p.esperado.H, TOL, `H ${p.p}`);
    perto(pt.X, p.esperado.X, TOL, `X ${p.p}`);
    perto(pt.Y, p.esperado.Y, TOL, `Y ${p.p}`);
  }
});

test('σ da taqueometria (doc 4, 4.5) cresce com S e com σZ', () => {
  const Z = parseAngulo('80');
  const a = sigmasTaqueometria({ S: 0.2, Z, sigmaLeit: 0.001, sigmaZ: 10 * RAD_POR_SEGUNDO, sigmaI: 0.002 });
  const b = sigmasTaqueometria({ S: 0.2, Z, sigmaLeit: 0.001, sigmaZ: 60 * RAD_POR_SEGUNDO, sigmaI: 0.002 });
  assert.ok(b.sigmaDN > a.sigmaDN && b.sigmaDH > a.sigmaDH);
  // Luneta horizontal (Z = 90°): σDH = C·√2·σleit
  const h = sigmasTaqueometria({ S: 0.3, Z: Math.PI / 2, sigmaLeit: 0.001, sigmaZ: 0, sigmaI: 0 });
  perto(h.sigmaDH, 100 * Math.SQRT2 * 0.001, 1e-12, 'σDH horizontal');
});

test('alertas e erros da caderneta taqueométrica', () => {
  const r = calcularTaqueometria([
    { estacao: 'E', i: '1,5' },
    { ponto: 'A', fs: '1,600', fm: '1,450', fi: '1,400', z: '90', hz: '0' },
    { ponto: 'B', fs: '2,500', fm: '1,700', fi: '0,900', z: '90', hz: '0' },
    { ponto: 'C', fs: '1,2', fm: '', fi: '1,0', z: '90' },
  ], { H_ref: 10, pontoRef: 'E', nomeAltura: 'altitude' });
  const txt = [...r.erros, ...r.alertas].join(' | ');
  assert.match(txt, /ponto A\): fio médio 1,450 m difere de \(FS \+ FI\)\/2 em -50,0 mm/);
  assert.match(txt, /ponto B\): visada de 160,0 m maior que 80 m/);
  assert.match(txt, /ponto C\): falta o fio médio/);
  const r2 = calcularTaqueometria([{ estacao: 'X', i: 1.5 }, { ponto: 'A', fs: 1.6, fm: 1.5, fi: 1.4, z: '90' }], { H_ref: 10, pontoRef: 'E', nomeAltura: 'altitude' });
  assert.match(r2.erros[0], /estação X não tem altitude conhecida/);
});

test('irradiação a partir de ponto calculado (nova estação)', () => {
  const r = calcularTaqueometria([
    { estacao: 'E', i: '1,500' },
    { ponto: 'P1', fs: '1,600', fm: '1,500', fi: '1,400', z: '90', hz: '90' },
    { estacao: 'P1', i: '1,400', azref: '0' },
    { ponto: 'P2', fs: '1,550', fm: '1,400', fi: '1,250', z: '90', hz: '0' },
  ], { H_ref: 10, X_ref: 1000, Y_ref: 5000, pontoRef: 'E' });
  assert.deepEqual(r.erros, []);
  const p2 = r.pontos.find((p) => p.ponto === 'P2');
  perto(p2.H, 10, 1e-9, 'H P2');
  perto(p2.X, 1020, 1e-9, 'X P2');
  perto(p2.Y, 5030, 1e-9, 'Y P2');
});

test('ângulos em GG,MMSS (D33): formato dos equipamentos', async () => {
  const { lerAnguloSexagesimal } = await import('../src/core/angulos.js');
  const g = (t) => lerAnguloSexagesimal(t) * 180 / Math.PI;
  perto(g('91,1940'), 91 + 19 / 60 + 40 / 3600, 1e-9, '91,1940');
  perto(g('91.1940'), 91 + 19 / 60 + 40 / 3600, 1e-9, 'ponto decimal');
  perto(g('91,19405'), 91 + 19 / 60 + 40.5 / 3600, 1e-9, 'décimo de segundo');
  perto(g('90'), 90, 1e-12, 'graus inteiros');
  perto(g("91°19'40\""), 91 + 19 / 60 + 40 / 3600, 1e-9, 'com símbolos');
  assert.ok(Number.isNaN(lerAnguloSexagesimal('91,6000')), 'minutos ≥ 60');
  assert.ok(Number.isNaN(lerAnguloSexagesimal('101,4753g')), 'grados não');
  // Q01 digitado em GG,MMSS dá o mesmo resultado
  const q = caso('Q01');
  const p = q.pontos[0];
  const r = calcularTaqueometria([{ estacao: '100', i: q.estacao.i }, { ponto: p.p, fs: p.FS, fm: p.FM, fi: p.FI, z: '95,3731', hz: '237,4755' }],
    { H_ref: q.estacao.H, X_ref: q.estacao.X, Y_ref: q.estacao.Y, pontoRef: '100' });
  perto(r.pontos[0].X, p.esperado.X, TOL, 'X do ponto 12');
});
