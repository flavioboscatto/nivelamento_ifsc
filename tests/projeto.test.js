// Testes do arquivo de projeto (.niv).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarProjeto, serializarProjeto, lerProjeto, nomeArquivo } from '../src/io/projeto.js';

const agora = new Date('2026-11-25T12:00:00Z');

test('salvar e abrir devolve os mesmos dados', () => {
  const p = criarProjeto({
    nome: 'Aula 3', tipoAltura: 'altitude_normal', modulo: 'geometrico', modo: 'circuito', agora,
    cabecalho: { pontoRef: 'RN1', H_ref: '9,315' },
    relatorio: { objeto: 'Transporte de RN', data: '2026-11-25' },
    linhas: [{ estacao: '1', ponto: 'RN1', re: '1,500' }, {}, { ponto: 'A', irradiado: '1,2' }],
  });
  assert.equal(p.linhas.length, 2, 'linhas vazias não são salvas');
  const r = lerProjeto(serializarProjeto(p), { modulo: 'geometrico' });
  assert.ok(r.ok);
  assert.equal(r.projeto.tipoAltura, 'altitude_normal');
  assert.equal(r.projeto.modo, 'circuito');
  assert.deepEqual(r.projeto.linhas, p.linhas);
  assert.equal(r.projeto.salvoEm, '2026-11-25T12:00:00.000Z');
  assert.deepEqual(r.projeto.relatorio, { objeto: 'Transporte de RN', data: '2026-11-25' });
});

test('arquivos inválidos dão mensagem clara', () => {
  assert.match(lerProjeto('isto não é json').erro, /ilegível/);
  assert.match(lerProjeto('{"a":1}').erro, /não é um projeto/);
  const trig = serializarProjeto(criarProjeto({ modulo: 'trigonometrico', modo: 'x', agora }));
  assert.match(lerProjeto(trig, { modulo: 'geometrico' }).erro, /nivelamento trigonométrico/);
  const futuro = JSON.stringify({ formato: 'nivelamento-ifsc', versao: 99, linhas: [] });
  assert.match(lerProjeto(futuro).erro, /versão 99/);
});

test('coluna antiga "intermediaria" vira "irradiado"', () => {
  const txt = JSON.stringify({ formato: 'nivelamento-ifsc', versao: 1, modulo: 'geometrico', linhas: [{ ponto: 'P', intermediaria: '1,0' }] });
  assert.deepEqual(lerProjeto(txt).projeto.linhas, [{ ponto: 'P', irradiado: '1,0' }]);
});

test('nome do arquivo sem acentos e com extensão .niv', () => {
  assert.equal(nomeArquivo('Aula 3 — Pátio do câmpus', 'circuito', agora), 'aula_3_patio_do_campus.niv');
  assert.equal(nomeArquivo('', 'linha', agora), 'nivelamento_linha_2026-11-25.niv');
});
