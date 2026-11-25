// Testes da Etapa 1 — núcleo numérico, angular e estatístico.
// Executar na raiz do projeto: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseDecimal, formatar, formatarComSinal } from '../src/core/numeros.js';
import {
  parseAngulo, formatarDms, radParaGraus, radParaGon, grausParaRad, zenitalPdPi, segundosParaRad,
} from '../src/core/angulos.js';
import { media, desvioPadrao, desvioPadraoMedia, residuos, detectarAtipicas } from '../src/core/estatistica.js';

const casos = JSON.parse(readFileSync(new URL('./casos_referencia.json', import.meta.url), 'utf8'));
const perto = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: obtido ${a}, esperado ${b}`);

// ---------- números ----------
test('parseDecimal aceita vírgula, ponto e milhar', () => {
  assert.equal(parseDecimal('1,335'), 1.335);
  assert.equal(parseDecimal('1.335'), 1.335);
  assert.equal(parseDecimal(' 972,367 '), 972.367);
  assert.equal(parseDecimal('1.234,567'), 1234.567);
  assert.equal(parseDecimal('1,234.567'), 1234.567);
  assert.equal(parseDecimal('-0,005'), -0.005);
  assert.equal(parseDecimal(2.5), 2.5);
});

test('parseDecimal rejeita texto inválido', () => {
  for (const v of ['', '   ', 'abc', '1,2,3', '1..2', null, undefined]) assert.ok(Number.isNaN(parseDecimal(v)), String(v));
});

test('formatar usa vírgula e não gera -0', () => {
  assert.equal(formatar(9.139, 3), '9,139');
  assert.equal(formatar(1234.5, 1), '1234,5');
  assert.equal(formatar(12.7912, 3), '12,791');
  assert.equal(formatar(-0.0001, 3), '0,000');
  assert.equal(formatar(NaN), '');
  assert.equal(formatarComSinal(0.0045, 4), '+0,0045');
  assert.equal(formatarComSinal(-2.397, 3), '-2,397');
});

// ---------- ângulos ----------
test('parseAngulo: formatos sexagesimais', () => {
  const ref = 91 + 19 / 60 + 40 / 3600;
  for (const t of [`91°19'40"`, '91 19 40', '91-19-40', `91º19’40”`, `91°19'40,0"`]) {
    perto(radParaGraus(parseAngulo(t)), ref, 1e-12, t);
  }
  perto(radParaGraus(parseAngulo(`125°22'58"`)), 125.38277777777778, 1e-12, '125°22\'58"');
  perto(radParaGraus(parseAngulo('-0 30 00')), -0.5, 1e-12, 'negativo');
});

test('parseAngulo: decimal, gon e DD.MMSS', () => {
  perto(radParaGraus(parseAngulo('91,327778')), 91.327778, 1e-12, 'decimal');
  perto(radParaGon(parseAngulo(`91°19'40"`)), 101.47531, 1e-5, 'para gon');
  perto(radParaGraus(parseAngulo('101,47531g')), 91.327779, 1e-5, 'gon');
  perto(radParaGraus(parseAngulo('91.1940', { ddmmss: true })), 91 + 19 / 60 + 40 / 3600, 1e-9, 'DD.MMSS');
});

test('parseAngulo rejeita minutos/segundos ≥ 60 e texto', () => {
  for (const t of [`91°60'00"`, '91 19 60', 'abc', '']) assert.ok(Number.isNaN(parseAngulo(t)), t);
});

test('formatarDms ida e volta', () => {
  assert.equal(formatarDms(parseAngulo(`90°03'11"`)), `90°03'11"`);
  assert.equal(formatarDms(parseAngulo(`89°59'59,6"`)), `90°00'00"`); // arredonda sem gerar 60"
  assert.equal(formatarDms(parseAngulo(`5°07'09,4"`), 1), `5°07'09,4"`);
});

test('série conjugada PD/PI (NBR 5.2.10)', () => {
  // Z verdadeiro 88°22'58", erro de índice +6"
  const z = parseAngulo(`88°22'58"`);
  const eps = segundosParaRad(6);
  const zPD = z + eps;
  const zPI = 2 * Math.PI - z + eps;
  const r = zenitalPdPi(zPD, zPI);
  perto(r.z, z, 1e-12, 'Z médio');
  perto(r.erroIndice / segundosParaRad(1), 6, 1e-6, 'erro de índice (")');
});

test('constante de segundos para rad (π/648000)', () => {
  perto(segundosParaRad(5), 5 * Math.PI / 648000, 1e-18, '5"');
  perto(grausParaRad(180), Math.PI, 1e-15, '180°');
});

// ---------- estatística (Altimetria Aplicada, Exemplo I) ----------
for (const c of casos.estatistica) {
  test(`${c.id}: média, desvio-padrão e desvio da média`, () => {
    perto(media(c.obs), c.esperado.media, 0.00005, 'média');
    perto(desvioPadrao(c.obs), c.esperado.s, 0.00005, 's');
    perto(desvioPadraoMedia(c.obs), c.esperado.s_media, 0.00005, 's da média');
  });
}

test('S01: resíduos seguem a convenção da apostila (v = média − x)', () => {
  const v = residuos(casos.estatistica[0].obs);
  perto(v[0], 12.7839 - 12.792, 0.00006, 'resíduo obs. 1');
  perto(v[6], 12.7839 - 12.718, 0.00006, 'resíduo obs. 7');
});

test('S01: detecta a observação 7 como atípica e só ela', () => {
  const r = detectarAtipicas(casos.estatistica[0].obs);
  assert.equal(r.removidas.length, 1);
  assert.equal(r.removidas[0].indice, 6);
  assert.equal(r.removidas[0].valor, 12.718);
  perto(media(r.mantidas), 12.7912, 0.00005, 'média após remoção');
});
