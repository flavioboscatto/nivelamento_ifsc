// trigonometrico.js — nivelamento trigonométrico: irradiação, poligonal altimétrica e visadas recíprocas.
// Funções puras, sem DOM. Unidades internas: metros e radianos.
// Ver docs/02_METODOS_E_FORMULAS.md (2.3) e docs/04_PROPAGACAO_PRECISOES.md (4.2.1, 4.4).

import { parseDecimal, formatar } from './numeros.js';
import { lerAnguloSexagesimal as parseAngulo, zenitalPdPi, RAD_POR_SEGUNDO, formatarDms, AJUDA_ANGULO } from './angulos.js';
import { avaliarFechamento } from './tolerancias.js';
import { correcaoProporcional } from './ajustamento.js';
import { sigmaCircuito, sigmaLinha, sigmaAnexoLCircuito, sigmaAnexoLLinha } from './propagacao.js';

/** Curvatura e refração: c+r = (1 − k) · DH² / (2R)  (doc 2, 2.3.2). */
export const curvaturaRefracao = (DH, R, k) => (1 - k) * DH ** 2 / (2 * R);

/** Precisão de distância medida com MED — NBR Anexo C: e = √(a² + (b·D)²); a em mm, b em ppm, D em m → m. */
export const sigmaDistanciaAnexoC = (a_mm, b_ppm, D_m) => Math.sqrt(a_mm ** 2 + (b_ppm * D_m / 1000) ** 2) / 1000;

/** Redução da visada: com Di → DH = Di·sen Z, DV = Di·cos Z; com DH → DV = DH·cot Z. */
export function reduzirVisada({ Z, Di = NaN, DH = NaN }) {
  if (Number.isFinite(Di)) return { DH: Di * Math.sin(Z), DV: Di * Math.cos(Z), origem: 'Di' };
  return { DH, DV: DH * Math.cos(Z) / Math.sin(Z), origem: 'DH' };
}

/**
 * Variância de DV + c+r − s (doc 4, 4.4.2), sem o termo de refração:
 *  com Di: cos²Z·σDi² + (Di·sen Z)²·σZ² + σs²
 *  com DH: cot²Z·σDH² + (DH / sen²Z)²·σZ² + σs²
 */
export function varianciaVisada({ Z, Di = NaN, DH = NaN, sigmaD, sigmaZ, sigmaS }) {
  const s2 = Math.sin(Z) ** 2;
  if (Number.isFinite(Di)) return Math.cos(Z) ** 2 * sigmaD ** 2 + (Di * Math.sin(Z)) ** 2 * sigmaZ ** 2 + sigmaS ** 2;
  return (Math.cos(Z) ** 2 / s2) * sigmaD ** 2 + (DH / s2) ** 2 * sigmaZ ** 2 + sigmaS ** 2;
}

/**
 * NBR 13133:2021, F.3 (estação sobre ponto conhecido, visada com Di):
 *  σHV = √(σHI² + σi² + σs² + cos²Z·σDi² + (Di·sen Z)²·σZ²)   — com σi = σs = 2 mm, σi² + σs² = 0,000008
 */
export function sigmaF3({ sigmaHI, Z, Di, sigmaDi, sigmaZ_s, sigmaI = 0.002, sigmaS = 0.002 }) {
  const sZ = sigmaZ_s * RAD_POR_SEGUNDO;
  return Math.sqrt(sigmaHI ** 2 + sigmaI ** 2 + sigmaS ** 2 + Math.cos(Z) ** 2 * sigmaDi ** 2 + (Di * Math.sin(Z)) ** 2 * sZ ** 2);
}

const vazio = (v) => v === null || v === undefined || String(v).trim() === '';

/**
 * Caderneta do nivelamento trigonométrico.
 *
 * Linhas: { estacao, i, ponto, status ('re' | 'vante' | 'irradiado'; vazio = irradiado), zpd, zpi, di, dh, s, obs }
 * Uma linha com "estacao" preenchida (diferente da atual) abre nova estação.
 * Altura do eixo do instrumento A:
 *  - com ré: A = H(ré) − (DV + c+r − s) da ré (estação livre ou sobre ponto);
 *  - sem ré: a estação ocupa um ponto conhecido e A = H(estação) + i.
 * Cada ponto visado: H = A + DV + c+r − s.
 *
 * @param {object} op
 *   H_ref, sigmaRef_m, pontoRef; R (6 371 000), k (0,13);
 *   aplicarCR: 'auto' (DH > limiarCR_m) | 'sempre' | 'nunca'; limiarCR_m (125);
 *   sigmaZ_s; distA_mm, distB_ppm (Anexo C); sigmaI_m, sigmaS_m (2 mm);
 *   visadaMax_m; nomeAltura ('cota' | 'altitude');
 *   metodo: 'irradiacao' | 'poligonal'; pontoChegada, H_chegada, sigmaChegada_m; classes, classeId.
 */
export function calcularTrigonometrico(linhas, op = {}) {
  const {
    H_ref, sigmaRef_m = 0, pontoRef = '', R = 6371000, k = 0.13, aplicarCR = 'auto', limiarCR_m = 125,
    sigmaZ_s = 5, distA_mm = 2, distB_ppm = 2, sigmaI_m = 0.002, sigmaS_m = 0.002, visadaMax_m = 300,
    nomeAltura = 'cota', metodo = 'irradiacao',
  } = op;
  const sigmaZ = sigmaZ_s * RAD_POR_SEGUNDO;
  const erros = [], alertas = [], saida = [], estacoes = [];
  const conhecidos = new Map();

  const Href = parseDecimal(H_ref);
  if (vazio(H_ref)) erros.push(`Informe a ${nomeAltura} do ponto de referência.`);
  else if (!Number.isFinite(Href)) erros.push(`A ${nomeAltura} do ponto de referência "${H_ref}" não é um número.`);
  const ref = String(pontoRef || '').trim();
  if (Number.isFinite(Href)) conhecidos.set(ref || '(referência)', { H: Href, sigma: sigmaRef_m, acum: 0 });

  // 1) Leitura das linhas e agrupamento por estação
  let est = null;
  linhas.forEach((b, idx) => {
    const campos = ['estacao', 'i', 'ponto', 'zpd', 'zpi', 'di', 'dh', 's', 'obs'];
    if (campos.every((c) => vazio(b[c]))) return;
    const rotEst = vazio(b.estacao) ? '' : String(b.estacao).trim();
    if (rotEst && (!est || rotEst !== est.rotulo)) {
      est = { n: estacoes.length + 1, rotulo: rotEst, i: NaN, linhas: [], A: NaN, sigmaA: NaN, acumA: NaN, re: null, vante: null, encadeada: false, V: NaN };
      estacoes.push(est);
    }
    const L = {
      indice: idx, linha: idx + 1, ponto: vazio(b.ponto) ? '' : String(b.ponto).trim(),
      status: ['re', 'vante', 'irradiado'].includes(b.status) ? b.status : 'irradiado',
      Z: NaN, erroIndice: NaN, Di: NaN, DH: NaN, DV: NaN, cr: NaN, crAplicada: false, s: 0, dz: NaN, varDz: NaN,
      H: NaN, desnivel: NaN, sigma: NaN, distAcum: NaN, estacao: est?.rotulo ?? null, nEstacao: est?.n ?? null, erros: [], alertas: [],
    };
    const nome = () => `Linha ${L.linha}${L.estacao ? ` (estação ${L.estacao}${L.ponto ? `, ponto ${L.ponto}` : ''})` : ''}`;
    L.erro = (m) => { L.erros.push(m); erros.push(`${nome()}: ${m}`); };
    L.alerta = (m) => { L.alertas.push(m); alertas.push(`${nome()}: ${m}`); };
    saida.push(L);
    if (!est) { L.erro('a primeira linha precisa indicar a estação.'); return; }
    if (!vazio(b.i)) {
      const iv = parseDecimal(b.i);
      if (!Number.isFinite(iv)) L.erro(`a altura do instrumento "${b.i}" não é um número.`); else est.i = iv;
    }
    if (vazio(b.ponto) && vazio(b.zpd) && vazio(b.di) && vazio(b.dh)) { L.vazia = true; return; } // linha só com a estação
    if (!L.ponto) L.erro('falta o nome do ponto visado.');

    const zpd = parseAngulo(b.zpd);
    if (vazio(b.zpd)) { L.erro('falta o ângulo zenital.'); return; }
    if (!Number.isFinite(zpd)) { L.erro(`o ângulo zenital "${b.zpd}" não é válido (${AJUDA_ANGULO}).`); return; }
    L.Z = zpd;
    if (!vazio(b.zpi)) {
      const zpi = parseAngulo(b.zpi);
      if (!Number.isFinite(zpi)) { L.erro(`o ângulo zenital em PI "${b.zpi}" não é válido (${AJUDA_ANGULO}).`); return; }
      const r = zenitalPdPi(zpd, zpi);
      L.Z = r.z; L.erroIndice = r.erroIndice;
    }
    if (!(L.Z > 0 && L.Z < Math.PI)) { L.erro('o ângulo zenital deve ficar entre 0° e 180°.'); return; }

    const di = parseDecimal(b.di), dh = parseDecimal(b.dh);
    if (!vazio(b.di) && !Number.isFinite(di)) { L.erro(`a distância inclinada "${b.di}" não é um número.`); return; }
    if (!vazio(b.dh) && !Number.isFinite(dh)) { L.erro(`a distância horizontal "${b.dh}" não é um número.`); return; }
    if (!Number.isFinite(di) && !Number.isFinite(dh)) { L.erro('falta a distância (inclinada Di ou horizontal DH).'); return; }
    const red = reduzirVisada({ Z: L.Z, Di: di, DH: dh });
    L.Di = Number.isFinite(di) ? di : NaN;
    L.DH = red.DH; L.DV = red.DV;
    if (!vazio(b.s)) {
      const s = parseDecimal(b.s);
      if (!Number.isFinite(s)) { L.erro(`a altura do sinal "${b.s}" não é um número.`); return; }
      L.s = s;
    }
    L.cr = curvaturaRefracao(L.DH, R, k);
    L.crAplicada = aplicarCR === 'sempre' || (aplicarCR === 'auto' && L.DH > limiarCR_m);
    L.dz = L.DV + (L.crAplicada ? L.cr : 0) - L.s;
    const sigmaD = sigmaDistanciaAnexoC(distA_mm, distB_ppm, Number.isFinite(di) ? di : L.DH);
    L.varDz = varianciaVisada({ Z: L.Z, Di: L.Di, DH: L.DH, sigmaD, sigmaZ, sigmaS: sigmaS_m });

    if (L.DH > visadaMax_m) L.alerta(`visada de ${formatar(L.DH, 1)} m maior que ${formatar(visadaMax_m, 0)} m (NBR 13133:2021, Tabela 6).`);
    if (L.DH > limiarCR_m) L.alerta(`visada acima de ${formatar(limiarCR_m, 0)} m: a NBR 13133:2021 (5.5.3.1) pede curvatura e refração e visadas recíprocas e simultâneas.`);
    if (L.status === 're') {
      if (est.re) L.erro(`a estação ${est.rotulo} já tem ré (${est.re.ponto}).`); else est.re = L;
    } else if (L.status === 'vante') {
      if (est.vante) L.erro(`a estação ${est.rotulo} já tem vante (${est.vante.ponto}). Use "Irad." para os demais pontos.`); else est.vante = L;
    }
    est.linhas.push(L);
  });

  // 2) Cálculo estação a estação
  estacoes.forEach((e, j) => {
    const ant = estacoes[j - 1];
    if (e.re) {
      let base = null;
      if (ant?.vante && Number.isFinite(ant.vante.H) && e.re.ponto === ant.vante.ponto) { base = { H: ant.vante.H, sigma: ant.vante.sigma, acum: ant.vante.distAcum }; e.encadeada = true; }
      else if (conhecidos.has(e.re.ponto)) base = conhecidos.get(e.re.ponto);
      else if (j === 0 && Number.isFinite(Href)) { base = { H: Href, sigma: sigmaRef_m, acum: 0 }; if (ref && e.re.ponto !== ref) e.re.alerta(`a ré foi lida em "${e.re.ponto}", mas o ponto de referência é "${ref}". Usada a ${nomeAltura} da referência.`); }
      if (!base) { e.re.erro(`o ponto de ré "${e.re.ponto}" não tem ${nomeAltura} conhecida.`); return; }
      e.A = base.H - e.re.dz;
      e.Hbase = base.H;
      e.sigmaA = Math.sqrt(base.sigma ** 2 + e.re.varDz);
      e.acumA = base.acum;
      e.re.H = base.H; e.re.sigma = base.sigma; e.re.distAcum = base.acum;
      e.distRe = e.re.DH;
    } else {
      let base = null;
      if (ant?.vante && Number.isFinite(ant.vante.H) && e.rotulo === ant.vante.ponto) { base = { H: ant.vante.H, sigma: ant.vante.sigma, acum: ant.vante.distAcum }; e.encadeada = true; }
      else if (conhecidos.has(e.rotulo)) base = conhecidos.get(e.rotulo);
      else if (j === 0 && Number.isFinite(Href) && !ref) base = conhecidos.get('(referência)'); // sem nome: estação sobre a referência
      if (!base) { erros.push(`Estação ${e.rotulo}: sem ré e sem ${nomeAltura} conhecida. Faça uma visada de ré ou ocupe um ponto conhecido.`); return; }
      if (!Number.isFinite(e.i)) { erros.push(`Estação ${e.rotulo}: informe a altura do instrumento (i) ou faça uma visada de ré.`); return; }
      e.A = base.H + e.i;
      e.Hbase = base.H;
      e.sigmaA = Math.sqrt(base.sigma ** 2 + sigmaI_m ** 2);
      e.acumA = base.acum;
      e.distRe = 0;
      e.sobrePonto = true;
    }
    for (const L of e.linhas) {
      if (L === e.re || L.erros.length) continue;
      L.H = e.A + L.dz;
      L.desnivel = L.H - e.Hbase; // desnível em relação à ré (estação livre) ou ao ponto ocupado
      L.sigma = Math.sqrt(e.sigmaA ** 2 + L.varDz);
      L.distAcum = e.acumA + e.distRe + L.DH;
      if (L.ponto) conhecidos.set(L.ponto, { H: L.H, sigma: L.sigma, acum: L.distAcum });
    }
    if (e.vante) {
      e.lance = e.distRe + e.vante.DH;
      e.V = (e.re ? e.re.varDz : sigmaI_m ** 2) + e.vante.varDz;
    }
  });

  const pontos = saida.filter((l) => l.erros.length === 0 && !l.vazia && Number.isFinite(l.H) && l.ponto && l.status !== 're')
    .map((l) => ({ linha: l.linha, ponto: l.ponto, tipo: l.status, estacao: l.estacao, nEstacao: l.nEstacao, desnivel: l.desnivel, H: l.H, sigma: l.sigma, distAcum: l.distAcum, DH: l.DH }));

  const r = { linhas: saida, estacoes, pontos, erros, alertas, metodo, fechamento: null };
  if (metodo === 'poligonal') r.fechamento = fecharPoligonal(r, { ...op, Href, ref });
  r.valido = erros.length === 0;
  return r;
}

/** Fechamento da poligonal altimétrica (II N): erro, K = Σ DH, tolerância (Tabela 6), distribuição e σ. */
function fecharPoligonal(r, op) {
  const { pontoChegada = '', H_chegada, sigmaChegada_m = 0, sigmaRef_m = 0, classes = [], classeId = null, nomeAltura = 'cota', sigmaI_m = 0.002, Href, ref } = op;
  const { estacoes: ests, erros, alertas } = r;
  const f = { calculado: false };
  if (erros.length) { f.motivo = 'Corrija os erros da caderneta para calcular o fechamento.'; return f; }
  if (!ests.length) { f.motivo = 'Caderneta vazia.'; return f; }
  for (const [j, e] of ests.entries()) {
    if (!e.vante) erros.push(`Estação ${e.rotulo}: falta a visada de vante. Na poligonal todas as estações precisam de vante.`);
    if (j > 0 && !e.encadeada) erros.push(`Estação ${e.rotulo}: não começa na vante da estação anterior (ré nesse ponto ou estação sobre ele).`);
  }
  if (erros.length) { f.motivo = 'Corrija os erros da caderneta para calcular o fechamento.'; return f; }

  const ultima = ests.at(-1).vante;
  const linha = !!String(pontoChegada).trim() && String(pontoChegada).trim() !== ref;
  let Hconhecida = Href, sigmaB = 0;
  if (linha) {
    Hconhecida = parseDecimal(H_chegada);
    sigmaB = sigmaChegada_m || 0;
    if (!Number.isFinite(Hconhecida)) { erros.push(`Informe a ${nomeAltura} conhecida do ponto de chegada (${pontoChegada}).`); f.motivo = `Falta a ${nomeAltura} do ponto de chegada.`; return f; }
    if (ultima.ponto !== String(pontoChegada).trim()) alertas.push(`A poligonal termina em "${ultima.ponto}", mas o ponto de chegada informado é "${pontoChegada}".`);
  } else if (ref && ultima.ponto !== ref) {
    alertas.push(`Poligonal fechada: deveria terminar no ponto de partida (${ref}), mas a última vante é "${ultima.ponto}". Para terminar em outro ponto, informe o ponto de chegada.`);
  }

  const erro_m = ultima.H - Hconhecida;
  const extensao_m = ests.reduce((a, e) => a + e.lance, 0);
  const cum = []; ests.forEach((e) => cum.push((cum.at(-1) ?? 0) + e.V));
  const VT = cum.at(-1);
  const sig = (Va) => (linha ? sigmaLinha(sigmaRef_m, sigmaB, Va, VT) : sigmaCircuito(sigmaRef_m, Va, VT));
  const sigAL = (Va) => (linha ? sigmaAnexoLLinha(sigmaRef_m, sigmaB, Va, VT) : sigmaAnexoLCircuito(sigmaRef_m, Va, VT));

  Object.assign(f, {
    calculado: true, tipo: linha ? 'linha' : 'fechada', Hfecho: ultima.H, Hconhecida, erro_m, extensao_m, K_km: extensao_m / 1000,
    pontoFecho: ultima.ponto, sigmaEsperado_m: Math.sqrt(VT), razaoErroSigma: Math.abs(erro_m) / Math.sqrt(VT),
  });
  f.tolerancias = avaliarFechamento(erro_m, f.K_km, classes.filter((c) => c.tol_mm_raizK !== null));
  f.classe = f.tolerancias.find((t) => t.id === classeId) || null;

  f.pontos = [{ linha: null, ponto: ref || '(referência)', tipo: 're', estacao: ests[0].rotulo, H: Href, correcao: 0, Hcorr: Href, sigma: sigmaRef_m, sigmaAnexoL: sigmaRef_m, distAcum: 0 }];
  ests.forEach((e, j) => {
    for (const L of e.linhas) {
      if (L === e.re || !Number.isFinite(L.H)) continue;
      const Va = L === e.vante ? cum[j] : (j > 0 ? cum[j - 1] : 0);
      let sigma = sig(Va), sigmaAL = sigAL(Va);
      if (L !== e.vante) { // irradiado: σ do eixo (rigoroso) + a própria visada
        const extra = (e.re ? e.re.varDz : sigmaI_m ** 2) + L.varDz;
        sigma = Math.sqrt(sigma ** 2 + extra); sigmaAL = Math.sqrt(sigmaAL ** 2 + extra);
      }
      const correcao = correcaoProporcional(erro_m, L.distAcum, extensao_m);
      f.pontos.push({ linha: L.linha, ponto: L.ponto, tipo: L.status, estacao: e.rotulo, desnivel: L.desnivel, H: L.H, correcao, Hcorr: L.H + correcao, sigma, sigmaAnexoL: sigmaAL, distAcum: L.distAcum });
    }
  });
  return f;
}

/**
 * Visadas recíprocas (NBR 5.5.3.1; doc 2, 2.3.4): Δh calculados SEM c+r, que se cancela na média.
 *  Δh_AB = (Δh_A→B − Δh_B→A) / 2;  controle = Δh_A→B + Δh_B→A ≈ 2·c+r
 * @param {{Z, Di?, DH?, i, s}} ida  visada de A para B (s = sinal em B)
 * @param {{Z, Di?, DH?, i, s}} volta  visada de B para A
 */
export function visadasReciprocas(ida, volta, { R = 6371000, k = 0.13, sigmaZ_s = 5, distA_mm = 2, distB_ppm = 2, sigmaI_m = 0.002, sigmaS_m = 0.002 } = {}) {
  const lado = (v) => {
    const red = reduzirVisada(v);
    const sigmaD = sigmaDistanciaAnexoC(distA_mm, distB_ppm, Number.isFinite(v.Di) ? v.Di : red.DH);
    const varDh = varianciaVisada({ Z: v.Z, Di: v.Di, DH: red.DH, sigmaD, sigmaZ: sigmaZ_s * RAD_POR_SEGUNDO, sigmaS: sigmaS_m }) + sigmaI_m ** 2;
    return { ...red, dh: red.DV + v.i - v.s, varDh };
  };
  const a = lado(ida), b = lado(volta);
  const DHm = (a.DH + b.DH) / 2;
  return {
    dhIda: a.dh, dhVolta: b.dh, dh: (a.dh - b.dh) / 2, controle: a.dh + b.dh,
    crEsperada2: 2 * curvaturaRefracao(DHm, R, k), DH: DHm, DHida: a.DH, DHvolta: b.DH,
    sigma: Math.sqrt(a.varDh + b.varDh) / 2,
  };
}

export { formatarDms };

/**
 * Tabela didática de curvatura e refração (doc 2, 2.2.10 e 2.3.2):
 *  c = DH²/2R (curvatura); r = −k·DH²/2R (refração); c+r = (1 − k)·DH²/2R.
 */
export function tabelaCurvaturaRefracao(distancias, R, k) {
  return distancias.map((DH) => ({ DH, c: DH ** 2 / (2 * R), r: -k * DH ** 2 / (2 * R), cr: curvaturaRefracao(DH, R, k) }));
}

/** Efeito que sobra no geométrico com visadas desiguais: c+r(DH ré) − c+r(DH vante) (doc 2, 2.2.10). */
export const efeitoResidualGeometrico = (dhRe, dhVante, R, k) => curvaturaRefracao(dhRe, R, k) - curvaturaRefracao(dhVante, R, k);
