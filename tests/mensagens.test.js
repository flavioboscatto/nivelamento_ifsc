// Agrupamento de avisos repetidos (interface).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agruparMensagens } from '../src/ui/mensagens.js';

test('mesmo aviso em várias linhas vira uma só mensagem', () => {
  const r = agruparMensagens([
    'Linha 2 (estação a, ponto 1): sem DH.',
    'Linha 3 (estação a, ponto 2): sem DH.',
    'Número de lances ímpar (7).',
    'Linha 5 (estação b, ponto 4): sem DH.',
    'Linha 6 (estação b, ponto A): fio médio difere 3 mm.',
  ]);
  assert.deepEqual(r, [
    'Linhas 2, 3 e 5: sem DH.',
    'Número de lances ímpar (7).',
    'Linha 6 (estação b, ponto A): fio médio difere 3 mm.',
  ]);
});
