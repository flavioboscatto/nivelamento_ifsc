// Testes da Etapa 5 — nivelamento trigonométrico.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  curvaturaRefracao, sigmaDistanciaAnexoC, sigmaF3, calcularTrigonometrico, visadasReciprocas,
} from '../src/core/trigonometrico.js';
import { parseAngulo, formatarDms } from '../src/core/angulos.js';

const ler = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
const casos = ler('./casos_referencia.json');
const norma = ler('../data/norma_nbr13133_2021.json');
const caso = (id) => Object.values(casos).flat().find((c) => c && c.id === id);
const perto = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: obtido ${a}, esperado ${b}`);
const TOL_H = casos.tolerancia_numerica.altura_m;

test('A04 — curvatura e refração com R e k do JSON da norma', () => {
  const a = caso('A04');
  assert.equal(norma.R_m, a.R_m); assert.equal(norma.k, a.k);
  for (const [d, v] of Object.entries(a.esperado_m)) perto(curvaturaRefracao(Number(d), norma.R_m, norma.k), v, 5e-7, `c+r ${d} m`);
});

test('A01 — precisão da distância pelo Anexo C', () => {
  const a = caso('A01');
  perto(sigmaDistanciaAnexoC(a.Z_mm, a.k_ppm, a.D_km * 1000) * 1000, a.esperado.ed_mm, 0.005, 'e_d');
});

test('T01 — NBR F.4: σH(P20) = ±0,0232 m', () => {
  const t = caso('T01');
  const Z = parseAngulo(t.Z);
  const s = sigmaF3({ sigmaHI: t.sigma_HI_m, Z, Di: t.Di, sigmaDi: t.sigma_Di_m, sigmaZ_s: t.sigma_Z_s });
  perto(s ** 2, t.esperado.variancia, 5e-8, 'variância');
  perto(s, t.esperado.sigma_H_m, 5e-5, 'σ');
  // A mesma conta pela caderneta (estação sobre ponto conhecido; σDi = 2 mm, sem ppm — errata E6)
  const r = calcularTrigonometrico([
    { estacao: 'E01', i: '1,500', ponto: 'P20', zpd: t.Z, di: t.Di, s: '1,500' },
  ], { H_ref: 10, sigmaRef_m: t.sigma_HI_m, pontoRef: 'E01', sigmaZ_s: t.sigma_Z_s, distA_mm: 2, distB_ppm: 0 });
  assert.deepEqual(r.erros, []);
  perto(r.pontos[0].sigma, s, 1e-12, 'σ pela caderneta');
});

test('T03 — NBR Anexo I: três estações sobre o mesmo ponto (R = 6 360 000 m)', () => {
  const t = caso('T03');
  const Hs = t.visadas.map((v, n) => {
    const r = calcularTrigonometrico([
      { estacao: `E${n}`, i: v.i, ponto: 'P', zpd: v.Z, dh: v.D, s: v.s },
    ], { H_ref: v.H_partida, pontoRef: `E${n}`, R: 6360000, k: 0.13 });
    assert.deepEqual(r.erros, []);
    assert.equal(r.linhas[0].crAplicada, true, 'c+r aplicada acima de 125 m');
    // O Anexo I arredonda c+r ao milímetro (0,015 m na 3ª visada; exato 0,0154 m — doc 7, errata E11).
    // O programa usa c+r sem arredondamento; por isso a 3ª estação difere 0,8 mm da tabela da norma.
    perto(r.pontos[0].H, v.esperado_H, n === 2 ? 0.001 : TOL_H, `H pela estação ${n + 1}`);
    return r.pontos[0].H;
  });
  perto(Hs.reduce((a, b) => a + b) / 3, t.esperado.media, TOL_H, 'média');
});

test('PD/PI: Z médio e erro de índice', () => {
  const r = calcularTrigonometrico([
    { estacao: 'E', i: 1.5, ponto: 'A', zpd: '91°19\'50"', zpi: '268°40\'30"', di: 20 },
  ], { H_ref: 10, pontoRef: 'E' });
  assert.equal(formatarDms(r.linhas[0].Z), '91°19\'40"');
  assert.equal(formatarDms(r.linhas[0].erroIndice), '0°00\'10"');
});

/** Gera Z e DH exatos para um desnível conhecido (com c+r da Terra). */
function visadaExata(dnAparente, DH) { return formatarDms(Math.atan2(DH, dnAparente), 3); }

test('visadas recíprocas: c+r se cancela e Δh volta ao valor verdadeiro', () => {
  const HA = 100, HB = 112.345, DH = 450, iA = 1.55, sB = 1.8, iB = 1.62, sA = 1.7;
  const cr = curvaturaRefracao(DH, 6371000, 0.13);
  // DV aparente: (alvo − eixo) − c+r
  const ida = { Z: parseAngulo(visadaExata((HB + sB) - (HA + iA) - cr, DH)), DH, i: iA, s: sB };
  const volta = { Z: parseAngulo(visadaExata((HA + sA) - (HB + iB) - cr, DH)), DH, i: iB, s: sA };
  const r = visadasReciprocas(ida, volta);
  perto(r.dh, HB - HA, 1e-4, 'Δh médio');
  perto(r.controle, -2 * cr, 1e-4, 'controle = −2·c+r (efeito da Terra)');
  perto(Math.abs(r.controle), r.crEsperada2, 1e-4, 'controle × 2 c+r esperado');
  assert.ok(r.sigma > 0);
});

test('poligonal fechada com estações livres (ré e vante): erro, K, tolerância e distribuição', () => {
  // Pontos: RN (100) → P1 (102,000) → RN. Estações livres no meio, visadas de 100 m (c+r cancela).
  const DH = 100;
  const z = (dz) => visadaExata(dz, DH);
  const linhas = [
    { estacao: 'E1', ponto: 'RN', status: 're', zpd: z(-1), dh: DH, s: 0 },          // eixo = 101
    { ponto: 'P1', status: 'vante', zpd: z(1.003), dh: DH, s: 0 },                   // P1 = 102,003 (erro +3 mm)
    { estacao: 'E2', ponto: 'P1', status: 're', zpd: z(0.5), dh: DH, s: 0 },          // eixo = P1 − 0,5
    { ponto: 'RN', status: 'vante', zpd: z(-1.5), dh: DH, s: 0 },                     // RN = P1 − 2
  ];
  const r = calcularTrigonometrico(linhas, {
    H_ref: '100,000', pontoRef: 'RN', metodo: 'poligonal', classes: norma.trigonometrico, classeId: 'IIN-1',
  });
  assert.deepEqual(r.erros, []);
  const f = r.fechamento;
  perto(f.erro_m, 0.003, 1e-6, 'erro');
  perto(f.K_km, 0.4, 1e-9, 'K = Σ DH');
  perto(f.tolerancias[0].T_mm, 120 * Math.sqrt(0.4), 1e-9, 'T IIN-1');
  assert.equal(f.tolerancias[0].atende, true);
  const p1 = f.pontos.find((p) => p.ponto === 'P1');
  perto(p1.Hcorr, 102.0015, 1e-6, 'P1 corrigido (metade do caminho)');
  perto(f.pontos.at(-1).Hcorr, 100, 1e-9, 'fecho corrigido');
  assert.ok(p1.sigma > 0 && p1.sigmaAnexoL >= p1.sigma);
});

test('mensagens do trigonométrico', () => {
  const r = calcularTrigonometrico([
    { estacao: 'E', i: '1,5', ponto: 'A', zpd: '91 19', di: '' },
    { ponto: 'B', zpd: 'abc', di: 10 },
    { ponto: 'C', zpd: '190', di: 10 },
  ], { H_ref: 10, pontoRef: 'E', nomeAltura: 'altitude' });
  assert.match(r.erros[0], /Linha 1 \(estação E, ponto A\): falta a distância/);
  assert.match(r.erros[1], /"abc" não é válido/);
  assert.match(r.erros[2], /entre 0° e 180°/);
  const r2 = calcularTrigonometrico([{ estacao: 'X', ponto: 'A', zpd: '90', di: 10 }], { H_ref: 10, pontoRef: 'E', nomeAltura: 'altitude' });
  assert.match(r2.erros[0], /sem ré e sem altitude conhecida/);
});

test('tabela de curvatura e refração (doc 2, 2.3.2) e efeito residual no geométrico', async () => {
  const { tabelaCurvaturaRefracao, efeitoResidualGeometrico } = await import('../src/core/trigonometrico.js');
  const t = tabelaCurvaturaRefracao([80, 125, 150, 300, 500], norma.R_m, norma.k);
  [0.4, 1.1, 1.5, 6.1, 17.1].forEach((mm, n) => perto(t[n].cr * 1000, mm, 0.05, `c+r ${t[n].DH} m`));
  perto(t[4].c + t[4].r, t[4].cr, 1e-15, 'c + r');
  // AA p. 31: abaixo de 1 mm para DH < 120 m
  assert.ok(Math.abs(efeitoResidualGeometrico(119, 0, norma.R_m, norma.k)) < 0.001);
  perto(efeitoResidualGeometrico(60, 50, norma.R_m, norma.k), curvaturaRefracao(60, norma.R_m, norma.k) - curvaturaRefracao(50, norma.R_m, norma.k), 1e-15, 'residual');
});
