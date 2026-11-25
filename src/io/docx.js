// docx.js — documento Word (.docx, Office Open XML) sem dependências, para o relatório editável.
// Blocos aceitos:
//   { tipo: 'titulo', nivel: 1|2|3, texto }
//   { tipo: 'paragrafo', partes: [{ texto, negrito?, italico?, sub?, sup?, quebra? }] | texto, alinhar?: 'centro'|'direita', tamanho? }
//   { tipo: 'tabela', linhas: [[texto | partes]], cabecalho?: nº de linhas de título, direita?: [índices de coluna], tamanho? }
//   { tipo: 'imagem', bytes: Uint8Array (PNG), largura: px, altura: px, larguraCm }
// Página A4, fontes pretas, tabelas sem preenchimento; rodapé com texto e "Página X de Y".
import { criarZip, xml } from './zip.js';

const TWIP_CM = 567;
const EMU_CM = 360000;

function runs(partes, { tamanho = null, negritoTudo = false } = {}) {
  const lista = typeof partes === 'string' ? [{ texto: partes }] : partes;
  return lista.map((p) => {
    if (p.quebra) return '<w:r><w:br/></w:r>';
    const rPr = [
      (p.negrito || negritoTudo) ? '<w:b/>' : '', p.italico ? '<w:i/>' : '',
      p.sub ? '<w:vertAlign w:val="subscript"/>' : p.sup ? '<w:vertAlign w:val="superscript"/>' : '',
      tamanho ? `<w:sz w:val="${tamanho * 2}"/><w:szCs w:val="${tamanho * 2}"/>` : '',
    ].join('');
    return `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t xml:space="preserve">${xml(p.texto)}</w:t></w:r>`;
  }).join('');
}

function paragrafo(b) {
  const jc = { centro: 'center', direita: 'right' }[b.alinhar];
  const pPr = [b.estilo ? `<w:pStyle w:val="${b.estilo}"/>` : '', jc ? `<w:jc w:val="${jc}"/>` : '', b.espacoDepois !== undefined ? `<w:spacing w:after="${b.espacoDepois}"/>` : ''].join('');
  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${runs(b.partes ?? b.texto ?? '', { tamanho: b.tamanho, negritoTudo: b.negrito })}</w:p>`;
}

function tabela(b) {
  const cab = b.cabecalho ?? 1;
  const tam = b.tamanho ?? 8;
  const direita = new Set(b.direita ?? []);
  const linhas = b.linhas.map((l, r) => {
    const trPr = r < cab ? '<w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>' : '<w:trPr><w:cantSplit/></w:trPr>';
    const tcs = l.map((cel, c) => {
      const jc = direita.has(c) && r >= cab ? '<w:jc w:val="right"/>' : '';
      return `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/>${jc}</w:pPr>${runs(cel ?? '', { tamanho: tam, negritoTudo: r < cab })}</w:p></w:tc>`;
    }).join('');
    return `<w:tr>${trPr}${tcs}</w:tr>`;
  }).join('');
  const borda = (n) => `<w:${n} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblLayout w:type="autofit"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(borda).join('')}</w:tblBorders><w:tblCellMar><w:left w:w="57" w:type="dxa"/><w:right w:w="57" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${(b.linhas[0] || []).map(() => '<w:gridCol/>').join('')}</w:tblGrid>${linhas}</w:tbl><w:p><w:pPr><w:spacing w:after="60"/></w:pPr></w:p>`;
}

function imagem(b, rid, id) {
  const larguraCm = b.larguraCm ?? 17;
  const cx = Math.round(larguraCm * EMU_CM);
  const cy = Math.round(cx * b.altura / b.largura);
  return `<w:p><w:pPr><w:jc w:val="${b.alinhar === 'esquerda' ? 'left' : 'center'}"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Figura ${id}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="figura${id}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

/**
 * @param {Array<object>} blocos
 * @param {{rodape?: string, titulo?: string, autor?: string}} op
 * @returns {Uint8Array}
 */
export function gerarDocx(blocos, { rodape = '', titulo = '', autor = '', agora = new Date() } = {}) {
  const midias = [];
  let corpo = '';
  for (const b of blocos) {
    if (b.tipo === 'titulo') corpo += paragrafo({ estilo: `Ttulo${b.nivel ?? 1}`, partes: b.texto });
    else if (b.tipo === 'paragrafo') corpo += paragrafo(b);
    else if (b.tipo === 'tabela' && b.linhas?.length) corpo += tabela(b);
    else if (b.tipo === 'imagem' && b.bytes?.length) {
      midias.push(b.bytes);
      corpo += imagem(b, `rIdImg${midias.length}`, midias.length);
    } else if (b.tipo === 'quebra') corpo += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  }
  const m = Math.round(1.5 * TWIP_CM);
  const ns = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  const documento = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${ns}><w:body>${corpo}<w:sectPr><w:footerReference w:type="default" r:id="rIdRodape"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${m}" w:right="${Math.round(1.4 * TWIP_CM)}" w:bottom="${Math.round(1.8 * TWIP_CM)}" w:left="${Math.round(1.4 * TWIP_CM)}" w:header="425" w:footer="425" w:gutter="0"/></w:sectPr></w:body></w:document>`;

  const campo = (instr) => `<w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:instrText xml:space="preserve"> ${instr} </w:instrText></w:r><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>`;
  const texto8 = (t) => `<w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">${xml(t)}</w:t></w:r>`;
  const rodapeXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr ${ns}><w:p><w:pPr><w:pBdr><w:top w:val="single" w:sz="4" w:space="2" w:color="000000"/></w:pBdr><w:tabs><w:tab w:val="right" w:pos="${11906 - Math.round(2.8 * TWIP_CM)}"/></w:tabs><w:spacing w:after="0"/></w:pPr>${texto8(rodape)}<w:r><w:tab/></w:r>${texto8('Página ')}${campo('PAGE')}${texto8(' de ')}${campo('NUMPAGES')}</w:p></w:ftr>`;

  const estilos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/><w:color w:val="000000"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Ttulo1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="0" w:after="60"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="30"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Ttulo2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="000000"/></w:pBdr><w:spacing w:before="240" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="23"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Ttulo3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="120" w:after="60"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="20"/></w:rPr></w:style>
</w:styles>`;

  const iso = agora.toISOString().replace(/\.\d+Z$/, 'Z');
  return criarZip([
    { nome: '[Content_Types].xml', dados: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>` },
    { nome: '_rels/.rels', dados: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
    { nome: 'docProps/core.xml', dados: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(titulo)}</dc:title><dc:creator>${xml(autor)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created></cp:coreProperties>` },
    { nome: 'word/document.xml', dados: documento },
    { nome: 'word/styles.xml', dados: estilos },
    { nome: 'word/footer1.xml', dados: rodapeXml },
    { nome: 'word/_rels/document.xml.rels', dados: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdEstilos" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdRodape" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>${midias.map((_, i) => `<Relationship Id="rIdImg${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/imagem${i + 1}.png"/>`).join('')}</Relationships>` },
    ...midias.map((bytes, i) => ({ nome: `word/media/imagem${i + 1}.png`, dados: bytes })),
  ], agora);
}
