// xlsx.js — planilha Excel (.xlsx, Office Open XML) sem dependências.
// Textos com número no padrão brasileiro ("9,315", "+0,0016") viram células numéricas com o mesmo
// número de casas; o Excel mostra com vírgula conforme o idioma do computador.
import { criarZip, xml } from './zip.js';

const RE_NUMERO = /^[+-]?\d+(,\d+)?$/;

/** Converte texto brasileiro em {valor, casas} ou null. */
export function numeroBr(t) {
  if (typeof t === 'number') return Number.isFinite(t) ? { valor: t, casas: null } : null;
  const s = String(t ?? '').trim();
  if (!RE_NUMERO.test(s)) return null;
  const casas = s.includes(',') ? s.split(',')[1].length : 0;
  return { valor: Number(s.replace(',', '.')), casas: Math.min(casas, 6) };
}

const letraColuna = (n) => { let s = ''; n += 1; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };
const nomeAba = (n, i) => (String(n || `Planilha${i + 1}`).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || `Planilha${i + 1}`);

/**
 * @param {Array<{nome: string, linhas: Array<Array<string|number|null>>, cabecalho?: number, larguras?: number[]}>} planilhas
 *   cabecalho: índice da linha de títulos (em negrito); padrão 0
 * @returns {Uint8Array}
 */
export function gerarXlsx(planilhas, { agora = new Date() } = {}) {
  // Estilos: 0 normal; 1 negrito; 2..8 números com 0..6 casas
  const fmts = [0, 1, 2, 3, 4, 5, 6].map((c, k) => `<numFmt numFmtId="${164 + k}" formatCode="${c ? `0.${'0'.repeat(c)}` : '0'}"/>`).join('');
  const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>', '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" applyFont="1"/>',
    ...[0, 1, 2, 3, 4, 5, 6].map((c, k) => `<xf numFmtId="${164 + k}" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/>`)].join('');
  const estilos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="7">${fmts}</numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="9">${xfs}</cellXfs></styleSheet>`;

  const abas = planilhas.map((p, i) => {
    const cab = p.cabecalho ?? 0;
    const nCol = Math.max(1, ...p.linhas.map((l) => l.length));
    const larg = Array.from({ length: nCol }, (_, j) => p.larguras?.[j]
      ?? Math.min(60, Math.max(8, ...p.linhas.map((l, r) => (r < cab ? 0 : String(l[j] ?? '').length + 2)))));
    const linhasXml = p.linhas.map((l, r) => `<row r="${r + 1}">${l.map((v, c) => {
      if (v === null || v === undefined || v === '') return '';
      const ref = `${letraColuna(c)}${r + 1}`;
      const num = r === cab ? null : numeroBr(v);
      if (num) return `<c r="${ref}" s="${num.casas === null ? 0 : 2 + num.casas}"><v>${num.valor}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${r === cab ? ' s="1"' : ''}><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
    }).join('')}</row>`).join('');
    return {
      nome: nomeAba(p.nome, i),
      xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${larg.map((w, j) => `<col min="${j + 1}" max="${j + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${linhasXml}</sheetData></worksheet>`,
    };
  });

  return criarZip([
    { nome: '[Content_Types].xml', dados: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${abas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
    { nome: '_rels/.rels', dados: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { nome: 'xl/workbook.xml', dados: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${abas.map((a, i) => `<sheet name="${xml(a.nome)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` },
    { nome: 'xl/_rels/workbook.xml.rels', dados: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${abas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${abas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { nome: 'xl/styles.xml', dados: estilos },
    ...abas.map((a, i) => ({ nome: `xl/worksheets/sheet${i + 1}.xml`, dados: a.xml })),
  ], agora);
}
