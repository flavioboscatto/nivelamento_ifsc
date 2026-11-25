// projeto.js — salvar e abrir projetos (.niv = JSON com formato próprio).
// Funções puras, sem DOM: a página só cria o arquivo e lê o texto escolhido pelo usuário.

export const FORMATO = 'nivelamento-ifsc';
export const VERSAO = 1;
export const EXTENSAO = '.niv';

const TIPOS_ALTURA = ['cota', 'altitude_normal'];

/** Monta o objeto do projeto. Nada de resultados: tudo é recalculado ao abrir. */
export function criarProjeto({ nome = '', tipoAltura = 'cota', modulo, modo, cabecalho = {}, linhas = [], relatorio = {}, agora = new Date() }) {
  return {
    formato: FORMATO,
    versao: VERSAO,
    norma: 'ABNT NBR 13133:2021',
    salvoEm: agora.toISOString(),
    nome,
    tipoAltura,
    modulo,
    modo,
    cabecalho,
    relatorio,
    linhas: linhas.filter((l) => Object.values(l).some((v) => String(v ?? '').trim() !== '')),
  };
}

export const serializarProjeto = (p) => JSON.stringify(p, null, 2) + '\n';

/**
 * Lê o texto de um arquivo .niv (ou .json).
 * @returns {{ok:true, projeto:object} | {ok:false, erro:string}}
 */
export function lerProjeto(texto, { modulo } = {}) {
  let p;
  try { p = JSON.parse(texto); } catch {
    return { ok: false, erro: 'O arquivo não é um projeto da calculadora (conteúdo ilegível).' };
  }
  if (!p || p.formato !== FORMATO) return { ok: false, erro: 'O arquivo não é um projeto da Calculadora de Nivelamento IFSC.' };
  if (!(p.versao >= 1) || p.versao > VERSAO) return { ok: false, erro: `Projeto da versão ${p.versao}; esta página lê até a versão ${VERSAO}. Atualize a página.` };
  if (modulo && p.modulo !== modulo) {
    const nomes = { geometrico: 'nivelamento geométrico', trigonometrico: 'nivelamento trigonométrico', apoio: 'estatística de séries' };
    return { ok: false, erro: `Este projeto é de ${nomes[p.modulo] || p.modulo}. Abra-o na página correspondente.` };
  }
  if (!Array.isArray(p.linhas)) return { ok: false, erro: 'O projeto não tem a caderneta (lista de linhas).' };
  const linhas = p.linhas.map((l) => {
    const { intermediaria, ...resto } = l || {};
    return intermediaria !== undefined && resto.irradiado === undefined ? { ...resto, irradiado: intermediaria } : resto;
  });
  return {
    ok: true,
    projeto: {
      ...p,
      tipoAltura: TIPOS_ALTURA.includes(p.tipoAltura) ? p.tipoAltura : 'cota',
      cabecalho: p.cabecalho && typeof p.cabecalho === 'object' ? p.cabecalho : {},
      relatorio: p.relatorio && typeof p.relatorio === 'object' ? p.relatorio : {},
      linhas,
    },
  };
}

/** Nome de arquivo seguro: "Aula 3 — pátio" → "aula_3_patio.niv". */
export function nomeArquivo(nome, modo, agora = new Date()) {
  const base = String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
  const data = agora.toISOString().slice(0, 10);
  return `${base || `nivelamento_${modo || 'projeto'}_${data}`}${EXTENSAO}`;
}
