// passos.js — "passo a passo" (modo aula): as fórmulas com os números do levantamento.
// Funções puras, sem DOM: recebem os resultados já calculados e devolvem grupos de linhas de texto.
// Não recalculam nada novo: só mostram as contas feitas pelo núcleo.

import { formatar, formatarComSinal } from './numeros.js';
import { formatarDms } from './angulos.js';

const f = (v, c = 3) => formatar(v, c);
const fs = (v, c = 3) => formatarComSinal(v, c);
const par = (v, c = 3) => (v < 0 ? `(${f(v, c)})` : f(v, c));
const mm = (v, c = 1) => formatar(v * 1000, c);

/**
 * Nivelamento geométrico.
 * @param {object} r  resultado de calcularNivelamento (ou calcularCaderneta)
 * @param {{rot?: string, sigmaL?: number}} op
 * @returns {Array<{titulo: string, linhas: string[]}>}
 */
export function passosGeometrico(r, { rot = 'Cota', sigmaL = null } = {}) {
  const grupos = [];
  for (const e of r.estacoes) {
    if (!Number.isFinite(e.apv)) continue;
    const linhas = [`APV = ${rot}(${e.rePonto}) + L ré = ${f(e.Hre)} + ${f(e.re)} = ${f(e.apv)} m`];
    for (const l of r.linhas.filter((x) => x.nEstacao === e.n && x.tipo && x.tipo !== 're' && Number.isFinite(x.H))) {
      linhas.push(`${rot}(${l.ponto}) = APV − L = ${f(e.apv)} − ${f(l.leitura)} = ${f(l.H)} m (desnível ${fs(l.desnivel)} m)`);
      if (l.dhOrigem === 'estadimetria') linhas.push(`DH(${l.ponto}) por estadimetria = 100 × (FS − FI) = ${f(l.dh)} m`);
    }
    if (Number.isFinite(e.difReVante)) linhas.push(`Ré − vante = ${f(e.dhRe)} − ${f(e.dhVante)} = ${fs(e.difReVante)} m`);
    grupos.push({ titulo: `Estação ${e.rotulo}`, linhas });
  }

  const v = r.verificacao;
  if (v?.aplicavel) {
    grupos.push({ titulo: 'Verificação aritmética', linhas: [
      `Σ ré − Σ vante = ${f(v.somaRe)} − ${f(v.somaVante)} = ${fs(v.diferencaLeituras)} m`,
      `${rot} final − ${rot} inicial = ${f(v.Hfinal)} − ${f(v.Hinicial)} = ${fs(v.diferencaH)} m → ${v.confere ? 'confere' : 'não confere'}`,
    ] });
  }

  // σ de um ponto (exemplo) pela NBR F.1
  const ex = r.linhas.find((l) => l.tipo === 'vante' && l.sigmaForma === 'F.1');
  if (ex && sigmaL !== null && !r.fechamento) {
    const e = r.estacoes[ex.nEstacao - 1];
    const dhm = (e.dhRe + ex.dh) / 2;
    grupos.push({ titulo: `Desvio-padrão de ${ex.ponto} (NBR F.1)`, linhas: [
      `DHm = (${f(e.dhRe)} + ${f(ex.dh)}) / 2 = ${f(dhm)} m; σL · DHm = ${formatar(sigmaL * 1e6, 1)} × 10⁻⁶ × ${f(dhm)} = ${mm(sigmaL * dhm, 2)} mm`,
      `σ = √(σ²ré + 2 (σL · DHm)²) = √(${mm(e.sigmaRe, 2)}² + 2 × ${mm(sigmaL * dhm, 2)}²) = ${mm(ex.sigma)} mm`,
    ] });
  }

  const fe = r.fechamento;
  if (fe?.calculado) {
    const linhas = [
      `e = ${rot} calculada − ${rot} conhecida = ${f(fe.Hfecho)} − ${f(fe.Hconhecida)} = ${mm(fe.erro_m)} mm`,
      `K = ${fe.extensaoIda_m !== undefined ? `extensão da ida = ${f(fe.extensaoIda_m)}` : `Σ DH = ${f(fe.extensao_m)}`} m = ${formatar(fe.K_km, 4)} km`,
    ];
    if (fe.classe) linhas.push(`T = ${fe.classe.t} × √${formatar(fe.K_km, 4)} = ${formatar(fe.classe.T_mm, 1)} mm → |e| = ${formatar(Math.abs(fe.erro_m * 1000), 1)} mm: ${fe.classe.atende ? 'atende' : 'não atende'}`);
    if (fe.distribuicao === 'estacao') {
      linhas.push(`C = e / n = ${par(fe.erro_m, 4)} / ${fe.n} = ${fs(fe.C_m, 5)} m; correção do ponto da estação N = −N × C`);
    } else {
      const p = fe.pontos.find((x) => x.tipo === 'vante' && Number.isFinite(x.correcao));
      if (p) linhas.push(`Exemplo (${p.ponto}): v = −e × d / D = −${par(fe.erro_m, 4)} × ${f(p.distAcum)} / ${f(fe.extensao_m)} = ${fs(p.correcao, 4)} m → ${f(p.H)} ${p.correcao < 0 ? '−' : '+'} ${f(Math.abs(p.correcao), 4)} = ${f(p.Hcorr)} m`);
    }
    if (fe.transporte) {
      const t = fe.transporte;
      linhas.push(`Δh médio = (Δh ida − Δh volta) / 2 = (${par(t.dhIda, 4)} − ${par(t.dhVolta, 4)}) / 2 = ${fs(t.dhMedio, 4)} m → ${rot}(${t.ponto}) = ${f(fe.Hconhecida)} ${t.dhMedio < 0 ? '−' : '+'} ${f(Math.abs(t.dhMedio), 4)} = ${f(t.H)} m`);
    }
    grupos.push({ titulo: 'Fechamento', linhas });
  }
  return grupos;
}

/** Nivelamento trigonométrico (irradiação e poligonal). */
export function passosTrigonometrico(r, { rot = 'Cota', R = 6371000, k = 0.13 } = {}) {
  const grupos = [];
  for (const e of r.estacoes) {
    if (!Number.isFinite(e.A)) continue;
    const linhas = [];
    const dz = (L) => `DV + c+r − s = ${fs(L.DV)} + ${f(L.crAplicada ? L.cr : 0)} − ${f(L.s)} = ${fs(L.dz)} m`;
    if (e.re) {
      linhas.push(`Ré ${e.re.ponto}: ${dz(e.re)}`);
      linhas.push(`Eixo A = ${rot}(${e.re.ponto}) − ${par(e.re.dz)} = ${f(e.Hbase)} − ${par(e.re.dz)} = ${f(e.A)} m`);
    } else {
      linhas.push(`Eixo A = ${rot}(${e.rotulo}) + i = ${f(e.Hbase)} + ${f(e.i)} = ${f(e.A)} m`);
    }
    for (const L of e.linhas) {
      if (L === e.re || !Number.isFinite(L.H)) continue;
      const z = formatarDms(L.Z);
      linhas.push(Number.isFinite(L.Di)
        ? `${L.ponto}: DH = Di · sen Z = ${f(L.Di)} × sen ${z} = ${f(L.DH)} m; DV = Di · cos Z = ${fs(L.DV)} m`
        : `${L.ponto}: DV = DH · cot Z = ${f(L.DH)} × cot ${z} = ${fs(L.DV)} m`);
      linhas.push(`   c+r = (1 − ${formatar(k, 2)}) × ${f(L.DH, 1)}² / (2 × ${formatar(R, 0)}) = ${mm(L.cr)} mm ${L.crAplicada ? '(aplicada)' : '(não aplicada)'}`);
      linhas.push(`   ${rot}(${L.ponto}) = A + ${dz(L).replace('DV + c+r − s = ', '')} → ${f(e.A)} ${L.dz < 0 ? '−' : '+'} ${f(Math.abs(L.dz))} = ${f(L.H)} m`);
    }
    grupos.push({ titulo: `Estação ${e.rotulo}`, linhas });
  }
  const fe = r.fechamento;
  if (fe?.calculado) {
    const linhas = [
      `e = ${f(fe.Hfecho)} − ${f(fe.Hconhecida)} = ${mm(fe.erro_m)} mm; K = Σ DH = ${f(fe.extensao_m)} m = ${formatar(fe.K_km, 4)} km`,
    ];
    if (fe.classe) linhas.push(`T = ${fe.classe.t} × √${formatar(fe.K_km, 4)} = ${formatar(fe.classe.T_mm, 1)} mm → ${fe.classe.atende ? 'atende' : 'não atende'}`);
    grupos.push({ titulo: 'Fechamento', linhas });
  }
  return grupos;
}

/** Taqueometria. */
export function passosTaqueometria(r, { rot = 'Cota' } = {}) {
  return r.linhas.filter((L) => Number.isFinite(L.H) && !L.vazia && !L.erros.length).map((L) => {
    const z = formatarDms(L.Z);
    const linhas = [
      `S = FS − FI = ${f(L.FS)} − ${f(L.FI)} = ${f(L.S)} m`,
      `DH = C · S · sen²Z = ${L.C} × ${f(L.S)} × sen² ${z} = ${f(L.DH)} m`,
      `Desnível = DH · cot Z + i − FM = ${f(L.DH)} × cot ${z} + ${f(L.i)} − ${f(L.FM)} = ${fs(L.DN)} m`,
      `${rot}(${L.ponto}) = ${f(L.HE)} ${L.DN < 0 ? '−' : '+'} ${f(Math.abs(L.DN))} = ${f(L.H)} m`,
    ];
    if (Number.isFinite(L.X)) {
      linhas.push(`Az = ${formatarDms(L.Az)}; X = ${f(L.XE)} + ${f(L.DH)} × sen Az = ${f(L.X)} m; Y = ${f(L.YE)} + ${f(L.DH)} × cos Az = ${f(L.Y)} m`);
    }
    return { titulo: `Ponto ${L.ponto} (estação ${L.estacao})`, linhas };
  });
}

/** Série de observações. */
export function passosSerie(obs, analise, { casas = 3, un = 'm' } = {}) {
  const usadas = obs.filter((_, i) => analise.usadas[i]);
  const s = analise.final;
  if (usadas.length < 2) return [];
  const soma = usadas.reduce((a, b) => a + b, 0);
  const somaV2 = usadas.reduce((a, x) => a + (s.media - x) ** 2, 0);
  return [{ titulo: `Resultado com ${s.n} observações`, linhas: [
    `x̄ = Σx / n = ${formatar(soma, casas)} / ${s.n} = ${formatar(s.media, casas + 1)} ${un}`,
    `Σv² = ${formatar(somaV2, 2 * casas)} ${un}²`,
    `s = √(Σv² / (n − 1)) = √(${formatar(somaV2, 2 * casas)} / ${s.n - 1}) = ${formatar(s.s, casas + 1)} ${un}`,
    `s<sub>x̄</sub> = s / √n = ${formatar(s.s, casas + 1)} / √${s.n} = ${formatar(s.sMedia, casas + 1)} ${un}`,
  ] }];
}
