// Testes do gravador de CSV.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gerarCsv, campoCsv, BOM } from '../src/io/csv.js';

test('CSV com ";" e vírgula decimal preservada', () => {
  const t = gerarCsv([['Ponto', 'Cota (m)'], ['RN2', '8,659'], ['A1', '+0,0016']]);
  assert.equal(t, `${BOM}Ponto;Cota (m)\r\nRN2;8,659\r\nA1;+0,0016\r\n`);
});

test('campos com ";", aspas ou quebra de linha', () => {
  assert.equal(campoCsv('a;b'), '"a;b"');
  assert.equal(campoCsv('diz "oi"'), '"diz ""oi"""');
  assert.equal(campoCsv('linha 1\nlinha 2'), 'linha 1 linha 2');
  assert.equal(campoCsv(null), '');
});

test('identificação antes da tabela', () => {
  const t = gerarCsv([['x']], { cabecalhoArquivo: ['Projeto: Aula 3', 'ABNT NBR 13133:2021'] });
  assert.equal(t, `${BOM}Projeto: Aula 3\r\nABNT NBR 13133:2021\r\n\r\nx\r\n`);
});
