// fechamento.js — transporte de RN, circuito fechado e linha entre duas RN (etapa 4).
// Usa a caderneta calculada (geometrico.js), avalia o erro de fechamento pela NBR 13133:2021
// (Tabela 5), distribui o erro (proporcional à distância ou por estação) e propaga o σ.
// Ver docs/02_METODOS_E_FORMULAS.md (2.2.5–2.2.8) e docs/04_PROPAGACAO_PRECISOES.md (4.3.3–4.3.6).

import { calcularCaderneta } from './geometrico.js';
import { avaliarFechamento } from './tolerancias.js';
import { correcaoProporcional, correcaoPorEstacao, correcaoPorEstacaoC } from './ajustamento.js';
import {
  varianciaEstacaoLeitura, varianciaEstacaoKm, sigmaCircuito, sigmaLinha, sigmaTransporte,
  sigmaAnexoLCircuito, sigmaAnexoLLinha,
} from './propagacao.js';
import { parseDecimal, formatar } from './numeros.js';

export const METODOS = ['irradiacao', 'transporte', 'circuito', 'linha'];

/**
 * @param {Array<object>} linhas  caderneta (ver calcularCaderneta)
 * @param {object} op  opções de calcularCaderneta e mais:
 *   metodo: 'irradiacao' | 'transporte' | 'circuito' | 'linha'
 *   pontoChegada: RN de chegada (transporte: RN2 visitada na ida; linha: RN B)
 *   H_chegada, sigmaChegada_m: altura conhecida da RN B (linha)
 *   distribuicao: 'distancia' (NBR 5.5.2.12, padrão) | 'estacao' (didático, apostila)
 *   arredondarC: reproduz o arredondamento de C da apostila (errata E2)
 *   classes: norma.geometrico (Tabela 5); classeId: classe escolhida; classeNivel: classe do nível
 *   difExtensaoMax: diferença máxima entre ida e volta (fração; padrão 0,10)
 */
export function calcularNivelamento(linhas, op = {}) {
  const {
    metodo = 'irradiacao', pontoChegada = '', H_chegada, sigmaChegada_m = 0,
    distribuicao = 'distancia', arredondarC = false, classes = [], classeId = null, classeNivel = null,
    sigmaRef_m = 0, sigmaL = null, sigmaKm_m = null, pontoRef = '', difExtensaoMax = 0.10,
  } = op;

  const cad = calcularCaderneta(linhas, op);
  if (metodo === 'irradiacao') return { ...cad, metodo, fechamento: null };

  const erros = [...cad.erros];
  const alertas = [...cad.alertas];
  // A recomendação das intermediárias não vale para os modos com fechamento: elas continuam sem
  // controle próprio, mas o aviso geral de "sem verificação" é substituído pelo fechamento.
  const iIrr = alertas.findIndex((a) => a.startsWith('Pontos irradiados'));
  if (iIrr >= 0) alertas.splice(iIrr, 1);

  const fech = { calculado: false, metodo, distribuicao };
  const fim = () => ({ ...cad, metodo, erros, alertas, valido: erros.length === 0, fechamento: fech });

  if (!cad.valido) { fech.motivo = 'Corrija os erros da caderneta para calcular o fechamento.'; return fim(); }
  const ests = cad.estacoes;
  if (!ests.length) { fech.motivo = 'Caderneta vazia.'; return fim(); }

  // Encadeamento: toda estação tem vante e a ré da seguinte é essa vante
  ests.forEach((e, j) => {
    if (e.vantePonto === null) erros.push(`Estação ${e.rotulo}: falta a vante de mudança${j === ests.length - 1 ? ' (ou o ponto de chegada)' : ''}. No ${nomeMetodo(metodo)} todas as estações precisam de ré e vante.`);
    if (j > 0 && !e.encadeada) erros.push(`Estação ${e.rotulo}: a ré não é a vante da estação anterior; o ${nomeMetodo(metodo)} precisa de estações encadeadas.`);
  });
  if (erros.length) { fech.motivo = 'Corrija os erros da caderneta para calcular o fechamento.'; return fim(); }

  const ultima = ests.at(-1);
  const Hfecho = ultima.Hvante;
  const ref = String(pontoRef || ests[0].rePonto || '').trim();
  let Hconhecida, sigmaB = 0, jChegada = -1;

  if (metodo === 'linha') {
    const hB = parseDecimal(H_chegada);
    if (!Number.isFinite(hB)) {
      erros.push(`Informe a altura conhecida da RN de chegada${pontoChegada ? ` (${pontoChegada})` : ''}.`);
      fech.motivo = 'Falta a altura da RN de chegada.';
      return fim();
    }
    Hconhecida = hB;
    sigmaB = Number.isFinite(sigmaChegada_m) ? sigmaChegada_m : 0;
    if (pontoChegada && ultima.vantePonto !== String(pontoChegada).trim()) {
      alertas.push(`A caderneta termina em "${ultima.vantePonto}", mas a RN de chegada informada é "${pontoChegada}".`);
    }
  } else {
    Hconhecida = ests[0].Hre;
    if (ref && ultima.vantePonto !== ref) {
      alertas.push(`O ${nomeMetodo(metodo)} deve terminar no ponto de partida (${ref}), mas a última vante é "${ultima.vantePonto}".`);
    }
    if (metodo === 'transporte') {
      const alvo = String(pontoChegada || '').trim();
      if (!alvo) {
        erros.push('Informe o nome da RN de chegada (ponto transportado, ex.: RN2).');
        fech.motivo = 'Falta o nome da RN de chegada.';
        return fim();
      }
      jChegada = ests.findIndex((e) => e.vantePonto === alvo);
      if (jChegada < 0) {
        erros.push(`A RN de chegada "${alvo}" não aparece como vante na caderneta.`);
        fech.motivo = 'RN de chegada não encontrada.';
        return fim();
      }
      if (jChegada === ests.length - 1) {
        erros.push(`Falta o contranivelamento: a caderneta termina na RN de chegada "${alvo}". Continue até voltar a ${ref || 'RN de partida'}.`);
        fech.motivo = 'Falta o contranivelamento.';
        return fim();
      }
    }
  }

  const erro_m = Hfecho - Hconhecida;
  const n = ests.length;
  const temDh = ests.every((e) => Number.isFinite(e.lance));
  const extensao_m = temDh ? ests.reduce((a, e) => a + e.lance, 0) : NaN;

  // K: extensão em um sentido (transporte = ida; circuito = perímetro; linha = extensão)
  let K_m = extensao_m;
  if (metodo === 'transporte' && temDh) {
    const ida = ests.slice(0, jChegada + 1).reduce((a, e) => a + e.lance, 0);
    const volta = extensao_m - ida;
    K_m = ida;
    const dif = Math.abs(ida - volta) / ida;
    fech.extensaoIda_m = ida;
    fech.extensaoVolta_m = volta;
    fech.difExtensao = dif;
    if (dif > difExtensaoMax) {
      alertas.push(`As extensões do nivelamento (${formatar(ida, 3)} m) e do contranivelamento (${formatar(volta, 3)} m) diferem ${formatar(dif * 100, 1)} % (limite do programa ${formatar(difExtensaoMax * 100, 0)} %).`);
    }
  }
  if (!temDh) {
    erros.push('Para calcular a extensão K, a tolerância e a distribuição proporcional, digite a DH (ou os três fios) de todas as visadas de ré e vante de mudança.');
  }

  Object.assign(fech, {
    calculado: true, Hfecho, Hconhecida, erro_m, n, extensao_m, K_km: K_m / 1000,
    pontoFecho: ultima.vantePonto,
  });

  // Tolerância (Tabela 5)
  fech.tolerancias = avaliarFechamento(erro_m, fech.K_km, classes);
  fech.classe = fech.tolerancias.find((t) => t.id === classeId) || null;
  const cfgClasse = classes.find((c) => c.id === classeId);
  if (cfgClasse && Number.isFinite(classeNivel) && classeNivel > cfgClasse.classeNivelMax) {
    alertas.push(`O nível informado é classe ${classeNivel} (NBR 2021), mas a classe ${cfgClasse.id} exige nível classe ${cfgClasse.classeNivelMax} ou melhor (Tabela 5).`);
  }

  // Variâncias por estação
  const Vl = sigmaL !== null && temDh ? ests.map((e) => varianciaEstacaoLeitura(sigmaL, e.dhRe, e.dhVante)) : null;
  const Vk = sigmaKm_m !== null && temDh ? ests.map((e) => varianciaEstacaoKm(sigmaKm_m, e.dhRe, e.dhVante)) : null;
  const acum = (V) => V && V.reduce((a, v) => { a.push((a.at(-1) ?? 0) + v); return a; }, []);
  const cumL = acum(Vl), cumK = acum(Vk);
  const VT_L = cumL ? cumL.at(-1) : NaN, VT_K = cumK ? cumK.at(-1) : NaN;
  fech.sigmaEsperado_m = Math.sqrt(VT_L);
  fech.sigmaEsperadoKm_m = Math.sqrt(VT_K);
  fech.razaoErroSigma = Math.abs(erro_m) / fech.sigmaEsperado_m;

  const sigmaRig = (Va, VT) => (metodo === 'linha' ? sigmaLinha(sigmaRef_m, sigmaB, Va, VT) : sigmaCircuito(sigmaRef_m, Va, VT));
  const sigmaL_ = (Va, VT) => (metodo === 'linha' ? sigmaAnexoLLinha(sigmaRef_m, sigmaB, Va, VT) : sigmaAnexoLCircuito(sigmaRef_m, Va, VT));

  // Distribuição
  fech.C_m = distribuicao === 'estacao' ? correcaoPorEstacaoC(erro_m, n, { arredondarC }) : NaN;
  const corrigir = (l, N) => (distribuicao === 'estacao'
    ? correcaoPorEstacao(erro_m, n, N, { arredondarC })
    : correcaoProporcional(erro_m, l.distAcum, extensao_m));

  fech.pontos = [];
  for (const l of cad.linhas) {
    if (!l.tipo || l.erros.length || !Number.isFinite(l.H)) continue;
    const j = l.nEstacao - 1;
    if (l.tipo === 're' && j > 0) continue; // é a vante da estação anterior
    const e = ests[j];
    let N, Va;
    if (l.tipo === 're') { N = 0; Va = 0; }
    else if (l.tipo === 'vante') { N = j + 1; Va = { L: cumL?.[j], K: cumK?.[j] }; }
    else { N = j + 1; Va = { L: j > 0 ? cumL?.[j - 1] : 0, K: j > 0 ? cumK?.[j - 1] : 0 }; }

    const correcao = l.tipo === 're' ? 0 : corrigir(l, N);
    let sigma = NaN, sigmaAL = NaN, sigmaKm = NaN;
    if (l.tipo === 're') {
      sigma = sigmaAL = sigmaKm = sigmaRef_m;
    } else if (l.tipo === 'vante') {
      if (cumL) { sigma = sigmaRig(Va.L, VT_L); sigmaAL = sigmaL_(Va.L, VT_L); }
      if (cumK) sigmaKm = sigmaRig(Va.K, VT_K);
    } else if (Number.isFinite(l.dh)) {
      // (d) intermediária: σ do ponto de ré da estação + a própria irradiação
      if (cumL) {
        const base = sigmaRig(Va.L, VT_L), baseAL = sigmaL_(Va.L, VT_L);
        const extra = (sigmaL * e.dhRe) ** 2 + (sigmaL * l.dh) ** 2;
        sigma = Math.sqrt(base ** 2 + extra);
        sigmaAL = Math.sqrt(baseAL ** 2 + extra);
      }
      if (cumK) sigmaKm = Math.sqrt(sigmaRig(Va.K, VT_K) ** 2 + sigmaKm_m ** 2 * ((e.dhRe + l.dh) / 1000));
    }
    if (!Number.isFinite(correcao) && l.tipo !== 're') {
      alertas.push(`Linha ${l.linha} (ponto ${l.ponto}): sem DH a correção proporcional à distância não pode ser calculada. Digite a DH ou use a distribuição por estação.`);
    }
    fech.pontos.push({
      linha: l.linha, ponto: l.ponto, estacao: l.estacao, nEstacao: l.nEstacao, tipo: l.tipo, N,
      H: l.H, correcao, Hcorr: l.H + correcao, sigma, sigmaAnexoL: sigmaAL, sigmaKm, distAcum: l.distAcum,
    });
  }

  // Transporte: média de nivelamento e contranivelamento (AA Eq. 17–19; doc 4, 4.3.6 c)
  if (metodo === 'transporte') {
    const rn2 = ests[jChegada];
    const dhIda = rn2.Hvante - Hconhecida;
    const dhVolta = Hfecho - rn2.Hvante;
    const dhMedio = (dhIda - dhVolta) / 2;
    fech.transporte = {
      ponto: rn2.vantePonto, dhIda, dhVolta, dhMedio, H: Hconhecida + dhMedio,
      sigma: cumL ? sigmaTransporte(sigmaRef_m, cumL[jChegada], VT_L - cumL[jChegada]) : NaN,
      sigmaKm: cumK ? sigmaTransporte(sigmaRef_m, cumK[jChegada], VT_K - cumK[jChegada]) : NaN,
    };
  }

  return fim();
}

export function nomeMetodo(metodo) {
  return { irradiacao: 'irradiação', transporte: 'transporte de RN', circuito: 'circuito fechado', linha: 'linha entre duas RN' }[metodo] || metodo;
}
