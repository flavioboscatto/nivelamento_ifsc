// taqueometria.js — estadimetria e nivelamento taqueométrico (classe III N).
// Funções puras, sem DOM. Unidades: metros e radianos.
// Ver docs/02_METODOS_E_FORMULAS.md (2.4) e docs/04_PROPAGACAO_PRECISOES.md (4.5).

import { parseDecimal, formatar } from './numeros.js';
import { parseAngulo, reduzir2Pi, RAD_POR_SEGUNDO } from './angulos.js';

/**
 * Estadimetria (AA Eq. 29–35): S = FS − FI;  DH = C·S·sen²Z;  DV = ½·C·S·sen 2Z
 */
export function estadimetria({ FS, FI, Z, C = 100 }) {
  const S = FS - FI;
  return { S, DH: C * S * Math.sin(Z) ** 2, DV: 0.5 * C * S * Math.sin(2 * Z) };
}

/**
 * Desvios-padrão da taqueometria (doc 4, 4.5):
 *  σS = √2·σleit
 *  σDH² = (C sen²Z)²·σS² + (C S sen 2Z)²·σZ²
 *  σDN² = (½ C sen 2Z)²·σS² + (C S cos 2Z)²·σZ² + σi² + σFM²   (σFM = σleit)
 */
export function sigmasTaqueometria({ S, Z, C = 100, sigmaLeit, sigmaZ, sigmaI }) {
  const sS = Math.SQRT2 * sigmaLeit;
  const sDH = Math.sqrt((C * Math.sin(Z) ** 2) ** 2 * sS ** 2 + (C * S * Math.sin(2 * Z)) ** 2 * sigmaZ ** 2);
  const sDN = Math.sqrt((0.5 * C * Math.sin(2 * Z)) ** 2 * sS ** 2 + (C * S * Math.cos(2 * Z)) ** 2 * sigmaZ ** 2 + sigmaI ** 2 + sigmaLeit ** 2);
  return { sigmaDH: sDH, sigmaDN: sDN };
}

const vazio = (v) => v === null || v === undefined || String(v).trim() === '';

/**
 * Caderneta taqueométrica.
 * Linhas: { estacao, i, azref, ponto, fs, fm, fi, z, hz, obs }
 * Uma linha com "estacao" preenchida abre nova estação; a estação deve ser o ponto de referência
 * ou um ponto já calculado. Az = Az de referência da estação + Hz (reduzido a 0–360°).
 *  DN = DH·cot Z + i − FM;  H = H_E + DN;  X = X_E + DH·sen Az;  Y = Y_E + DH·cos Az   (AA Eq. 37–40)
 *
 * @param {object} op  H_ref, X_ref, Y_ref, sigmaRef_m, pontoRef, azRef (texto do ângulo), C (100),
 *   sigmaLeit_m (0,001), sigmaZ_s, sigmaI_m (0,002), tol3fios_m (0,002), visadaMax_m (80), nomeAltura.
 */
export function calcularTaqueometria(linhas, op = {}) {
  const {
    H_ref, X_ref, Y_ref, sigmaRef_m = 0, pontoRef = '', azRef = '0', C = 100, sigmaLeit_m = 0.001,
    sigmaZ_s = 10, sigmaI_m = 0.002, tol3fios_m = 0.002, visadaMax_m = 80, nomeAltura = 'cota',
  } = op;
  const sigmaZ = sigmaZ_s * RAD_POR_SEGUNDO;
  const erros = [], alertas = [], saida = [], estacoes = [];
  const conhecidos = new Map();

  const H0 = parseDecimal(H_ref), X0 = parseDecimal(X_ref), Y0 = parseDecimal(Y_ref);
  if (vazio(H_ref)) erros.push(`Informe a ${nomeAltura} da estação (ponto de referência).`);
  else if (!Number.isFinite(H0)) erros.push(`A ${nomeAltura} da estação "${H_ref}" não é um número.`);
  const temXY = Number.isFinite(X0) && Number.isFinite(Y0);
  if ((!vazio(X_ref) || !vazio(Y_ref)) && !temXY) erros.push('As coordenadas X e Y da estação devem ser números (ou ficar ambas vazias).');
  const ref = String(pontoRef || '').trim();
  if (Number.isFinite(H0)) conhecidos.set(ref || '(referência)', { H: H0, X: temXY ? X0 : NaN, Y: temXY ? Y0 : NaN, sigma: sigmaRef_m });
  const az0 = vazio(azRef) ? 0 : parseAngulo(azRef);
  if (!Number.isFinite(az0)) erros.push(`O azimute de referência "${azRef}" não é válido.`);

  let est = null;
  linhas.forEach((b, idx) => {
    const campos = ['estacao', 'i', 'azref', 'ponto', 'fs', 'fm', 'fi', 'z', 'hz', 'obs'];
    if (campos.every((c) => vazio(b[c]))) return;
    const L = {
      indice: idx, linha: idx + 1, ponto: vazio(b.ponto) ? '' : String(b.ponto).trim(),
      S: NaN, DH: NaN, DV: NaN, DN: NaN, H: NaN, X: NaN, Y: NaN, Az: NaN, sigma: NaN, sigmaDH: NaN, dif3fios: NaN, erros: [], alertas: [],
    };
    saida.push(L);
    const rot = vazio(b.estacao) ? '' : String(b.estacao).trim();
    if (rot && (!est || rot !== est.rotulo)) {
      est = { rotulo: rot, i: NaN, az: Number.isFinite(az0) ? az0 : 0, base: null };
      estacoes.push(est);
      est.base = conhecidos.get(rot) ?? (estacoes.length === 1 && !ref ? conhecidos.get('(referência)') : null);
      if (!est.base) L.erros.push(`a estação ${rot} não tem ${nomeAltura} conhecida: ela deve ser o ponto de referência (${ref || 'informe o nome'}) ou um ponto já calculado.`);
    }
    L.estacao = est?.rotulo ?? null;
    const nome = `Linha ${L.linha}${L.estacao ? ` (estação ${L.estacao}${L.ponto ? `, ponto ${L.ponto}` : ''})` : ''}`;
    const erro = (m) => { L.erros.push(m); };
    const alerta = (m) => { L.alertas.push(m); };
    const fim = () => {
      L.erros.forEach((m) => erros.push(`${nome}: ${m}`));
      L.alertas.forEach((m) => alertas.push(`${nome}: ${m}`));
    };
    if (!est) { erro('a primeira linha precisa indicar a estação.'); fim(); return; }
    if (!vazio(b.i)) { const v = parseDecimal(b.i); if (Number.isFinite(v)) est.i = v; else erro(`a altura do instrumento "${b.i}" não é um número.`); }
    if (!vazio(b.azref)) { const v = parseAngulo(b.azref); if (Number.isFinite(v)) est.az = v; else erro(`o azimute de referência "${b.azref}" não é válido.`); }
    if (campos.slice(3).every((c) => vazio(b[c]))) { L.vazia = true; fim(); return; } // só a estação

    if (!L.ponto) erro('falta o nome do ponto visado.');
    const lido = {};
    for (const [c, rotulo] of [['fs', 'o fio superior (FS)'], ['fm', 'o fio médio (FM)'], ['fi', 'o fio inferior (FI)']]) {
      lido[c] = parseDecimal(b[c]);
      if (vazio(b[c])) erro(`falta ${rotulo}.`);
      else if (!Number.isFinite(lido[c])) erro(`${rotulo} "${b[c]}" não é um número.`);
    }
    const Z = parseAngulo(b.z);
    if (vazio(b.z)) erro('falta o ângulo zenital.');
    else if (!(Z > 0 && Z < Math.PI)) erro(`o ângulo zenital "${b.z}" não é válido (entre 0° e 180°).`);
    const Hz = vazio(b.hz) ? NaN : parseAngulo(b.hz);
    if (!vazio(b.hz) && !Number.isFinite(Hz)) erro(`o ângulo horizontal "${b.hz}" não é válido.`);
    if (!Number.isFinite(est.i)) erro(`informe a altura do instrumento (i) da estação ${est.rotulo}.`);
    if (L.erros.length || !est.base) { fim(); return; }

    if (lido.fs < lido.fi) alerta('o fio superior é menor que o inferior; confira a ordem dos fios.');
    L.dif3fios = lido.fm - (lido.fs + lido.fi) / 2;
    if (Math.abs(L.dif3fios) > tol3fios_m) alerta(`fio médio ${formatar(lido.fm, 3)} m difere de (FS + FI)/2 em ${formatar(L.dif3fios * 1000, 1)} mm (limite ${formatar(tol3fios_m * 1000, 1)} mm).`);
    const e = estadimetria({ FS: lido.fs, FI: lido.fi, Z, C });
    L.S = e.S; L.DH = Math.abs(e.DH); L.DV = e.DV * Math.sign(e.S || 1);
    L.Z = Z;
    L.DN = L.DV + est.i - lido.fm;
    L.H = est.base.H + L.DN;
    const sg = sigmasTaqueometria({ S: Math.abs(e.S), Z, C, sigmaLeit: sigmaLeit_m, sigmaZ, sigmaI: sigmaI_m });
    L.sigmaDH = sg.sigmaDH;
    L.sigma = Math.sqrt(est.base.sigma ** 2 + sg.sigmaDN ** 2);
    if (Number.isFinite(Hz) && Number.isFinite(est.base.X)) {
      L.Az = reduzir2Pi(est.az + Hz);
      L.X = est.base.X + L.DH * Math.sin(L.Az);
      L.Y = est.base.Y + L.DH * Math.cos(L.Az);
    }
    if (L.DH > visadaMax_m) alerta(`visada de ${formatar(L.DH, 1)} m maior que ${formatar(visadaMax_m, 0)} m (NBR 13133:2021, Tabela 6, III N).`);
    if (L.ponto) conhecidos.set(L.ponto, { H: L.H, X: L.X, Y: L.Y, sigma: L.sigma });
    fim();
  });

  const pontos = saida.filter((l) => !l.erros.length && !l.vazia && Number.isFinite(l.H))
    .map((l) => ({ linha: l.linha, ponto: l.ponto, estacao: l.estacao, DH: l.DH, DN: l.DN, H: l.H, X: l.X, Y: l.Y, Az: l.Az, sigma: l.sigma, sigmaDH: l.sigmaDH }));
  return { linhas: saida, estacoes, pontos, erros, alertas, valido: erros.length === 0 };
}
