// Testes da Etapa 4 — transporte de RN, circuito fechado e linha entre duas RN.
// Executar na raiz do projeto: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { calcularNivelamento } from '../src/core/fechamento.js';
import { toleranciaFechamento_mm } from '../src/core/tolerancias.js';
import { correcaoPorEstacao, correcaoProporcional } from '../src/core/ajustamento.js';
import { sigmaCircuito, sigmaAnexoLCircuito, sigmaLinha } from '../src/core/propagacao.js';

const ler = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
const casos = ler('./casos_referencia.json');
const norma = ler('../data/norma_nbr13133_2021.json');
const caso = (id) => Object.values(casos).flat().find((c) => c && c.id === id);
const perto = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: obtido ${a}, esperado ${b}`);
const TOL_H = casos.tolerancia_numerica.altura_m;
const TOL_MM = casos.tolerancia_numerica.mm;
const base = { classes: norma.geometrico, sigmaL: 2e-5, visadaMax_m: 80, alturaMin_m: 0.3, difReVanteMax_m: 100 };

/** Monta caderneta encadeada a partir de listas de ré, vante e DH (pares ré/vante). */
function cadernetaMudancas(re, vante, dh, { inicio = 'RN1', nomes = null, fimNome = 'RN1' } = {}) {
  const linhas = [];
  let p = inicio;
  re.forEach((r, j) => {
    const prox = j === re.length - 1 ? fimNome : (nomes ? nomes[j] : `M${j + 1}`);
    linhas.push({ estacao: String(j + 1), ponto: p, re: r, dh: dh?.[2 * j] ?? '' });
    linhas.push({ ponto: prox, vante: vante[j], dh: dh?.[2 * j + 1] ?? '' });
    p = prox;
  });
  return linhas;
}

/** Tolerâncias esperadas (doc 7, tabela 2021) para um caso. */
function conferirTolerancias(f, esp, id) {
  ['classe1', 'classe2', 'classe3'].forEach((c, i) => {
    perto(f.tolerancias[i].T_mm, esp.tol2021_mm[c], TOL_MM, `${id} T ${c}`);
    assert.equal(f.tolerancias[i].atende, esp.atende2021[c], `${id} atende ${c}`);
  });
}

test('tolerância T = t·√K (Tabela 5) com os valores do JSON da norma', () => {
  perto(toleranciaFechamento_mm(12, 0.3788), 7.39, TOL_MM, 'G02 12√K');
  perto(toleranciaFechamento_mm(12, 0.6066), 9.35, TOL_MM, 'G03 12√K');
  perto(toleranciaFechamento_mm(8, 0.3788), 4.92, TOL_MM, 'G02 8√K');
  perto(toleranciaFechamento_mm(6, 0.6066), 4.67, TOL_MM, 'G03 6√K');
});

test('G04 — transporte AA Ex. I: ida, volta, erro, K, tolerâncias, RN2 corrigida', () => {
  const g = caso('G04');
  const nomesIda = ['A1', 'A2', 'A3', 'A4'];
  const nomesVolta = ['B1', 'B2', 'B3'];
  const linhas = [
    ...cadernetaMudancas(g.ida.re, g.ida.vante, g.ida.dh, { nomes: nomesIda, fimNome: 'RN2' }),
    ...cadernetaMudancas(g.volta.re, g.volta.vante, g.volta.dh, { inicio: 'RN2', nomes: nomesVolta, fimNome: 'RN1' }),
  ].map((l, i) => ({ ...l, estacao: '' }));
  // estações renumeradas
  let k = 0; linhas.forEach((l) => { if (l.re !== undefined) l.estacao = String(++k); });

  const r = calcularNivelamento(linhas, { ...base, metodo: 'transporte', H_ref: g.H_partida, pontoRef: 'RN1', pontoChegada: 'RN2', classeId: 'IN-2' });
  assert.deepEqual(r.erros, []);
  const f = r.fechamento;
  const t = f.transporte;
  perto(g.H_partida + t.dhIda, g.esperado.H_RN2_ida, TOL_H, 'RN2 ida');
  perto(f.Hfecho, g.esperado.H_RN1_volta, TOL_H, 'RN1 volta');
  perto(f.erro_m * 1000, g.esperado.erro_mm, TOL_MM, 'erro');
  perto(f.K_km, g.esperado.K_km, 1e-9, 'K (só a ida)');
  perto(f.extensaoIda_m, 383.132, 1e-6, 'extensão do nivelamento');
  perto(f.extensaoVolta_m, 368.548, 1e-6, 'extensão do contranivelamento');
  perto(t.H, g.esperado.H_RN2_corrigida, TOL_H, 'RN2 pela média ida/volta');
  const rn2 = f.pontos.find((p) => p.ponto === 'RN2');
  perto(rn2.Hcorr, g.esperado.H_RN2_corrigida, TOL_H, 'RN2 pela distribuição proporcional');
  conferirTolerancias(f, g.esperado, 'G04');
  assert.equal(f.classe.id, 'IN-2');
  assert.equal(f.classe.atende, false);
  const rn1 = f.pontos.at(-1);
  perto(rn1.Hcorr, g.H_partida, 1e-9, 'fecho corrigido = RN1');
});

test('G05 — transporte AA Ex. II: erro +8 mm, T(√0,453132), RN2 corrigida 133,861', () => {
  const g = caso('G05');
  const dhIda = Array(10).fill(g.ida.dh_total_m / 10);
  const dhVolta = Array(10).fill(g.volta.dh_total_m / 10);
  const linhas = [
    ...cadernetaMudancas(g.ida.re, g.ida.vante, dhIda, { fimNome: 'RN2' }),
    ...cadernetaMudancas(g.volta.re, g.volta.vante, dhVolta, { inicio: 'RN2', nomes: ['V1', 'V2', 'V3', 'V4'], fimNome: 'RN1' }),
  ];
  let k = 0; linhas.forEach((l) => { l.estacao = l.re !== undefined ? String(++k) : ''; });
  const r = calcularNivelamento(linhas, { ...base, metodo: 'transporte', H_ref: g.H_partida, pontoRef: 'RN1', pontoChegada: 'RN2' });
  assert.deepEqual(r.erros, []);
  const f = r.fechamento;
  perto(g.H_partida + f.transporte.dhIda, g.esperado.H_RN2_ida, TOL_H, 'RN2 ida');
  perto(f.Hfecho, g.esperado.H_RN1_volta, TOL_H, 'RN1 volta');
  perto(f.erro_m * 1000, g.esperado.erro_mm, TOL_MM, 'erro');
  perto(f.transporte.H, g.esperado.H_RN2_corrigida, TOL_H, 'RN2 corrigida');
  perto(f.extensaoVolta_m, 488.596, 1e-6, 'contranivelamento');
  conferirTolerancias(f, g.esperado, 'G05');
});

/** Circuito G06 completo (AA Tab. 9) com as DH do caso P01. */
function cadernetaG06() {
  const g = caso('G06');
  const dh = caso('P01').estacoes_dh;
  const linhas = [];
  let rePonto = 'RN2';
  g.estacoes.forEach((e, j) => {
    linhas.push({ estacao: String.fromCharCode(97 + j), ponto: rePonto, re: e.re, dh: dh[j][1] });
    for (const [p, leit] of Object.entries(e.intermediarias)) linhas.push({ ponto: p, irradiado: leit, dh: p === '14' ? 12.356 : '' });
    linhas.push({ ponto: e.mudanca[0], vante: e.mudanca[1], dh: dh[j][2] });
    rePonto = e.mudanca[0];
  });
  return { g, linhas };
}

test('G06 — circuito AA Tab. 9/10, distribuição por estação (apostila)', () => {
  const { g, linhas } = cadernetaG06();
  const r = calcularNivelamento(linhas, { ...base, metodo: 'circuito', H_ref: g.H_RN, pontoRef: 'RN2', distribuicao: 'estacao' });
  assert.deepEqual(r.erros, []);
  const f = r.fechamento;
  perto(f.Hfecho, g.esperado.H_fecho, TOL_H, 'fecho');
  perto(f.erro_m * 1000, g.esperado.erro_mm, TOL_MM, 'erro');
  perto(f.K_km * 1000, g.perimetro_m, 1e-6, 'perímetro');
  perto(f.C_m, g.esperado.C_por_estacao_m, 1e-7, 'C = e/7');
  for (const [p, H] of Object.entries(g.esperado.corrigidas)) {
    perto(f.pontos.find((x) => x.ponto === p).Hcorr, H, TOL_H, `ponto ${p}`);
  }
  conferirTolerancias(f, g.esperado, 'G06');
  // Errata E2: com C arredondado a 0,1 mm como a apostila
  const r2 = calcularNivelamento(linhas, { ...base, metodo: 'circuito', H_ref: g.H_RN, pontoRef: 'RN2', distribuicao: 'estacao', arredondarC: true });
  perto(r2.fechamento.C_m, -0.0016, 1e-12, 'C arredondado');
});

test('G06 — distribuição proporcional à distância (NBR 5.5.2.12, padrão)', () => {
  const { g, linhas } = cadernetaG06();
  const r = calcularNivelamento(linhas, { ...base, metodo: 'circuito', H_ref: g.H_RN, pontoRef: 'RN2' });
  const f = r.fechamento;
  const a1 = f.pontos.find((p) => p.ponto === 'A1');
  perto(a1.correcao, 0.011 * (55.689 + 63.436) / 718.254, 1e-12, 'correção A1');
  perto(f.pontos.at(-1).Hcorr, g.H_RN, 1e-9, 'fecho corrigido = RN2');
  const p14 = f.pontos.find((p) => p.ponto === '14');
  assert.ok(Number.isFinite(p14.correcao), 'irradiado com DH recebe correção');
  assert.ok(r.alertas.some((a) => a.includes('ponto 1)') && a.includes('correção proporcional')), 'irradiado sem DH avisa');
});

test('P01 — σ rigoroso (4.3.6 a), Anexo L e σ por km no circuito G06', () => {
  const { g, linhas } = cadernetaG06();
  const p01 = caso('P01');
  const r = calcularNivelamento(linhas, { ...base, metodo: 'circuito', H_ref: g.H_RN, pontoRef: 'RN2', sigmaRef_m: p01.sigma_RN_m, sigmaKm_m: p01.sigma_km_mm / 1000 });
  const f = r.fechamento;
  const esp = p01.esperado_mm;
  for (const [p, s] of Object.entries(esp.rigorosa_leitura)) {
    const pt = f.pontos.filter((x) => x.ponto === p).at(-1);
    perto(pt.sigma * 1000, s, TOL_MM, `σ rigoroso ${p}`);
    perto(pt.sigmaAnexoL * 1000, esp.anexoL_leitura[p], TOL_MM, `σ Anexo L ${p}`);
    perto(pt.sigmaKm * 1000, esp.rigorosa_km[p], TOL_MM, `σ por km ${p}`);
  }
  perto(f.pontos.find((x) => x.ponto === '14').sigma * 1000, esp.intermediario_14, TOL_MM, 'σ irradiado 14');
  perto(f.sigmaEsperado_m * 1000, esp.sigma_fecho_leitura, TOL_MM, 'σ esperado do fechamento');
  perto(f.sigmaEsperadoKm_m * 1000, esp.sigma_fecho_km, TOL_MM, 'σ esperado por km');
});

for (const id of ['G07', 'G08']) {
  test(`${id} — circuito AA: fecho, erro, C por estação e tolerâncias`, () => {
    const g = caso(id);
    const n = g.re_mudancas.length;
    const dh = Array(2 * n).fill(g.perimetro_m / (2 * n));
    const linhas = cadernetaMudancas(g.re_mudancas, g.vante_mudancas, dh);
    const r = calcularNivelamento(linhas, { ...base, metodo: 'circuito', H_ref: g.H_RN, pontoRef: 'RN1', distribuicao: 'estacao' });
    assert.deepEqual(r.erros, []);
    const f = r.fechamento;
    perto(f.Hfecho, g.esperado.H_fecho, TOL_H, 'fecho');
    perto(f.erro_m * 1000, g.esperado.erro_mm, TOL_MM, 'erro');
    perto(f.C_m, g.esperado.C_por_estacao_m, 1e-7, 'C');
    perto(f.K_km * 1000, g.perimetro_m, 1e-6, 'perímetro');
    conferirTolerancias(f, g.esperado, id);
  });
}

test('linha entre duas RN: erro contra a RN B e σ combinando as duas RN', () => {
  const linhas = [
    { estacao: '1', ponto: 'RNA', re: '1,500', dh: 40 }, { ponto: 'M1', vante: '1,000', dh: 40 },
    { estacao: '2', ponto: 'M1', re: '1,400', dh: 40 }, { ponto: 'RNB', vante: '0,890', dh: 40 },
  ];
  const r = calcularNivelamento(linhas, {
    ...base, metodo: 'linha', H_ref: 100, sigmaRef_m: 0.002, pontoRef: 'RNA',
    pontoChegada: 'RNB', H_chegada: '101,005', sigmaChegada_m: 0.003,
  });
  assert.deepEqual(r.erros, []);
  const f = r.fechamento;
  perto(f.Hfecho, 101.010, 1e-9, 'RNB calculada');
  perto(f.erro_m, 0.005, 1e-9, 'erro');
  perto(f.pontos.at(-1).Hcorr, 101.005, 1e-9, 'RNB corrigida');
  perto(f.pontos.find((p) => p.ponto === 'M1').correcao, -0.0025, 1e-12, 'M1 no meio');
  const V = 2 * (2e-5 * 40) ** 2;
  perto(f.pontos.find((p) => p.ponto === 'M1').sigma, sigmaLinha(0.002, 0.003, V, 2 * V), 1e-15, 'σ M1 (4.3.6 b)');
});

test('mensagens de erro do fechamento', () => {
  const semVolta = calcularNivelamento([
    { ponto: 'RN1', re: 1.5, dh: 30 }, { ponto: 'RN2', vante: 1.2, dh: 30 },
  ], { ...base, metodo: 'transporte', H_ref: 10, pontoRef: 'RN1', pontoChegada: 'RN2' });
  assert.ok(semVolta.erros.some((e) => e.includes('Falta o contranivelamento')));

  const semVante = calcularNivelamento([
    { ponto: 'RN1', re: 1.5, dh: 30 }, { ponto: 'A', irradiado: 1.2, dh: 30 },
  ], { ...base, metodo: 'circuito', H_ref: 10, pontoRef: 'RN1' });
  assert.ok(semVante.erros.some((e) => e.includes('falta a vante de mudança')));

  const semB = calcularNivelamento([
    { ponto: 'RNA', re: 1.5, dh: 30 }, { ponto: 'RNB', vante: 1.2, dh: 30 },
  ], { ...base, metodo: 'linha', H_ref: 10, pontoRef: 'RNA', pontoChegada: 'RNB' });
  assert.ok(semB.erros.some((e) => e.includes('cota conhecida da RN de chegada')));
});

test('funções isoladas: correções e Anexo L ≥ rigorosa', () => {
  perto(correcaoPorEstacao(-0.011, 7, 1), 0.0015714, 1e-7, 'N=1');
  perto(correcaoPorEstacao(-0.011, 7, 7, { arredondarC: true }), 0.0112, 1e-12, 'N=7 com C arredondado');
  perto(correcaoProporcional(0.006, 100, 400), -0.0015, 1e-15, 'proporcional');
  for (const Va of [0.1, 0.3, 0.5, 0.9]) assert.ok(sigmaAnexoLCircuito(0, Va, 1) >= sigmaCircuito(0, Va, 1));
});
