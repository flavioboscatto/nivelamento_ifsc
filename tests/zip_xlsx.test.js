// Testes do ZIP e da planilha .xlsx (sem dependências: o leitor abaixo só confere a estrutura).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarZip, crc32 } from '../src/io/zip.js';
import { gerarXlsx, numeroBr } from '../src/io/xlsx.js';

/** Leitor mínimo de ZIP "store": devolve {nome: texto}. */
function lerZip(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const fim = bytes.length - 22;
  assert.equal(v.getUint32(fim, true), 0x06054b50, 'fim do diretório central');
  const n = v.getUint16(fim + 10, true);
  let p = v.getUint32(fim + 16, true);
  const saida = {};
  for (let k = 0; k < n; k++) {
    assert.equal(v.getUint32(p, true), 0x02014b50);
    const crc = v.getUint32(p + 16, true), tam = v.getUint32(p + 20, true);
    const ln = v.getUint16(p + 28, true), off = v.getUint32(p + 42, true);
    const nome = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + ln));
    const lnLoc = v.getUint16(off + 26, true);
    const dados = bytes.subarray(off + 30 + lnLoc, off + 30 + lnLoc + tam);
    assert.equal(crc32(dados), crc, `CRC de ${nome}`);
    saida[nome] = new TextDecoder().decode(dados);
    p += 46 + ln;
  }
  return saida;
}

test('CRC-32 de referência', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xCBF43926);
});

test('ZIP: nomes com acento e conteúdo preservados', () => {
  const z = lerZip(criarZip([{ nome: 'a.txt', dados: 'olá' }, { nome: 'pasta/cotação.xml', dados: '<x/>' }]));
  assert.deepEqual(z, { 'a.txt': 'olá', 'pasta/cotação.xml': '<x/>' });
});

test('números no padrão brasileiro viram células numéricas', () => {
  assert.deepEqual(numeroBr('9,315'), { valor: 9.315, casas: 3 });
  assert.deepEqual(numeroBr('+0,0016'), { valor: 0.0016, casas: 4 });
  assert.deepEqual(numeroBr('-11'), { valor: -11, casas: 0 });
  assert.equal(numeroBr('RN1'), null);
  assert.equal(numeroBr('91°19\'40"'), null);
  assert.equal(numeroBr('1.234,5'), null);
});

test('.xlsx: estrutura, abas e células', () => {
  const z = lerZip(gerarXlsx([
    { nome: 'Resultados', linhas: [['Ponto', 'Cota (m)'], ['RN2', '8,659'], ['A & B', '+0,0016']] },
    { nome: 'Nome/com:inválidos', linhas: [['x']] },
  ]));
  for (const f of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']) assert.ok(z[f], f);
  assert.match(z['xl/workbook.xml'], /name="Resultados"/);
  assert.match(z['xl/workbook.xml'], /name="Nome com inválidos"/);
  assert.match(z['xl/worksheets/sheet1.xml'], /<c r="B2" s="5"><v>8.659<\/v><\/c>/);
  assert.match(z['xl/worksheets/sheet1.xml'], /A &amp; B/);
  assert.match(z['xl/worksheets/sheet1.xml'], /<c r="A1" t="inlineStr" s="1">/);
});

test('.docx: partes, imagem, tabela e rodapé com número de página', async () => {
  const { gerarDocx } = await import('../src/io/docx.js');
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const z = lerZip(gerarDocx([
    { tipo: 'titulo', nivel: 2, texto: '1. Identificação' },
    { tipo: 'paragrafo', partes: [{ texto: 'σ', negrito: true }, { texto: 'RN', sub: true }] },
    { tipo: 'tabela', linhas: [['Ponto', 'Cota (m)'], ['RN2', '8,659']], direita: [1] },
    { tipo: 'imagem', bytes: png, largura: 900, altura: 340, larguraCm: 17 },
  ], { rodape: 'Calculadora de Nivelamento IFSC' }));
  const doc = z['word/document.xml'];
  assert.match(doc, /<w:pStyle w:val="Ttulo2"\/>/);
  assert.match(doc, /<w:vertAlign w:val="subscript"\/>/);
  assert.match(doc, /<w:tblHeader\/>/);
  assert.match(doc, /<w:jc w:val="right"\/><\/w:pPr><w:r><w:rPr><w:sz w:val="16"\/>/);
  assert.match(doc, /r:embed="rIdImg1"/);
  assert.ok(z['word/media/imagem1.png'] !== undefined);
  assert.match(z['word/footer1.xml'], /PAGE/);
  assert.match(z['word/footer1.xml'], /NUMPAGES/);
  assert.match(z['[Content_Types].xml'], /Extension="png"/);
});
