// geometrico.js — caderneta de nivelamento geométrico: APV, alturas, distâncias,
// verificação aritmética, alertas de campo e desvio-padrão por ponto.
// Funções puras, sem DOM. Unidades: metros.
// Ver docs/02_METODOS_E_FORMULAS.md (2.2.1–2.2.4, 2.2.9, 2.2.11) e
// docs/04_PROPAGACAO_PRECISOES.md (4.3.1, 4.3.2, 4.3.6 d).
//
// O fechamento, a tolerância e a distribuição do erro (transporte, circuito, linha)
// entram na etapa 4 e usam o resultado desta função.

import { parseDecimal, formatar } from './numeros.js';

/** Discrepância máxima aceita na verificação aritmética (doc 2, 2.2.3). */
export const TOL_VERIFICACAO_M = 0.0005;

const vazio = (v) => v === null || v === undefined || String(v).trim() === '';

/** Lê um campo numérico opcional: { valor, presente, invalido }. */
function lerCampo(v) {
  if (vazio(v)) return { valor: NaN, presente: false, invalido: false };
  const n = parseDecimal(v);
  return { valor: n, presente: true, invalido: Number.isNaN(n) };
}

const m = (v, casas = 3) => `${formatar(v, casas)} m`;

/**
 * σ de uma vante (mudança ou ponto final) — NBR 13133:2021, Anexo F.1:
 *   σV² = σR² + 2 (σL · DHm)²,  DHm = (DHré + DHvante) / 2
 */
export function sigmaVanteF1(sigmaRe, sigmaL, dhRe, dhVante) {
  const dhm = (dhRe + dhVante) / 2;
  return Math.sqrt(sigmaRe ** 2 + 2 * (sigmaL * dhm) ** 2);
}

/**
 * σ de um ponto irradiado — F.1 sem simplificação (doc 4, 4.3.1 e 4.3.6 d; D27):
 *   σI² = σR² + (σL · DHré)² + (σL · DHI)²
 */
export function sigmaIrradiado(sigmaRe, sigmaL, dhRe, dhPonto) {
  return Math.sqrt(sigmaRe ** 2 + (sigmaL * dhRe) ** 2 + (sigmaL * dhPonto) ** 2);
}

/**
 * σ pela precisão do nível por km de duplo nivelamento (referência, D25):
 *   σ² = σR² + σkm² · K,  K = (DHré + DHponto) / 1000
 */
export function sigmaPorKm(sigmaRe, sigmaKm, dhRe, dhPonto) {
  return Math.sqrt(sigmaRe ** 2 + sigmaKm ** 2 * ((dhRe + dhPonto) / 1000));
}

/** σL (m/m) a partir da ficha do nível: σ da leitura (mm) a uma distância de referência (m). */
export const sigmaLeituraPorMetro = (sigmaLeitura_mm, distanciaRef_m) => sigmaLeitura_mm / 1000 / distanciaRef_m;

/**
 * Calcula a caderneta.
 *
 * @param {Array<object>} linhas  [{ estacao, ponto, re, vante, irradiado, fs, fi, dh, obs }]
 *   Valores podem ser texto (vírgula ou ponto) ou número. Uma linha com leitura de ré abre
 *   uma nova estação. Cada estação tem uma ré, uma vante (mudança ou final) opcional e
 *   quantos pontos irradiados forem necessários.
 * @param {object} op
 *   H_ref, sigmaRef_m, pontoRef — altura conhecida do ponto de ré da primeira estação;
 *   sigmaL — σ da leitura por metro de visada (m/m), NBR F.1;
 *   sigmaKm_m — σ por km de duplo nivelamento (m/√km), opcional, só como referência;
 *   C (100), tol3fios_m, difReVanteMax_m, visadaMax_m, alturaMin_m — limites dos alertas;
 *   nomeAltura — 'cota' ou 'altitude', usado nas mensagens.
 */
export function calcularCaderneta(linhas, op = {}) {
  const {
    H_ref, sigmaRef_m = 0, pontoRef = '', sigmaL = null, sigmaKm_m = null,
    C = 100, tol3fios_m = 0.002, difReVanteMax_m = 10, visadaMax_m = 80, alturaMin_m = 0.30,
    nomeAltura = 'cota', // 'cota' ou 'altitude' — só para as mensagens
  } = op;

  const erros = [];
  const alertas = [];
  const saida = [];
  const estacoes = [];
  const conhecidos = new Map(); // ponto → { H, sigma, sigmaKm, acum }

  const Href = lerCampo(H_ref);
  if (!Href.presente) erros.push(`Informe a ${nomeAltura} do ponto de referência.`);
  else if (Href.invalido) erros.push(`A ${nomeAltura} do ponto de referência "${H_ref}" não é um número.`);
  const temRef = Href.presente && !Href.invalido;
  if (temRef && pontoRef) conhecidos.set(String(pontoRef).trim(), { H: Href.valor, sigma: sigmaRef_m, sigmaKm: sigmaRef_m, acum: 0 });

  let estAtual = null;
  let rotuloAnterior = '';

  linhas.forEach((bruta, i) => {
    const campos = ['re', 'vante', 'irradiado', 'fs', 'fi', 'dh'];
    const ponto = vazio(bruta.ponto) ? '' : String(bruta.ponto).trim();
    const rotuloDigitado = vazio(bruta.estacao) ? '' : String(bruta.estacao).trim();
    const todosVazios = !ponto && !rotuloDigitado && campos.every((c) => vazio(bruta[c])) && vazio(bruta.obs);
    if (todosVazios) return;

    const L = {
      indice: i, linha: i + 1, ponto, obs: vazio(bruta.obs) ? '' : String(bruta.obs).trim(),
      tipo: null, leitura: NaN, dh: NaN, dhOrigem: null, dhEstadimetria: NaN, fmCalc: NaN, dif3fios: NaN,
      apv: NaN, H: NaN, sigma: NaN, sigmaKm: NaN, sigmaForma: null, distAcum: NaN, difReVante: NaN,
      estacao: null, nEstacao: null, erros: [], alertas: [],
    };
    const c = Object.fromEntries(campos.map((k) => [k, lerCampo(bruta[k])]));
    const nome = () => `Linha ${L.linha}${L.estacao ? ` (estação ${L.estacao}${ponto ? `, ponto ${ponto}` : ''})` : (ponto ? ` (ponto ${ponto})` : '')}`;
    const erro = (msg) => { L.erros.push(msg); erros.push(`${nome()}: ${msg}`); };
    const alerta = (msg) => { L.alertas.push(msg); alertas.push(`${nome()}: ${msg}`); };

    // Tipo da linha pela coluna preenchida
    const leituras = ['re', 'vante', 'irradiado'].filter((k) => c[k].presente);
    if (leituras.length > 1) {
      L.tipo = leituras[0];
    } else if (leituras.length === 1) {
      L.tipo = leituras[0];
    }

    // Estação
    if (L.tipo === 're') {
      const rot = rotuloDigitado || String(estacoes.length + 1);
      estAtual = {
        n: estacoes.length + 1, rotulo: rot, rePonto: ponto, linhaRe: L.linha,
        Hre: NaN, sigmaRe: NaN, sigmaKmRe: NaN, acumRe: NaN, apv: NaN, re: NaN,
        dhRe: NaN, dhVante: NaN, difReVante: NaN, lance: NaN, vantePonto: null, vante: NaN, Hvante: NaN,
        encadeada: false, irradiados: 0,
      };
      estacoes.push(estAtual);
      rotuloAnterior = rot;
    } else if (rotuloDigitado && estAtual && rotuloDigitado !== rotuloAnterior) {
      // Mudou o rótulo sem leitura de ré
      L.estacao = rotuloDigitado;
      erro(`a estação ${rotuloDigitado} começa sem leitura de ré.`);
      saida.push(L);
      return;
    }
    if (estAtual) { L.estacao = estAtual.rotulo; L.nEstacao = estAtual.n; }

    if (!estAtual) {
      erro(`a caderneta deve começar com uma leitura de ré no ponto de ${nomeAltura} conhecida.`);
      saida.push(L);
      return;
    }
    if (leituras.length > 1) {
      erro('preencha só uma leitura por linha (ré, vante ou irradiado).');
      saida.push(L);
      return;
    }
    if (leituras.length === 0) {
      erro('a leitura na mira está vazia (ré, vante ou irradiado).');
      saida.push(L);
      return;
    }

    const nomesColuna = { re: 'ré', vante: 'vante', irradiado: 'irradiado' };
    const cl = c[L.tipo];
    if (cl.invalido) { erro(`a leitura de ${nomesColuna[L.tipo]} "${bruta[L.tipo]}" não é um número.`); saida.push(L); return; }
    L.leitura = cl.valor;
    if (!ponto) erro(`falta o nome do ponto visado (leitura de ${nomesColuna[L.tipo]}).`);

    // Três fios e distância
    for (const k of ['fs', 'fi', 'dh']) {
      if (c[k].invalido) erro(`o valor de ${k.toUpperCase()} "${bruta[k]}" não é um número.`);
    }
    const temFs = c.fs.presente && !c.fs.invalido;
    const temFi = c.fi.presente && !c.fi.invalido;
    if (temFs !== temFi && !c.fs.invalido && !c.fi.invalido) alerta(`falta o fio ${temFs ? 'inferior (FI)' : 'superior (FS)'} — sem os três fios não há conferência nem estadimetria.`);
    if (temFs && temFi) {
      L.fmCalc = (c.fs.valor + c.fi.valor) / 2;
      L.dif3fios = L.leitura - L.fmCalc;
      L.dhEstadimetria = C * Math.abs(c.fs.valor - c.fi.valor);
      if (Math.abs(L.dif3fios) > tol3fios_m) {
        alerta(`fio médio ${m(L.leitura)} difere de (FS + FI)/2 = ${m(L.fmCalc)} em ${formatar(L.dif3fios * 1000, 1)} mm (limite ${formatar(tol3fios_m * 1000, 1)} mm). Confira a leitura dos três fios.`);
      }
    }
    if (c.dh.presente && !c.dh.invalido) {
      L.dh = c.dh.valor; L.dhOrigem = 'digitada';
      if (L.dh < 0) erro('a distância horizontal não pode ser negativa.');
    } else if (Number.isFinite(L.dhEstadimetria)) {
      L.dh = L.dhEstadimetria; L.dhOrigem = 'estadimetria';
    }
    if (Number.isFinite(L.dh) && L.dh > visadaMax_m) {
      alerta(`visada de ${formatar(L.dh, 1)} m maior que ${formatar(visadaMax_m, 0)} m (NBR 13133:2021, Tabela 5).`);
    }
    if (L.leitura < alturaMin_m) {
      alerta(`leitura de ${m(L.leitura)} abaixo de ${formatar(alturaMin_m, 2)} m (NBR 13133:2021, 5.5.2.8: visada a pelo menos 30 cm de qualquer superfície).`);
    }

    // ---------- Cálculo ----------
    const est = estAtual;
    if (L.tipo === 're') {
      est.re = L.leitura;
      est.dhRe = L.dh;
      let base = null;
      if (est.n === 1) {
        if (temRef) base = { H: Href.valor, sigma: sigmaRef_m, sigmaKm: sigmaRef_m, acum: 0 };
        if (temRef && pontoRef && ponto && ponto !== String(pontoRef).trim()) {
          alerta(`a ré da primeira estação foi lida em "${ponto}", mas o ponto de referência informado é "${pontoRef}". Usada a ${nomeAltura} do ponto de referência.`);
        }
      } else {
        const ant = estacoes[est.n - 2];
        const vanteAnt = ant.vantePonto !== null ? conhecidos.get(ant.vantePonto) : null;
        if (vanteAnt && Number.isFinite(ant.Hvante) && (!ponto || ponto === ant.vantePonto)) {
          base = { H: ant.Hvante, sigma: ant.sigmaVante, sigmaKm: ant.sigmaKmVante, acum: ant.acumVante };
          est.encadeada = true;
        } else if (ponto && conhecidos.has(ponto)) {
          base = conhecidos.get(ponto);
        } else if (ant.vantePonto !== null && Number.isFinite(ant.Hvante)) {
          // Rótulo diferente: segue a ordem ré → vante (doc 7, errata E3)
          base = { H: ant.Hvante, sigma: ant.sigmaVante, sigmaKm: ant.sigmaKmVante, acum: ant.acumVante };
          est.encadeada = true;
          alerta(`o ponto de ré "${ponto}" não é a vante da estação anterior ("${ant.vantePonto}"). Usada a vante anterior, pela ordem da caderneta.`);
        } else if (ant.vantePonto === null) {
          erro(`o ponto de ré "${ponto}" não tem ${nomeAltura} conhecida: a estação ${ant.rotulo} não tem vante de mudança.`);
        }
      }
      if (base) {
        est.Hre = base.H; est.sigmaRe = base.sigma; est.sigmaKmRe = base.sigmaKm; est.acumRe = base.acum;
        est.apv = base.H + L.leitura;
        L.H = base.H; L.apv = est.apv; L.sigma = base.sigma; L.sigmaKm = base.sigmaKm; L.distAcum = base.acum;
        L.sigmaForma = est.n === 1 ? 'referência' : 'herdado';
        if (ponto && !conhecidos.has(ponto)) conhecidos.set(ponto, base);
      }
      saida.push(L);
      return;
    }

    // Vante ou irradiado
    if (L.tipo === 'vante' && est.vantePonto !== null) {
      erro(`a estação ${est.rotulo} já tem uma vante (${est.vantePonto}). Use o status "Irad." para pontos irradiados ou abra nova estação com uma leitura de ré.`);
      saida.push(L);
      return;
    }
    if (Number.isFinite(est.apv)) {
      L.apv = est.apv;
      L.H = est.apv - L.leitura;
    }
    const temDh = Number.isFinite(est.dhRe) && Number.isFinite(L.dh);
    if (Number.isFinite(L.H)) {
      if (temDh && sigmaL !== null && Number.isFinite(est.sigmaRe)) {
        if (L.tipo === 'vante') { L.sigma = sigmaVanteF1(est.sigmaRe, sigmaL, est.dhRe, L.dh); L.sigmaForma = 'F.1'; }
        else { L.sigma = sigmaIrradiado(est.sigmaRe, sigmaL, est.dhRe, L.dh); L.sigmaForma = 'F.1 sem simplificação'; }
      }
      if (temDh && sigmaKm_m !== null && Number.isFinite(est.sigmaKmRe)) {
        L.sigmaKm = sigmaPorKm(est.sigmaKmRe, sigmaKm_m, est.dhRe, L.dh);
      }
      if (temDh && Number.isFinite(est.acumRe)) L.distAcum = est.acumRe + est.dhRe + L.dh;
      if (!temDh) alerta(`sem a distância horizontal ${Number.isFinite(est.dhRe) ? 'deste ponto' : 'da ré desta estação'} não é possível calcular o desvio-padrão. Digite DH ou os três fios.`);
    }

    if (L.tipo === 'vante') {
      est.vantePonto = ponto;
      est.vante = L.leitura;
      est.dhVante = L.dh;
      est.Hvante = L.H;
      est.sigmaVante = L.sigma;
      est.sigmaKmVante = L.sigmaKm;
      est.acumVante = L.distAcum;
      if (temDh) {
        est.difReVante = est.dhRe - L.dh;
        est.lance = est.dhRe + L.dh;
        L.difReVante = est.difReVante;
        if (Math.abs(est.difReVante) > difReVanteMax_m) {
          alerta(`diferença ré − vante de ${formatar(est.difReVante, 1)} m (limite do programa ${formatar(difReVanteMax_m, 0)} m; a NBR 13133:2021, 5.5.2.3, pede visadas equidistantes).`);
        }
      }
    } else {
      est.irradiados += 1;
    }
    if (ponto && Number.isFinite(L.H)) conhecidos.set(ponto, { H: L.H, sigma: L.sigma, sigmaKm: L.sigmaKm, acum: L.distAcum });
    saida.push(L);
  });

  // ---------- Resumo ----------
  const comVante = estacoes.filter((e) => e.vantePonto !== null);
  const extensao_m = comVante.every((e) => Number.isFinite(e.lance)) ? comVante.reduce((a, e) => a + e.lance, 0) : NaN;
  const temIrradiados = estacoes.some((e) => e.irradiados > 0);

  if (comVante.length >= 2 && comVante.length % 2 === 1) {
    alertas.push(`Número de lances ímpar (${comVante.length}). A NBR 13133:2021, 5.5.2.3, recomenda número par de lances (mesma mira na partida e na chegada).`);
  }
  if (temIrradiados) {
    alertas.push(`Pontos irradiados não têm verificação de fechamento. Recomenda-se visar também um ponto de ${nomeAltura} conhecida como controle.`);
  }

  // Verificação aritmética: Σ ré − Σ vante = H final − H inicial (doc 2, 2.2.3)
  const ultima = estacoes[estacoes.length - 1];
  let verificacao = { aplicavel: false, motivo: '' };
  if (!estacoes.length) verificacao.motivo = 'caderneta vazia.';
  else if (!ultima || ultima.vantePonto === null) verificacao.motivo = 'a última estação não tem vante (mudança ou ponto final).';
  else if (estacoes.slice(1).some((e) => !e.encadeada)) verificacao.motivo = 'há estação cuja ré não é a vante da estação anterior.';
  else if (estacoes.some((e) => !Number.isFinite(e.re) || (e !== ultima && !Number.isFinite(e.vante)) || !Number.isFinite(e.apv))) verificacao.motivo = 'há leituras com erro.';
  else {
    const somaRe = estacoes.reduce((a, e) => a + e.re, 0);
    const somaVante = comVante.reduce((a, e) => a + e.vante, 0);
    const Hini = estacoes[0].Hre;
    const Hfim = ultima.Hvante;
    const discrepancia = (somaRe - somaVante) - (Hfim - Hini);
    verificacao = {
      aplicavel: true, somaRe, somaVante, diferencaLeituras: somaRe - somaVante,
      Hinicial: Hini, Hfinal: Hfim, diferencaH: Hfim - Hini, discrepancia,
      confere: Math.abs(discrepancia) <= TOL_VERIFICACAO_M,
    };
  }

  const pontos = saida
    .filter((l) => l.tipo && l.erros.length === 0 && Number.isFinite(l.H) && l.ponto)
    .map((l) => ({ ponto: l.ponto, tipo: l.tipo, estacao: l.estacao, H: l.H, sigma: l.sigma, sigmaKm: l.sigmaKm, distAcum: l.distAcum }));

  return {
    linhas: saida, estacoes, pontos, verificacao,
    extensao_m, K_km: extensao_m / 1000,
    erros, alertas, valido: erros.length === 0,
  };
}
