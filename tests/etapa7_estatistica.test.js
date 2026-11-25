// Testes da Etapa 7 — estatística de séries (AA Exemplo I).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analisarSerie, lerSerie } from '../src/core/estatistica.js';
import { parseDecimal } from '../src/core/numeros.js';

const casos = JSON.parse(readFileSync(new URL('./casos_referencia.json', import.meta.url), 'utf8'));
const [s01, s02] = casos.estatistica;
const perto = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: obtido ${a}, esperado ${b}`);

test('S01 → S02: com todas e sem a observação 7 (atípica)', () => {
  const r = analisarSerie(s01.obs);
  perto(r.todas.media, s01.esperado.media, 0.00005, 'média S01');
  perto(r.todas.s, s01.esperado.s, 0.00005, 's S01');
  perto(r.todas.sMedia, s01.esperado.s_media, 0.00005, 's média S01');
  assert.deepEqual(r.atipicas.map((a) => a.indice), [6]);
  assert.equal(r.usadas.filter(Boolean).length, 9);
  perto(r.final.media, s02.esperado.media, 0.00005, 'média S02');
  perto(r.final.s, s02.esperado.s, 0.00005, 's S02');
  perto(r.final.sMedia, s02.esperado.s_media, 0.00005, 's média S02');
});

test('sem remover atípicas e com exclusão manual', () => {
  const r = analisarSerie(s01.obs, { removerAtipicas: false });
  assert.equal(r.final.n, 10);
  const m = analisarSerie(s01.obs, { removerAtipicas: false, excluidas: [6] });
  perto(m.final.media, s02.esperado.media, 0.00005, 'excluindo a 7 à mão');
});

test('limite fixo (3 × precisão nominal, NBR 5.2.11)', () => {
  const r = analisarSerie(s01.obs, { limiteFixo: 0.010 });
  assert.deepEqual(r.atipicas.map((a) => a.indice), [6]);
  const nenhum = analisarSerie(s01.obs, { limiteFixo: 0.1 });
  assert.equal(nenhum.atipicas.length, 0);
});

test('lerSerie aceita linhas, ponto e vírgula, tabulação e vírgula decimal', () => {
  const r = lerSerie('12,792\n12.785; 12,783\t12,788  abc', parseDecimal);
  assert.deepEqual(r.valores, [12.792, 12.785, 12.783, 12.788]);
  assert.deepEqual(r.invalidos, [{ posicao: 5, texto: 'abc' }]);
});
