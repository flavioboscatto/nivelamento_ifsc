// Testes da Etapa 3 — caderneta de nivelamento geométrico e irradiação.
// Executar na raiz do projeto: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  calcularCaderneta, sigmaIntermediaria, sigmaVanteF1, sigmaLeituraPorMetro,
} from '../src/core/geometrico.js';

const ler = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
const casos = ler('./casos_referencia.json');
const norma = ler('../data/norma_nbr13133_2021.json');
const instrumentos = ler('../data/instrumentos.json');
const caso = (id) => Object.values(casos).flat().find((c) => c && c.id === id);
const perto = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: obtido ${a}, esperado ${b}`);
const TOL_H = casos.tolerancia_numerica.altura_m;

// Parâmetros dos alertas lidos do JSON da norma (nunca fixos no teste)
const limites = {
  C: norma.alertasPrograma.constanteEstadimetrica,
  tol3fios_m: norma.alertasPrograma.tolerancia3fios_m,
  difReVanteMax_m: norma.alertasPrograma.difReVanteMax_m,
  visadaMax_m: norma.geometrico[0].visadaMax_m,
  alturaMin_m: norma.alturaMinVisada_m,
};

/** Caderneta do circuito G06 (AA Tab. 9) com as DH de ré e vante do caso P01. */
function cadernetaG06() {
  const g06 = caso('G06');
  const dh = caso('P01').estacoes_dh;
  const linhas = [];
  let rePonto = 'RN2';
  g06.estacoes.forEach((e, j) => {
    const est = String.fromCharCode(97 + j); // a, b, c…
    linhas.push({ estacao: est, ponto: rePonto, re: e.re, dh: dh[j][1] });
    for (const [p, leit] of Object.entries(e.intermediarias)) {
      linhas.push({ ponto: p, intermediaria: String(leit).replace('.', ','), dh: p === '14' ? 12.356 : '' });
    }
    linhas.push({ ponto: e.mudanca[0], vante: e.mudanca[1], dh: dh[j][2] });
    rePonto = e.mudanca[0];
  });
  return { g06, linhas };
}

test('parâmetros da norma e do nível vêm de data/*.json', () => {
  assert.equal(norma.rotulo, 'ABNT NBR 13133:2021');
  assert.deepEqual(norma.geometrico.map((g) => g.tol_mm_raizK), [6, 8, 12]);
  assert.equal(norma.alturaMinVisada_m, 0.30);
  const sprinter = instrumentos.niveis.find((n) => n.id === 'sprinter150_eletronica');
  perto(sigmaLeituraPorMetro(sprinter.sigmaLeitura_mm, sprinter.distanciaRef_m), 2e-5, 1e-12, 'σL Sprinter');
});

test('G01 — NBR F.2: H(A1) = 9,139 m ± 3,8 mm', () => {
  const g = caso('G01');
  const linhas = g.caderneta.map((l) => ({ estacao: l.est, ponto: l.ponto, re: l.re, vante: l.vante, dh: l.dh }));
  const r = calcularCaderneta(linhas, { H_ref: g.H_RN, sigmaRef_m: g.sigma_RN_m, pontoRef: 'RN80', sigmaL: g.sigma_L_m_por_m, ...limites });
  assert.deepEqual(r.erros, []);
  const a1 = r.pontos.find((p) => p.ponto === 'A1');
  perto(a1.H, g.esperado.H_A1, TOL_H, 'H(A1)');
  perto(a1.sigma * 1000, g.esperado.sigma_A1_m * 1000, casos.tolerancia_numerica.mm, 'σ(A1) mm');
  assert.equal(r.linhas[1].sigmaForma, 'F.1');
  perto(r.linhas[0].apv, 10.650, 1e-9, 'APV');
  assert.ok(r.verificacao.aplicavel && r.verificacao.confere, 'verificação aritmética');
  perto(r.verificacao.diferencaLeituras, -0.176, 1e-9, 'Σré − Σvante');
  perto(r.estacoes[0].difReVante, 5.247, 1e-9, 'ré − vante');
  perto(r.extensao_m, 115.403, 1e-9, 'extensão');
});

test('G06 — circuito AA Tab. 9: alturas calculadas, fecho e verificação aritmética', () => {
  const { g06, linhas } = cadernetaG06();
  const r = calcularCaderneta(linhas, { H_ref: g06.H_RN, pontoRef: 'RN2', sigmaL: 2e-5, ...limites });
  assert.deepEqual(r.erros, []);
  const H = (p) => r.pontos.filter((x) => x.ponto === p).at(-1).H;
  perto(H('RN2'), g06.esperado.H_fecho, TOL_H, 'H de fecho em RN2');
  perto((H('RN2') - g06.H_RN) * 1000, g06.esperado.erro_mm, casos.tolerancia_numerica.mm, 'erro de fechamento (mm)');
  perto(H('2'), 5.783, TOL_H, 'ponto 2 antes da distribuição');
  perto(H('A1'), 6.092, TOL_H, 'A1');
  perto(r.extensao_m, g06.perimetro_m, 1e-6, 'perímetro (só ré e vantes de mudança)');
  assert.ok(r.verificacao.aplicavel && r.verificacao.confere, 'verificação aritmética');
  assert.equal(r.estacoes.length, 7);
  assert.ok(r.alertas.some((a) => a.includes('lances ímpar')), 'alerta de lances ímpar');
});

test('P01 — σ encadeado pela NBR F.1 até o fecho ≈ √VT = 3,87 mm', () => {
  const { g06, linhas } = cadernetaG06();
  const r = calcularCaderneta(linhas, { H_ref: g06.H_RN, pontoRef: 'RN2', sigmaL: 2e-5, ...limites });
  const rn2 = r.pontos.filter((x) => x.ponto === 'RN2').at(-1);
  perto(rn2.sigma * 1000, caso('P01').esperado_mm.sigma_fecho_leitura, casos.tolerancia_numerica.mm, 'σ no fecho');
});

test('P01 — σ do ponto intermediário 14 (4.3.6 d) = 2,02 mm', () => {
  const s = sigmaIntermediaria(0.00172, 2e-5, 51.436, 12.356);
  perto(s * 1000, caso('P01').esperado_mm.intermediario_14, casos.tolerancia_numerica.mm, 'σ(14)');
  // Com visadas iguais, a forma sem simplificação coincide com a F.1
  perto(sigmaIntermediaria(0.001, 2e-5, 40, 40), sigmaVanteF1(0.001, 2e-5, 40, 40), 1e-15, 'equidistantes');
});

test('irradiação: intermediárias da estação a do circuito G06', () => {
  const { g06, linhas } = cadernetaG06();
  const r = calcularCaderneta(linhas.slice(0, 5), { H_ref: g06.H_RN, pontoRef: 'RN2', sigmaL: 2e-5, ...limites });
  assert.deepEqual(r.erros, []);
  const H = (p) => r.pontos.find((x) => x.ponto === p).H;
  perto(H('1'), 6.300, TOL_H, 'ponto 1');
  perto(H('2'), 5.783, TOL_H, 'ponto 2');
  perto(H('3'), 5.880, TOL_H, 'ponto 3');
  assert.equal(r.linhas[1].intermediaria, undefined);
  assert.equal(r.linhas[1].tipo, 'intermediaria');
  assert.ok(Number.isNaN(r.linhas[1].sigma), 'sem DH não há σ');
  assert.ok(r.linhas[1].alertas.some((a) => a.includes('desvio-padrão')), 'avisa que falta DH');
  assert.ok(r.alertas.some((a) => a.includes('não têm verificação de fechamento')));
  assert.ok(r.verificacao.confere, 'verificação com a vante A1');
});

test('irradiação sem vante: verificação aritmética não se aplica', () => {
  const r = calcularCaderneta([
    { estacao: '1', ponto: 'RN1', re: '1,500', dh: '30' },
    { ponto: 'P1', intermediaria: '1,200', dh: '25' },
  ], { H_ref: '100,000', sigmaRef_m: 0.002, pontoRef: 'RN1', sigmaL: 2e-5, ...limites });
  assert.deepEqual(r.erros, []);
  perto(r.pontos[1].H, 100.3, 1e-9, 'P1');
  perto(r.linhas[1].distAcum, 55, 1e-9, 'distância acumulada');
  assert.equal(r.verificacao.aplicavel, false);
  assert.equal(r.linhas[1].sigmaForma, 'F.1 sem simplificação');
});

test('três fios: DH por estadimetria e alerta de fio médio', () => {
  const r = calcularCaderneta([
    { ponto: 'RN1', re: '1,500', fs: '1,650', fi: '1,350' },
    { ponto: 'A', vante: '1,205', fs: '1,360', fi: '1,040' },
  ], { H_ref: 10, sigmaL: 2e-5, ...limites });
  assert.deepEqual(r.erros, []);
  perto(r.linhas[0].dh, 30, 1e-9, 'DH ré');
  assert.equal(r.linhas[0].dhOrigem, 'estadimetria');
  perto(r.linhas[1].dh, 32, 1e-9, 'DH vante');
  assert.deepEqual(r.linhas[0].alertas, []);
  // (1,360 + 1,040)/2 = 1,200 → fio médio 1,205 difere 5 mm > 2 mm
  assert.ok(r.linhas[1].alertas.some((a) => a.includes('fio médio')), 'alerta 3 fios');
  perto(r.linhas[1].dif3fios, 0.005, 1e-9, 'diferença do fio médio');
});

test('DH digitada prevalece sobre a estadimetria', () => {
  const r = calcularCaderneta([
    { ponto: 'RN1', re: 1.5, fs: 1.65, fi: 1.35, dh: 30.2 },
    { ponto: 'A', vante: 1.2, dh: 30 },
  ], { H_ref: 10, sigmaL: 2e-5, ...limites });
  assert.equal(r.linhas[0].dh, 30.2);
  assert.equal(r.linhas[0].dhOrigem, 'digitada');
  perto(r.linhas[0].dhEstadimetria, 30, 1e-9, 'estadimetria calculada ao lado');
});

test('alertas de campo: visada longa, leitura baixa, ré − vante', () => {
  const r = calcularCaderneta([
    { ponto: 'RN1', re: '0,250', dh: '85' },
    { ponto: 'A', vante: '1,200', dh: '60' },
  ], { H_ref: 10, sigmaL: 2e-5, ...limites });
  assert.deepEqual(r.erros, []);
  const txt = r.alertas.join(' | ');
  assert.match(txt, /visada de 85,0 m maior que 80 m/);
  assert.match(txt, /leitura de 0,250 m abaixo de 0,30 m/);
  assert.match(txt, /diferença ré − vante de 25,0 m/);
});

test('erros em linguagem de agrimensor, sem perder o resto da caderneta', () => {
  const r = calcularCaderneta([
    { estacao: '1', ponto: 'RN1', re: '1,500', dh: 30 },
    { ponto: 'A1', vante: '' },
    { ponto: 'A2', intermediaria: '1,2x' },
    { ponto: 'A3', intermediaria: '1,300', vante: '1,400' },
    { ponto: 'A4', vante: '1,100', dh: 30 },
    { ponto: 'A5', vante: '1,000' },
  ], { H_ref: 10, sigmaL: 2e-5, ...limites });
  assert.equal(r.valido, false);
  assert.match(r.erros[0], /^Linha 2 \(estação 1, ponto A1\): a leitura na mira está vazia/);
  assert.match(r.erros[1], /Linha 3 .*intermediária "1,2x" não é um número/);
  assert.match(r.erros[2], /Linha 4 .*só uma leitura por linha/);
  assert.match(r.erros[3], /Linha 6 .*já tem uma vante \(A4\)/);
  perto(r.pontos.find((p) => p.ponto === 'A4').H, 10.4, 1e-9, 'A4 calculado mesmo com erros em outras linhas');
});

test('caderneta precisa começar com ré e ter altura de referência', () => {
  const r1 = calcularCaderneta([{ ponto: 'A', vante: 1.2 }], { H_ref: 10 });
  assert.match(r1.erros[0], /começar com uma leitura de ré/);
  const r2 = calcularCaderneta([{ ponto: 'RN1', re: 1.5 }, { ponto: 'A', vante: 1.2 }], { H_ref: '' });
  assert.match(r2.erros[0], /Informe a altura/);
  assert.ok(Number.isNaN(r2.linhas[1].H));
});

test('ré de nova estação em ponto já calculado (irradiação a partir de outro ponto)', () => {
  const r = calcularCaderneta([
    { estacao: '1', ponto: 'RN1', re: 1.5, dh: 20 },
    { ponto: 'P1', intermediaria: 1.0, dh: 20 },
    { estacao: '2', ponto: 'P1', re: 1.2, dh: 20 },
    { ponto: 'P2', intermediaria: 0.7, dh: 20 },
  ], { H_ref: 10, pontoRef: 'RN1', sigmaL: 2e-5, ...limites });
  assert.deepEqual(r.erros, []);
  perto(r.pontos.find((p) => p.ponto === 'P2').H, 11.0, 1e-9, 'P2');
  assert.equal(r.verificacao.aplicavel, false);
});

test('classe do nível pela Tabela 3 (NBR 2021), limites do JSON', async () => {
  const { classeDoNivel } = await import('../src/core/tolerancias.js');
  const lim = norma.classesNivel_mm_km;
  assert.equal(classeDoNivel(1.0, lim).classe, 1);   // Sprinter 250M
  assert.equal(classeDoNivel(1.5, lim).classe, 2);   // Sprinter 150/150M
  assert.equal(classeDoNivel(2.0, lim).classe, 2);   // Sprinter 50
  assert.equal(classeDoNivel(6.0, lim).classe, 3);
  assert.equal(classeDoNivel(8.0, lim).classe, 4);
  assert.equal(classeDoNivel(1.5, lim).rotulo, 'classe 2 (NBR 2021) — ≤ 2 mm/km');
  assert.equal(classeDoNivel(8.0, lim).rotulo, 'classe 4 (NBR 2021) — > 6 mm/km');
  assert.equal(classeDoNivel(NaN, lim), null);
});
