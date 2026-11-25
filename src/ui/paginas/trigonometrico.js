// paginas/trigonometrico.js — controlador da página de nivelamento trigonométrico (etapa 5).
// Modos: irradiação, poligonal altimétrica (II N) e visadas recíprocas. Taqueometria: etapa 6.
import { calcularTrigonometrico, visadasReciprocas, curvaturaRefracao } from '../../core/trigonometrico.js';
import { calcularTaqueometria } from '../../core/taqueometria.js';
import { parseAngulo, formatarDms } from '../../core/angulos.js';
import { parseDecimal, formatar, formatarComSinal } from '../../core/numeros.js';
import { criarCaderneta } from '../caderneta.js';
import { criarProjeto, serializarProjeto, lerProjeto, nomeArquivo } from '../../io/projeto.js';

const CHAVE_RASCUNHO = 'nivelamento-ifsc.trigonometrico.v1';
const CHAVE_TIPO_ALTURA = 'nivelamento-ifsc.tipoAltura';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = (id) => document.getElementById(id);
const num = (v) => parseDecimal(v);
const f3 = (v) => formatar(v, 3);
const fmm = (v) => (Number.isFinite(v) ? formatar(v * 1000, 1) : '');
const lerJson = (rel) => fetch(new URL(rel, import.meta.url)).then((r) => { if (!r.ok) throw new Error(rel); return r.json(); });

const MODOS = {
  irradiacao: {
    descricao: 'Da estação, visadas aos pontos de detalhe. Com a estação sobre um ponto conhecido, informe i na linha da estação; com estação livre, faça uma visada de ré a um ponto conhecido.',
    ajuda: 'Uma linha com "Estação" preenchida abre nova estação. Status: Ré (ponto conhecido, define o eixo do instrumento), Vante ou Irad. (pontos calculados). Sem status = Irad. Preencha Di (distância inclinada) ou DH; Z PI é opcional (série conjugada).',
  },
  poligonal: {
    descricao: 'Poligonal altimétrica trigonométrica (classe II N): cada estação tem ré e vante; a estação seguinte começa na vante anterior. Fecha na referência ou num ponto de chegada conhecido. K = soma das DH.',
    ajuda: 'Cada estação: uma linha de Ré e uma de Vante (pode ter Irad.). Estação livre: ré e vante a partir do instrumento, sem i. Estação sobre o ponto: o nome da estação é o ponto ocupado e i é informado.',
  },
  reciprocas: {
    descricao: 'Visadas recíprocas e simultâneas (NBR 13133:2021, 5.5.3.1): obrigatórias acima de 125 m. O desnível é a média ida/volta, calculada sem curvatura e refração, que se cancelam.',
    ajuda: 'Cada linha é um par A→B / B→A. A deve ser a referência ou um ponto já calculado numa linha anterior.',
  },
  taqueometria: {
    descricao: 'Taqueometria e estadimetria (classe III N, visada até 80 m): DH = C·S·sen²Z, DN = DH·cot Z + i − FM, com S = FS − FI e C = 100. Com X, Y da estação e Hz, calcula também as coordenadas.',
    ajuda: 'Linha da estação: nome do ponto ocupado (a referência ou um ponto já calculado), i e, se quiser, o azimute da direção Hz = 0. Depois, uma linha por ponto: FS, FM, FI, Z e Hz.',
  },
};

const STATUS = [['', '—'], ['re', 'Ré'], ['vante', 'Vante'], ['irradiado', 'Irad.']];
const CONFIG = {
  normal: {
    colunas: [
      { id: 'estacao', rotulo: 'Estação', classe: 'curta' },
      { id: 'i', rotulo: 'i (m)', numero: true, titulo: 'Altura do instrumento (estação sobre ponto conhecido)' },
      { id: 'ponto', rotulo: 'Ponto' },
      { id: 'status', rotulo: 'Status', opcoes: STATUS },
      { id: 'zpd', rotulo: 'Z PD', titulo: 'Ângulo zenital em posição direta' },
      { id: 'zpi', rotulo: 'Z PI', titulo: 'Ângulo zenital em posição inversa (opcional)' },
      { id: 'di', rotulo: 'Di (m)', numero: true, titulo: 'Distância inclinada' },
      { id: 'dh', rotulo: 'DH (m)', numero: true, titulo: 'Distância horizontal (se não houver Di)' },
      { id: 's', rotulo: 's (m)', numero: true, titulo: 'Altura do sinal (prisma ou alvo)' },
      { id: 'obs', rotulo: 'Observação', classe: 'longa' },
    ],
    calculadas: [
      { id: 'z', rotulo: 'Z médio' },
      { id: 'DH', rotulo: 'DH (m)' },
      { id: 'DV', rotulo: 'DV (m)' },
      { id: 'cr', rotulo: 'c+r (mm)', titulo: 'Curvatura e refração (entre parênteses quando não aplicada)' },
      { id: 'H', rotulo: 'Cota (m)' },
      { id: 'Hc', rotulo: 'Cota corr. (m)' },
      { id: 'sigma', rotulo: 'σ (mm)' },
      { id: 'situacao', rotulo: 'Situação' },
    ],
  },
  taqueometria: {
    colunas: [
      { id: 'estacao', rotulo: 'Estação', classe: 'curta' },
      { id: 'i', rotulo: 'i (m)', numero: true, titulo: 'Altura do instrumento' },
      { id: 'azref', rotulo: 'Az ref.', titulo: 'Azimute da direção Hz = 0 nesta estação (opcional)' },
      { id: 'ponto', rotulo: 'Ponto' },
      { id: 'fs', rotulo: 'FS (m)', numero: true },
      { id: 'fm', rotulo: 'FM (m)', numero: true },
      { id: 'fi', rotulo: 'FI (m)', numero: true },
      { id: 'z', rotulo: 'Z', titulo: 'Ângulo zenital' },
      { id: 'hz', rotulo: 'Hz', titulo: 'Ângulo horizontal' },
      { id: 'obs', rotulo: 'Observação', classe: 'longa' },
    ],
    calculadas: [
      { id: 'S', rotulo: 'S (m)', titulo: 'Número gerador FS − FI' },
      { id: 'DH', rotulo: 'DH (m)' },
      { id: 'DN', rotulo: 'DN (m)' },
      { id: 'H', rotulo: 'Cota (m)' },
      { id: 'X', rotulo: 'X (m)' },
      { id: 'Y', rotulo: 'Y (m)' },
      { id: 'sigma', rotulo: 'σ (mm)' },
      { id: 'situacao', rotulo: 'Situação' },
    ],
  },
  reciprocas: {
    colunas: [
      { id: 'de', rotulo: 'De (A)' },
      { id: 'para', rotulo: 'Para (B)' },
      { id: 'iA', rotulo: 'i em A (m)', numero: true },
      { id: 'zAB', rotulo: 'Z A→B' },
      { id: 'diAB', rotulo: 'Di A→B (m)', numero: true },
      { id: 'sB', rotulo: 's em B (m)', numero: true },
      { id: 'iB', rotulo: 'i em B (m)', numero: true },
      { id: 'zBA', rotulo: 'Z B→A' },
      { id: 'diBA', rotulo: 'Di B→A (m)', numero: true },
      { id: 'sA', rotulo: 's em A (m)', numero: true },
    ],
    calculadas: [
      { id: 'DH', rotulo: 'DH média (m)' },
      { id: 'dhIda', rotulo: 'Δh A→B (m)' },
      { id: 'dhVolta', rotulo: 'Δh B→A (m)' },
      { id: 'dh', rotulo: 'Δh médio (m)' },
      { id: 'ctrl', rotulo: 'Ida + volta (mm)', titulo: 'Controle: ≈ −2·(c+r)' },
      { id: 'H', rotulo: 'Cota de B (m)' },
      { id: 'sigma', rotulo: 'σ (mm)' },
      { id: 'situacao', rotulo: 'Situação' },
    ],
  },
};

let norma, instrumentos, caderneta, modo = 'irradiacao';
let rascunho = { modo, porModo: {} };
let carregando = false;

// ---------- Cota ou altitude ----------
const tipoAltura = () => document.querySelector('input[name="tipo-altura"]:checked')?.value || 'cota';
const rotAltura = () => (tipoAltura() === 'altitude_normal' ? 'Altitude' : 'Cota');
function definirTipoAltura(t) {
  const r = document.querySelector(`input[name="tipo-altura"][value="${t === 'altitude_normal' ? 'altitude_normal' : 'cota'}"]`);
  if (r) r.checked = true;
  aplicarRotulosAltura();
}
function aplicarRotulosAltura() {
  const rot = rotAltura();
  document.querySelectorAll('[data-altura]').forEach((el) => { el.textContent = rot; });
  document.querySelectorAll('[data-altura-min]').forEach((el) => { el.textContent = rot === 'Cota' ? 'cotas' : 'altitudes'; });
  if (caderneta) {
    caderneta.renomearColuna('H', modo === 'reciprocas' ? `${rot} de B (m)` : `${rot} (m)`);
    caderneta.renomearColuna('Hc', `${rot} corr. (m)`);
  }
  try { localStorage.setItem(CHAVE_TIPO_ALTURA, tipoAltura()); } catch { /* sem armazenamento */ }
}

// ---------- Cabeçalho ----------
const CAMPOS = {
  pontoRef: 'ref-ponto', H_ref: 'ref-h', sigmaRef_mm: 'ref-sigma', pontoChegada: 'cheg-ponto', H_chegada: 'cheg-h',
  sigmaChegada_mm: 'cheg-sigma', classe: 'classe', instrumento: 'instrumento', sigmaZ_s: 'sigma-z', distA_mm: 'dist-a',
  distB_ppm: 'dist-b', sigmaIS_mm: 'sigma-is', aplicarCR: 'aplicar-cr', limiarCR_m: 'limiar-cr', R_m: 'raio', k: 'coef-k',
  X_ref: 'ref-x', Y_ref: 'ref-y', azRef: 'az-ref', sigmaLeit_mm: 'sigma-leit',
};
const lerCabecalho = () => Object.fromEntries(Object.entries(CAMPOS).map(([k, id]) => [k, $(id).value]));
function definirCabecalho(c = {}) {
  carregando = true;
  if (c.instrumento) { $('instrumento').value = c.instrumento; aplicarInstrumento(); }
  for (const [k, id] of Object.entries(CAMPOS)) if (k !== 'instrumento' && c[k] !== undefined && c[k] !== null) $(id).value = c[k];
  carregando = false;
}
function aplicarInstrumento() {
  const ins = instrumentos.find((n) => n.id === $('instrumento').value);
  if (!ins || ins.ang_s === null) return;
  $('sigma-z').value = formatar(ins.ang_s, 0);
  $('dist-a').value = formatar(ins.a_mm, 0);
  $('dist-b').value = formatar(ins.b_ppm, 0);
}

function opcoesCalculo(cab) {
  const v = (x, padrao) => (Number.isFinite(num(x)) ? num(x) : padrao);
  const sIS = v(cab.sigmaIS_mm, 2) / 1000;
  return {
    H_ref: cab.H_ref, sigmaRef_m: v(cab.sigmaRef_mm, 0) / 1000, pontoRef: cab.pontoRef.trim(),
    R: v(cab.R_m, norma.R_m), k: v(cab.k, norma.k), aplicarCR: cab.aplicarCR, limiarCR_m: v(cab.limiarCR_m, norma.curvRefracaoAcima_m),
    sigmaZ_s: v(cab.sigmaZ_s, 5), distA_mm: v(cab.distA_mm, 2), distB_ppm: v(cab.distB_ppm, 2), sigmaI_m: sIS, sigmaS_m: sIS,
    visadaMax_m: (norma.trigonometrico.find((c) => c.id === cab.classe) || norma.trigonometrico[0]).visadaMax_m,
    nomeAltura: rotAltura().toLowerCase(), metodo: modo,
    pontoChegada: cab.pontoChegada.trim(), H_chegada: cab.H_chegada, sigmaChegada_m: v(cab.sigmaChegada_mm, 0) / 1000,
    classes: norma.trigonometrico, classeId: cab.classe,
    X_ref: cab.X_ref, Y_ref: cab.Y_ref, azRef: cab.azRef, sigmaLeit_m: v(cab.sigmaLeit_mm, 1) / 1000,
    C: norma.alertasPrograma.constanteEstadimetrica, tol3fios_m: norma.alertasPrograma.tolerancia3fios_m,
  };
}

// ---------- Cálculo ----------
function recalcular() {
  if (carregando || !caderneta) return;
  const cab = lerCabecalho();
  const op = opcoesCalculo(cab);
  const linhas = caderneta.obterLinhas();
  if (modo === 'reciprocas') mostrarReciprocas(linhas, op);
  else if (modo === 'taqueometria') mostrarTaqueometria(linhas, { ...op, visadaMax_m: norma.trigonometrico.find((c) => c.id === 'IIIN').visadaMax_m });
  else mostrarNormal(linhas, op);
  mostrarParametros(op);
  salvarRascunho(cab, linhas);
}

function mostrarNormal(linhas, op) {
  const r = calcularTrigonometrico(linhas, op);
  const f = r.fechamento;
  const pf = new Map((f?.calculado ? f.pontos : []).filter((p) => p.linha).map((p) => [p.linha, p]));
  const porIndice = new Map(r.linhas.map((l) => [l.indice, l]));
  linhas.forEach((_, i) => {
    const l = porIndice.get(i);
    if (!l || l.vazia) { caderneta.mostrarLinha(i, l ? { valores: {}, estado: l.erros.length ? 'erro' : '' } : {}); return; }
    const p = pf.get(l.linha);
    caderneta.mostrarLinha(i, {
      estado: l.erros.length ? 'erro' : l.alertas.length ? 'alerta' : '',
      dica: [...l.erros, ...l.alertas].join('\n'),
      valores: {
        z: Number.isFinite(l.erroIndice) ? formatarDms(l.Z) : '',
        DH: f3(l.DH), DV: formatarComSinal(l.DV, 3),
        cr: Number.isFinite(l.cr) ? (l.crAplicada ? formatar(l.cr * 1000, 1) : `(${formatar(l.cr * 1000, 1)})`) : '',
        H: f3(l.H),
        Hc: p && Number.isFinite(p.correcao) ? f3(p.Hcorr) : '',
        sigma: fmm(p ? p.sigma : l.sigma),
        situacao: l.erros.length ? 'Erro' : l.alertas.length ? 'Alerta' : 'OK',
      },
    });
  });
  mostrarMensagens(r.erros, r.alertas, r.pontos.length);
  mostrarFechamento(f);

  const rot = rotAltura();
  const comF = f?.calculado;
  const pts = comF ? f.pontos : r.pontos;
  $('tabela-pontos').innerHTML = pts.length ? `
    <table class="tabela-resultado">
      <thead><tr><th scope="col">Ponto</th><th scope="col">Estação</th><th scope="col">Status</th>
        <th scope="col" class="n">${rot} calculada (m)</th>
        ${comF ? `<th scope="col" class="n">Correção (m)</th><th scope="col" class="n">${rot} corrigida (m)</th><th scope="col" class="n">σ rigoroso (mm)</th><th scope="col" class="n">σ Anexo L (mm)</th>` : '<th scope="col" class="n">σ (mm)</th>'}
        <th scope="col" class="n">Dist. acum. (m)</th></tr></thead>
      <tbody>${pts.map((p) => `<tr><th scope="row">${esc(p.ponto)}</th><td>${esc(p.estacao)}</td>
        <td>${{ re: 'Partida', vante: 'Vante', irradiado: 'Irradiado' }[p.tipo]}</td><td class="n">${f3(p.H)}</td>
        ${comF ? `<td class="n">${formatarComSinal(p.correcao, 4)}</td><td class="n"><strong>${f3(p.Hcorr)}</strong></td><td class="n">${fmm(p.sigma)}</td><td class="n">${fmm(p.sigmaAnexoL)}</td>` : `<td class="n">${fmm(p.sigma)}</td>`}
        <td class="n">${formatar(p.distAcum, 3)}</td></tr>`).join('')}</tbody>
    </table>` : '<p>Digite a caderneta para ver os resultados.</p>';

  const somaDH = r.linhas.filter((l) => Number.isFinite(l.DH)).reduce((a, l) => a + l.DH, 0);
  $('distancias').innerHTML = `<dl class="lista-def">
    <div><dt>Estações</dt><dd>${r.estacoes.length}</dd></div>
    <div><dt>Visadas</dt><dd>${r.linhas.filter((l) => Number.isFinite(l.DH)).length}</dd></div>
    <div><dt>Soma das DH</dt><dd>${formatar(somaDH, 3)} m</dd></div>
    ${comF ? `<div><dt>K (poligonal)</dt><dd>${formatar(f.K_km, 4)} km</dd></div>` : ''}
  </dl>`;
}

function mostrarReciprocas(linhas, op) {
  const erros = [], alertas = [], pts = [];
  const conhecidos = new Map();
  const Href = num(op.H_ref);
  if (!Number.isFinite(Href)) erros.push(`Informe a ${op.nomeAltura} do ponto de referência.`);
  else conhecidos.set(op.pontoRef || '(referência)', { H: Href, sigma: op.sigmaRef_m });
  let somaDH = 0;
  linhas.forEach((b, i) => {
    const vazio = Object.values(b).every((v) => String(v ?? '').trim() === '');
    if (vazio) { caderneta.mostrarLinha(i); return; }
    const msgs = [];
    const nome = `Linha ${i + 1}${b.de || b.para ? ` (${b.de || '?'} → ${b.para || '?'})` : ''}`;
    const ler = (campo, rotulo, ang = false) => {
      const v = ang ? parseAngulo(b[campo]) : num(b[campo]);
      if (!Number.isFinite(v)) msgs.push(String(b[campo] ?? '').trim() === '' ? `falta ${rotulo}.` : `${rotulo} "${b[campo]}" não é válido.`);
      return v;
    };
    const ida = { Z: ler('zAB', 'o ângulo zenital A→B', true), Di: ler('diAB', 'a distância A→B'), i: ler('iA', 'a altura do instrumento em A'), s: ler('sB', 'a altura do sinal em B') };
    const volta = { Z: ler('zBA', 'o ângulo zenital B→A', true), Di: ler('diBA', 'a distância B→A'), i: ler('iB', 'a altura do instrumento em B'), s: ler('sA', 'a altura do sinal em A') };
    if (!b.de || !b.para) msgs.push('informe os pontos A e B.');
    if (msgs.length) {
      msgs.forEach((m) => erros.push(`${nome}: ${m}`));
      caderneta.mostrarLinha(i, { estado: 'erro', dica: msgs.join('\n'), valores: { situacao: 'Erro' } });
      return;
    }
    const r = visadasReciprocas(ida, volta, { R: op.R, k: op.k, sigmaZ_s: op.sigmaZ_s, distA_mm: op.distA_mm, distB_ppm: op.distB_ppm, sigmaI_m: op.sigmaI_m, sigmaS_m: op.sigmaS_m });
    somaDH += r.DH;
    const avisos = [];
    if (Math.abs(r.DHida - r.DHvolta) > 0.05) avisos.push(`as distâncias horizontais de ida (${f3(r.DHida)} m) e volta (${f3(r.DHvolta)} m) diferem mais de 5 cm.`);
    const desvioCtrl = Math.abs(Math.abs(r.controle) - r.crEsperada2);
    if (desvioCtrl > 0.01) avisos.push(`ida + volta = ${formatar(r.controle * 1000, 1)} mm, longe de −2·(c+r) = ${formatar(-r.crEsperada2 * 1000, 1)} mm. Confira as leituras.`);
    avisos.forEach((a) => alertas.push(`${nome}: ${a}`));
    const base = conhecidos.get(String(b.de).trim());
    let H = NaN, sigma = NaN;
    if (base) {
      H = base.H + r.dh; sigma = Math.sqrt(base.sigma ** 2 + r.sigma ** 2);
      conhecidos.set(String(b.para).trim(), { H, sigma });
      pts.push({ ponto: String(b.para).trim(), de: b.de, dh: r.dh, H, sigma, DH: r.DH });
    } else {
      alertas.push(`${nome}: "${b.de}" não tem ${op.nomeAltura} conhecida; calculado só o desnível.`);
    }
    caderneta.mostrarLinha(i, {
      estado: avisos.length || !base ? 'alerta' : '',
      dica: avisos.join('\n'),
      valores: {
        DH: f3(r.DH), dhIda: formatarComSinal(r.dhIda, 3), dhVolta: formatarComSinal(r.dhVolta, 3), dh: formatarComSinal(r.dh, 4),
        ctrl: formatar(r.controle * 1000, 1), H: f3(H), sigma: fmm(Number.isFinite(sigma) ? sigma : r.sigma),
        situacao: avisos.length || !base ? 'Alerta' : 'OK',
      },
    });
  });
  mostrarMensagens(erros, alertas, pts.length);
  const rot = rotAltura();
  $('tabela-pontos').innerHTML = pts.length ? `
    <table class="tabela-resultado">
      <thead><tr><th scope="col">Ponto</th><th scope="col">A partir de</th><th scope="col" class="n">DH (m)</th><th scope="col" class="n">Δh médio (m)</th>
        <th scope="col" class="n">${rot} (m)</th><th scope="col" class="n">σ (mm)</th></tr></thead>
      <tbody>${pts.map((p) => `<tr><th scope="row">${esc(p.ponto)}</th><td>${esc(p.de)}</td><td class="n">${f3(p.DH)}</td>
        <td class="n">${formatarComSinal(p.dh, 4)}</td><td class="n"><strong>${f3(p.H)}</strong></td><td class="n">${fmm(p.sigma)}</td></tr>`).join('')}</tbody>
    </table>` : '<p>Digite os pares de visadas para ver os resultados.</p>';
  $('distancias').innerHTML = `<dl class="lista-def"><div><dt>Pares calculados</dt><dd>${pts.length}</dd></div>
    <div><dt>Soma das DH</dt><dd>${formatar(somaDH, 3)} m</dd></div>
    <div><dt>c+r para 125 m (referência)</dt><dd>${formatar(curvaturaRefracao(125, op.R, op.k) * 1000, 1)} mm</dd></div></dl>`;
}

function mostrarTaqueometria(linhas, op) {
  const r = calcularTaqueometria(linhas, op);
  const porIndice = new Map(r.linhas.map((l) => [l.indice, l]));
  linhas.forEach((_, i) => {
    const l = porIndice.get(i);
    if (!l) { caderneta.mostrarLinha(i); return; }
    const estado = l.erros.length ? 'erro' : l.alertas.length ? 'alerta' : '';
    if (l.vazia) { caderneta.mostrarLinha(i, { estado, dica: l.erros.join('\n'), valores: { situacao: l.erros.length ? 'Erro' : '' } }); return; }
    caderneta.mostrarLinha(i, {
      estado, dica: [...l.erros, ...l.alertas].join('\n'),
      valores: {
        S: formatar(l.S, 3), DH: f3(l.DH), DN: formatarComSinal(l.DN, 3), H: f3(l.H), X: f3(l.X), Y: f3(l.Y),
        sigma: fmm(l.sigma), situacao: l.erros.length ? 'Erro' : l.alertas.length ? 'Alerta' : 'OK',
      },
    });
  });
  mostrarMensagens(r.erros, r.alertas, r.pontos.length);
  const rot = rotAltura();
  const temXY = r.pontos.some((p) => Number.isFinite(p.X));
  $('tabela-pontos').innerHTML = r.pontos.length ? `
    <table class="tabela-resultado">
      <thead><tr><th scope="col">Ponto</th><th scope="col">Estação</th><th scope="col" class="n">DH (m)</th><th scope="col" class="n">DN (m)</th>
        <th scope="col" class="n">${rot} (m)</th><th scope="col" class="n">σ (mm)</th>
        ${temXY ? '<th scope="col" class="n">Azimute</th><th scope="col" class="n">X (m)</th><th scope="col" class="n">Y (m)</th>' : ''}</tr></thead>
      <tbody>${r.pontos.map((p) => `<tr><th scope="row">${esc(p.ponto)}</th><td>${esc(p.estacao)}</td><td class="n">${f3(p.DH)}</td>
        <td class="n">${formatarComSinal(p.DN, 3)}</td><td class="n"><strong>${f3(p.H)}</strong></td><td class="n">${fmm(p.sigma)}</td>
        ${temXY ? `<td class="n">${Number.isFinite(p.Az) ? formatarDms(p.Az) : '—'}</td><td class="n">${f3(p.X) || '—'}</td><td class="n">${f3(p.Y) || '—'}</td>` : ''}</tr>`).join('')}</tbody>
    </table>` : '<p>Digite a caderneta para ver os resultados.</p>';
  const somaDH = r.pontos.reduce((a, p) => a + p.DH, 0);
  $('distancias').innerHTML = `<dl class="lista-def"><div><dt>Estações</dt><dd>${r.estacoes.length}</dd></div>
    <div><dt>Pontos calculados</dt><dd>${r.pontos.length}</dd></div>
    <div><dt>Soma das DH</dt><dd>${formatar(somaDH, 3)} m</dd></div>
    <div><dt>Constante estadimétrica C</dt><dd>${formatar(op.C, 0)}</dd></div></dl>`;
}

function mostrarMensagens(erros, alertas, nPts) {
  $('mensagens').innerHTML = `
    ${erros.length ? `<h3 class="titulo-msg erro">Corrija (${erros.length})</h3><ul class="msgs erro">${erros.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
    ${alertas.length ? `<h3 class="titulo-msg alerta">Atenção (${alertas.length})</h3><ul class="msgs alerta">${alertas.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
    ${!erros.length && !alertas.length && nPts ? '<p class="status ok">✓ Sem erros nem alertas.</p>' : ''}`;
}

function mostrarFechamento(f) {
  if (!f) return;
  if (!f.calculado) { $('fechamento').innerHTML = `<p class="status neutro">${esc(f.motivo)}</p>`; $('tolerancias').innerHTML = ''; return; }
  const rot = rotAltura(), cl = f.classe, e_mm = f.erro_m * 1000;
  $('fechamento').innerHTML = `
    <dl class="lista-def">
      <div><dt>${rot} calculada no fecho (${esc(f.pontoFecho)})</dt><dd>${f3(f.Hfecho)} m</dd></div>
      <div><dt>${rot} conhecida</dt><dd>${f3(f.Hconhecida)} m</dd></div>
      <div><dt>Erro de fechamento e</dt><dd>${formatarComSinal(e_mm, 1)} mm</dd></div>
      <div><dt>K (soma das DH)</dt><dd>${formatar(f.K_km, 4)} km</dd></div>
      <div><dt>σ esperado do fechamento</dt><dd>${fmm(f.sigmaEsperado_m)} mm</dd></div>
      <div><dt>|e| / σ esperado</dt><dd>${formatar(f.razaoErroSigma, 1)}${f.razaoErroSigma > 3 ? ' — acima de 3: possível erro grosseiro' : ''}</dd></div>
    </dl>
    ${cl ? `<p class="status ${cl.atende ? 'ok' : 'falha'}">${cl.atende ? '✓ Atende' : '✗ Não atende'} à classe ${esc(cl.id)}: |e| = ${formatar(Math.abs(e_mm), 1)} mm ${cl.atende ? '≤' : '>'} T = ${cl.t}√K = ${formatar(cl.T_mm, 1)} mm</p>` : ''}`;
  $('tolerancias').innerHTML = `
    <table class="tabela-resultado tabela-compacta">
      <thead><tr><th scope="col">Classe</th><th scope="col" class="n">T = t√K (mm)</th><th scope="col">Situação</th></tr></thead>
      <tbody>${f.tolerancias.map((t) => `<tr${t.id === cl?.id ? ' class="escolhida"' : ''}><th scope="row">${esc(t.id)} — ${t.t}√K${t.id === cl?.id ? ' <small>(escolhida)</small>' : ''}</th>
        <td class="n">${formatar(t.T_mm, 1)}</td><td class="${t.atende ? 'txt-ok' : 'txt-falha'}">${t.atende ? 'Atende' : 'Não atende'}</td></tr>`).join('')}</tbody>
    </table>
    <p class="nota">Tabela 6: II N com ET classe 1 e duas séries → 120√K (visada até 300 m); ET classe 2 e uma série → 200√K (até 200 m).</p>`;
}

function mostrarParametros(op) {
  const ins = instrumentos.find((n) => n.id === $('instrumento').value);
  const crTxt = { auto: `aplicada acima de ${formatar(op.limiarCR_m, 0)} m`, sempre: 'aplicada sempre', nunca: 'não aplicada' }[op.aplicarCR];
  $('parametros').innerHTML = `<dl class="lista-def">
    <div><dt>Norma</dt><dd>${esc(norma.rotulo)}</dd></div>
    <div><dt>Trabalhando com</dt><dd>${tipoAltura() === 'altitude_normal' ? 'Altitude normal (referida ao SGB)' : 'Cota (referência arbitrária)'}</dd></div>
    <div><dt>Estação total</dt><dd>${esc(ins?.rotulo ?? '—')}: σZ = ${formatar(op.sigmaZ_s, 0)}", σD = ${formatar(op.distA_mm, 0)} mm + ${formatar(op.distB_ppm, 0)} ppm (Anexo C)</dd></div>
    <div><dt>Curvatura e refração</dt><dd>${modo === 'taqueometria' ? 'não aplicada (visadas até 80 m)' : modo === 'reciprocas' ? 'cancelada pela média das visadas recíprocas' : `(1 − k)·DH²/2R, R = ${formatar(op.R, 0)} m, k = ${formatar(op.k, 2)}, ${crTxt}`}</dd></div>
    <div><dt>Distribuição do erro</dt><dd>${modo === 'poligonal' ? 'Proporcional à distância (NBR 13133:2021, 5.5.2.12)' : 'Não se aplica (sem fechamento)'}</dd></div>
    <div><dt>Propagação</dt><dd>${modo === 'taqueometria' ? `Doc 4, 4.5: σS = √2·σleit (σleit = ${formatar(op.sigmaLeit_m * 1000, 1)} mm), σZ e σi` : modo === 'poligonal' ? 'Forma geral por visada (doc 4, 4.4.2), combinando os dois sentidos (4.3.6); Anexo L ao lado' : modo === 'reciprocas' ? 'σ² = ¼ (σ² ida + σ² volta) (doc 4, 4.4.3)' : 'Forma geral por visada; com estação sobre ponto equivale à NBR F.3'}</dd></div>
  </dl>`;
}

// ---------- Rascunho, modos e projeto ----------
function salvarRascunho(cab, linhas) {
  rascunho.modo = modo; rascunho.nome = $('nome-projeto').value;
  rascunho.porModo[modo] = { cabecalho: cab, linhas };
  try { localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(rascunho)); } catch { /* sem armazenamento */ }
}
function lerRascunho() {
  try { const r = JSON.parse(localStorage.getItem(CHAVE_RASCUNHO) || 'null'); if (r?.porModo) return r; } catch { /* */ }
  return { modo: 'irradiacao', porModo: {} };
}
function montarCaderneta() {
  const cfg = CONFIG[modo] ?? CONFIG.normal;
  caderneta = criarCaderneta({ alvo: $('caderneta'), colunas: cfg.colunas, calculadas: cfg.calculadas, aoMudar: recalcular });
  aplicarRotulosAltura();
}
function mostrarModo() {
  document.querySelectorAll('.abas-modo .aba[data-modo]').forEach((b) => {
    b.classList.toggle('ativa', b.dataset.modo === modo);
    b.setAttribute('aria-selected', String(b.dataset.modo === modo));
  });
  document.querySelectorAll('[data-modos]').forEach((el) => { el.hidden = !el.dataset.modos.split(' ').includes(modo); });
  $('descricao-modo').textContent = MODOS[modo].descricao;
  $('ajuda-caderneta').textContent = MODOS[modo].ajuda;
}
function carregarModo(novo, dados) {
  modo = novo;
  const salvo = dados ?? rascunho.porModo[modo];
  if (salvo?.cabecalho) definirCabecalho(salvo.cabecalho);
  mostrarModo();
  montarCaderneta();
  caderneta.definirLinhas(salvo?.linhas ?? []);
}
function trocarModo(novo) {
  if (novo === modo) return;
  salvarRascunho(lerCabecalho(), caderneta.obterLinhas());
  carregarModo(novo);
}
function salvarProjeto() {
  const p = criarProjeto({ nome: $('nome-projeto').value.trim(), tipoAltura: tipoAltura(), modulo: 'trigonometrico', modo, cabecalho: lerCabecalho(), linhas: caderneta.obterLinhas() });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([serializarProjeto(p)], { type: 'application/json' }));
  a.download = nomeArquivo(p.nome, modo);
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function abrirProjeto(ev) {
  const arq = ev.target.files?.[0];
  ev.target.value = '';
  if (!arq) return;
  const r = lerProjeto(await arq.text(), { modulo: 'trigonometrico' });
  if (!r.ok) { alert(r.erro); return; }
  salvarRascunho(lerCabecalho(), caderneta.obterLinhas());
  $('nome-projeto').value = r.projeto.nome || '';
  definirTipoAltura(r.projeto.tipoAltura);
  carregarModo(MODOS[r.projeto.modo] ? r.projeto.modo : 'irradiacao', { cabecalho: r.projeto.cabecalho, linhas: r.projeto.linhas });
}

async function iniciar() {
  try {
    norma = await lerJson('../../../data/norma_nbr13133_2021.json');
  } catch {
    $('mensagens').innerHTML = '<p class="status falha">Não foi possível ler os parâmetros da norma (pasta data/). Abra o site por um servidor (python3 -m http.server 8000).</p>';
    return;
  }
  // Estações totais pelas classes da Tabela 2 (modelos do curso pendentes)
  instrumentos = [
    ...norma.classesET.map((c, n) => ({ id: `et_classe${n + 1}`, rotulo: `ET classe ${n + 1} (Tabela 2) — ${c.ang_s}", ${c.lin[0]} mm + ${c.lin[1]} ppm`, ang_s: c.ang_s, a_mm: c.lin[0], b_ppm: c.lin[1] })),
    { id: 'personalizado', rotulo: 'Outra estação total (digitar as precisões)', ang_s: null },
  ];
  $('instrumento').innerHTML = instrumentos.map((n) => `<option value="${n.id}">${esc(n.rotulo)}</option>`).join('');
  $('instrumento').value = 'et_classe2';
  aplicarInstrumento();
  $('classe').innerHTML = norma.trigonometrico.filter((c) => c.tol_mm_raizK !== null).map((c) => `<option value="${c.id}">${esc(c.rotulo)} — ${c.tol_mm_raizK}√K</option>`).join('');
  $('classe').value = 'IIN-2';
  $('sigma-is').value = '2';
  $('sigma-leit').value = '1';
  $('limiar-cr').value = formatar(norma.curvRefracaoAcima_m, 0);
  $('raio').value = String(norma.R_m);
  $('coef-k').value = formatar(norma.k, 2);

  rascunho = lerRascunho();
  let t = 'cota';
  try { t = localStorage.getItem(CHAVE_TIPO_ALTURA) || 'cota'; } catch { /* */ }
  definirTipoAltura(t);
  $('nome-projeto').value = rascunho.nome || '';
  carregarModo(MODOS[rascunho.modo] ? rascunho.modo : 'irradiacao');

  document.querySelectorAll('input[name="tipo-altura"]').forEach((r) => r.addEventListener('change', () => { aplicarRotulosAltura(); recalcular(); }));
  document.querySelectorAll('.abas-modo .aba[data-modo]').forEach((b) => b.addEventListener('click', () => trocarModo(b.dataset.modo)));
  $('instrumento').addEventListener('change', () => { aplicarInstrumento(); recalcular(); });
  $('form-cabecalho').addEventListener('input', recalcular);
  $('form-cabecalho').addEventListener('change', recalcular);
  $('form-cabecalho').addEventListener('submit', (e) => e.preventDefault());
  $('nome-projeto').addEventListener('input', () => salvarRascunho(lerCabecalho(), caderneta.obterLinhas()));
  $('bt-salvar').addEventListener('click', salvarProjeto);
  $('bt-abrir').addEventListener('click', () => $('arquivo-projeto').click());
  $('arquivo-projeto').addEventListener('change', abrirProjeto);
  $('bt-adicionar').addEventListener('click', () => caderneta.adicionarLinha());
  $('bt-limpar').addEventListener('click', () => { if (confirm('Apagar todas as linhas da caderneta? O cabeçalho é mantido.')) caderneta.definirLinhas([]); });
  $('bt-imprimir').addEventListener('click', () => window.print());
  $('bt-exemplo').addEventListener('click', async () => {
    const ex = await lerJson('../../../data/exemplos/aa_ex5_taqueometria.json');
    definirCabecalho(ex.cabecalho);
    caderneta.definirLinhas(ex.linhas);
  });
}

iniciar();
