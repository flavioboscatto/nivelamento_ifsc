// paginas/geometrico.js — controlador da página de nivelamento geométrico.
// Modos: irradiação (etapa 3), transporte de RN, circuito fechado e linha entre duas RN (etapa 4).
import { sigmaLeituraPorMetro, TOL_VERIFICACAO_M } from '../../core/geometrico.js';
import { calcularNivelamento, nomeMetodo } from '../../core/fechamento.js';
import { classeDoNivel } from '../../core/tolerancias.js';
import { parseDecimal, formatar, formatarComSinal } from '../../core/numeros.js';
import { criarCaderneta } from '../caderneta.js';
import { perfilSvg } from '../perfil_svg.js';
import { criarProjeto, serializarProjeto, lerProjeto, nomeArquivo } from '../../io/projeto.js';

const CHAVE_RASCUNHO = 'nivelamento-ifsc.geometrico.v2';
const CHAVE_ANTIGA = 'nivelamento-ifsc.geometrico.v1';
const CHAVE_TIPO_ALTURA = 'nivelamento-ifsc.tipoAltura'; // escolha vale para o site todo
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = (id) => document.getElementById(id);
const lerJson = (rel) => fetch(new URL(rel, import.meta.url)).then((r) => {
  if (!r.ok) throw new Error(rel);
  return r.json();
});

const MODOS = {
  irradiacao: {
    descricao: 'De uma estação: ré no ponto conhecido e leituras nos pontos irradiados (detalhes). Não há fechamento; recomenda-se visar também um ponto de controle.',
    exemplo: 'nbr_f2.json', rotuloExemplo: 'Exemplo NBR F.2',
  },
  transporte: {
    descricao: 'Nivelamento e contranivelamento numa caderneta contínua: parte da RN de partida, passa pela RN de chegada e volta à de partida (NBR 13133:2021, 5.5.2.2 e 5.5.2.7). K = extensão do nivelamento (ida).',
    exemplo: 'aa_ex1_transporte.json', rotuloExemplo: 'Exemplo AA Ex. I',
  },
  circuito: {
    descricao: 'Parte e chega na mesma RN. K = perímetro (soma das DH de ré e de vante de mudança; os irradiados não entram).',
    exemplo: 'aa_tab9_circuito.json', rotuloExemplo: 'Exemplo AA Tab. 9',
  },
  linha: {
    descricao: 'Parte de uma RN e chega em outra RN de altura conhecida. K = extensão da linha.',
    exemplo: null, rotuloExemplo: 'Exemplo',
  },
};

const COLUNAS = [
  { id: 'estacao', rotulo: 'Estação', classe: 'curta' },
  { id: 'ponto', rotulo: 'Ponto' },
  {
    id: 'status', rotulo: 'Status', titulo: 'Ré, Vante ou Irad. — trocar o status move a leitura de coluna',
    opcoes: [['', '—'], ['re', 'Ré'], ['vante', 'Vante'], ['irradiado', 'Irad.']], moverEntre: ['re', 'vante', 'irradiado'],
  },
  { id: 're', rotulo: 'Ré (m)', numero: true, titulo: 'Leitura de ré (fio médio)' },
  { id: 'vante', rotulo: 'Vante (m)', numero: true, titulo: 'Vante de mudança ou ponto final' },
  { id: 'irradiado', rotulo: 'Irad. (m)', numero: true, titulo: 'Leitura em ponto irradiado' },
  { id: 'fs', rotulo: 'FS (m)', numero: true, titulo: 'Fio superior (opcional)' },
  { id: 'fi', rotulo: 'FI (m)', numero: true, titulo: 'Fio inferior (opcional)' },
  { id: 'dh', rotulo: 'DH (m)', numero: true, titulo: 'Distância horizontal. Vazia: calculada pelos três fios (estadimetria)' },
  { id: 'obs', rotulo: 'Observação', classe: 'longa' },
];
const CALCULADAS = [
  { id: 'apv', rotulo: 'APV (m)', titulo: 'Altura do plano de visada' },
  { id: 'H', rotulo: 'Cota (m)', titulo: 'Valor calculado (antes da distribuição do erro)' },
  { id: 'corr', rotulo: 'Correção (m)', titulo: 'Parcela do erro de fechamento distribuída ao ponto' },
  { id: 'Hc', rotulo: 'Cota corr. (m)', titulo: 'Valor corrigido' },
  { id: 'sigma', rotulo: 'σ (mm)', titulo: 'Desvio-padrão' },
  { id: 'difRV', rotulo: 'Ré − vante (m)', titulo: 'DH ré − DH vante (equidistância)' },
  { id: 'acum', rotulo: 'Dist. acum. (m)', titulo: 'Distância acumulada até o ponto' },
  { id: 'situacao', rotulo: 'Situação' },
];

let norma, instrumentos, caderneta;
let modo = 'irradiacao';
let rascunho = { modo, porModo: {} };
let carregando = false;

// ---------- Cota ou altitude (escolha do início da página) ----------
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
    caderneta.renomearColuna('H', `${rot} (m)`);
    caderneta.renomearColuna('Hc', `${rot} corr. (m)`);
  }
  try { localStorage.setItem(CHAVE_TIPO_ALTURA, tipoAltura()); } catch { /* sem armazenamento */ }
}

// ---------- Cabeçalho ----------
const CAMPOS = {
  pontoRef: 'ref-ponto', H_ref: 'ref-h', sigmaRef_mm: 'ref-sigma', instrumento: 'instrumento',
  sigmaLeitura_mm: 'sigma-leitura', distanciaRef_m: 'dist-ref', sigmaKm_mm: 'sigma-km',
  tol3fios_mm: 'tol-3fios', difReVanteMax_m: 'dif-rv',
  pontoChegada: 'cheg-ponto', H_chegada: 'cheg-h', sigmaChegada_mm: 'cheg-sigma',
  classe: 'classe', distribuicao: 'distribuicao',
};

function lerCabecalho() {
  const c = Object.fromEntries(Object.entries(CAMPOS).map(([k, id]) => [k, $(id).value]));
  c.arredondarC = $('arredondar-c').checked;
  return c;
}

function definirCabecalho(c = {}) {
  carregando = true;
  if (c.instrumento) { $('instrumento').value = c.instrumento; aplicarInstrumento(); }
  for (const [k, id] of Object.entries(CAMPOS)) {
    if (k !== 'instrumento' && c[k] !== undefined && c[k] !== null) $(id).value = c[k];
  }
  if (c.arredondarC !== undefined) $('arredondar-c').checked = !!c.arredondarC;
  carregando = false;
}

function aplicarInstrumento() {
  const ins = instrumentos.niveis.find((n) => n.id === $('instrumento').value);
  if (!ins) return;
  $('sigma-leitura').value = ins.sigmaLeitura_mm === null ? '' : formatar(ins.sigmaLeitura_mm, 1);
  $('dist-ref').value = formatar(ins.distanciaRef_m, 0);
  $('sigma-km').value = ins.sigmaKm_mm === null ? '' : formatar(ins.sigmaKm_mm, 1);
}

const f3 = (v) => formatar(v, 3);
const fmm = (v) => (Number.isFinite(v) ? formatar(v * 1000, 1) : '');
const num = (v) => parseDecimal(v);

// ---------- Cálculo ----------
function recalcular() {
  if (carregando || !caderneta) return;
  const cab = lerCabecalho();
  const sL = num(cab.sigmaLeitura_mm), dRef = num(cab.distanciaRef_m);
  const sKm = num(cab.sigmaKm_mm), sRef = num(cab.sigmaRef_mm), sB = num(cab.sigmaChegada_mm);
  const tol3 = num(cab.tol3fios_mm), difRV = num(cab.difReVanteMax_m);
  const linhas = caderneta.obterLinhas();
  const avisosCab = [];
  if (!Number.isFinite(sL) || !Number.isFinite(dRef) || dRef <= 0) avisosCab.push('Informe a precisão de leitura do nível (mm a uma distância de referência) para calcular o desvio-padrão das alturas.');
  if (cab.sigmaRef_mm.trim() !== '' && !Number.isFinite(sRef)) avisosCab.push(`O desvio-padrão da referência "${cab.sigmaRef_mm}" não é um número.`);
  const classeNivel = classeDoNivel(sKm, norma.classesNivel_mm_km);

  const r = calcularNivelamento(linhas, {
    metodo: modo,
    H_ref: cab.H_ref,
    sigmaRef_m: Number.isFinite(sRef) ? sRef / 1000 : 0,
    pontoRef: cab.pontoRef.trim(),
    sigmaL: Number.isFinite(sL) && Number.isFinite(dRef) && dRef > 0 ? sigmaLeituraPorMetro(sL, dRef) : null,
    sigmaKm_m: Number.isFinite(sKm) ? sKm / 1000 : null,
    C: norma.alertasPrograma.constanteEstadimetrica,
    tol3fios_m: Number.isFinite(tol3) ? tol3 / 1000 : norma.alertasPrograma.tolerancia3fios_m,
    difReVanteMax_m: Number.isFinite(difRV) ? difRV : norma.alertasPrograma.difReVanteMax_m,
    visadaMax_m: norma.geometrico[0].visadaMax_m,
    alturaMin_m: norma.alturaMinVisada_m,
    pontoChegada: cab.pontoChegada.trim(),
    H_chegada: cab.H_chegada,
    sigmaChegada_m: Number.isFinite(sB) ? sB / 1000 : 0,
    distribuicao: cab.distribuicao,
    arredondarC: cab.arredondarC,
    classes: norma.geometrico,
    classeId: cab.classe,
    classeNivel: classeNivel?.classe ?? null,
    nomeAltura: rotAltura().toLowerCase(),
  });

  const f = r.fechamento;
  const pontosF = f?.calculado ? new Map(f.pontos.map((p) => [p.linha, p])) : new Map();

  // Células calculadas de cada linha
  const porIndice = new Map(r.linhas.map((l) => [l.indice, l]));
  linhas.forEach((_, i) => {
    const l = porIndice.get(i);
    if (!l) { caderneta.mostrarLinha(i); return; }
    const pf = pontosF.get(l.linha);
    const estado = l.erros.length ? 'erro' : l.alertas.length ? 'alerta' : '';
    caderneta.mostrarLinha(i, {
      estado,
      dica: [...l.erros, ...l.alertas].join('\n'),
      placeholders: l.dhOrigem === 'estadimetria' ? { dh: formatar(l.dh, 3) } : {},
      valores: {
        apv: l.tipo === 're' ? f3(l.apv) : '',
        H: f3(l.H),
        corr: pf && Number.isFinite(pf.correcao) && pf.tipo !== 're' ? formatarComSinal(pf.correcao, 4) : '',
        Hc: pf && Number.isFinite(pf.correcao) ? f3(pf.Hcorr) : '',
        sigma: fmm(pf ? pf.sigma : (f ? NaN : l.sigma)),
        difRV: Number.isFinite(l.difReVante) ? formatarComSinal(l.difReVante, 3) : '',
        acum: formatar(l.distAcum, 3),
        situacao: l.erros.length ? 'Erro' : l.alertas.length ? 'Alerta' : 'OK',
      },
    });
  });

  mostrarResultados(r, cab, avisosCab, classeNivel);
  salvarRascunho(cab, linhas);
}

function textoDistribuicao(cab, f) {
  if (modo === 'irradiacao') return 'Não se aplica: irradiação, sem fechamento.';
  if (cab.distribuicao === 'estacao') {
    return `Por estação (apostila, AA Eq. 24–26): C = e / n${f?.calculado ? ` = ${formatarComSinal(f.C_m, 4)} m` : ''}${cab.arredondarC ? ', arredondado a 0,1 mm como a apostila' : ''}. Opção didática, não prevista na NBR 13133:2021.`;
  }
  return 'Proporcional à distância acumulada (NBR 13133:2021, 5.5.2.12).';
}

function textoPropagacao() {
  if (modo === 'irradiacao') return 'NBR 13133:2021, Anexo F.1 (vantes); F.1 sem simplificação (irradiados). σ por km mostrado como referência.';
  const forma = { transporte: 'circuito (4.3.6 a) nos pontos; média ida/volta (4.3.6 c) na RN de chegada', circuito: 'circuito fechado (4.3.6 a)', linha: 'linha entre duas RN (4.3.6 b)' }[modo];
  return `Rigorosa, combinando os dois sentidos — ${forma}; variância por estação pela NBR F.1. Anexo L (modo simplificado da norma) e σ por km mostrados ao lado.`;
}

const rotAltura_ = () => rotAltura();

function mostrarResultados(r, cab, avisosCab, classeNivel) {
  const rotAltura = rotAltura_();
  const ins = instrumentos.niveis.find((n) => n.id === cab.instrumento);
  const f = r.fechamento;
  const classeEsc = norma.geometrico.find((c) => c.id === cab.classe);

  $('parametros').innerHTML = `
    <dl class="lista-def">
      <div><dt>Norma</dt><dd>${esc(norma.rotulo)}</dd></div>
      <div><dt>Método</dt><dd>${esc(nomeMetodo(modo))}${modo !== 'irradiacao' && classeEsc ? `<br>Classe ${esc(classeEsc.rotulo)}` : ''}</dd></div>
      <div><dt>Nível</dt><dd>${esc(ins ? ins.rotulo : '—')}${classeNivel ? `<br>${esc(classeNivel.rotulo)}` : ''}</dd></div>
      <div><dt>Trabalhando com</dt><dd>${tipoAltura() === 'altitude_normal' ? 'Altitude normal (referida ao SGB)' : 'Cota (referência arbitrária)'}</dd></div>
      <div><dt>Distribuição do erro</dt><dd>${esc(textoDistribuicao(cab, f))}</dd></div>
      <div><dt>Propagação</dt><dd>${esc(textoPropagacao())}</dd></div>
    </dl>`;

  // Verificação aritmética
  const v = r.verificacao;
  $('verificacao').innerHTML = v.aplicavel ? `
    <dl class="lista-def">
      <div><dt>Σ ré</dt><dd>${f3(v.somaRe)} m</dd></div>
      <div><dt>Σ vante (mudanças e final)</dt><dd>${f3(v.somaVante)} m</dd></div>
      <div><dt>Σ ré − Σ vante</dt><dd>${formatarComSinal(v.diferencaLeituras, 3)} m</dd></div>
      <div><dt>H final − H inicial</dt><dd>${formatarComSinal(v.diferencaH, 3)} m</dd></div>
    </dl>
    <p class="status ${v.confere ? 'ok' : 'falha'}">${v.confere ? '✓ Confere' : `✗ Não confere — diferença de ${formatar(v.discrepancia * 1000, 1)} mm (limite ${formatar(TOL_VERIFICACAO_M * 1000, 1)} mm)`}</p>`
    : `<p class="status neutro">Não se aplica: ${esc(v.motivo)}</p>`;

  // Distâncias
  const nVis = r.linhas.filter((l) => Number.isFinite(l.dh)).length;
  const temExt = Number.isFinite(r.extensao_m) && r.estacoes.some((e) => e.vantePonto);
  $('distancias').innerHTML = `
    <dl class="lista-def">
      <div><dt>Estações</dt><dd>${r.estacoes.length}</dd></div>
      <div><dt>Visadas com DH</dt><dd>${nVis} de ${r.linhas.filter((l) => l.tipo).length}</dd></div>
      <div><dt>Extensão (ré + vante de mudança)</dt><dd>${temExt ? `${formatar(r.extensao_m, 3)} m` : '—'}</dd></div>
      ${f?.extensaoIda_m !== undefined ? `
      <div><dt>Nivelamento (ida)</dt><dd>${formatar(f.extensaoIda_m, 3)} m</dd></div>
      <div><dt>Contranivelamento (volta)</dt><dd>${formatar(f.extensaoVolta_m, 3)} m</dd></div>
      <div><dt>Diferença ida × volta</dt><dd>${formatar(f.difExtensao * 100, 1)} %</dd></div>` : ''}
      ${f?.calculado ? `<div><dt>K (um sentido)</dt><dd>${formatar(f.K_km, 4)} km</dd></div>` : ''}
    </dl>`;

  mostrarFechamento(f);

  // Tabela de pontos
  const comF = f?.calculado;
  const pts = comF ? f.pontos : r.pontos;
  const cabF = comF ? `<th scope="col" class="n">Correção (m)</th><th scope="col" class="n">${rotAltura} corrigida (m)</th>
        <th scope="col" class="n">σ rigoroso (mm)</th><th scope="col" class="n">σ Anexo L (mm)</th>` : '<th scope="col" class="n">σ F.1 (mm)</th>';
  $('tabela-pontos').innerHTML = pts.length ? `
    <table class="tabela-resultado">
      <thead><tr><th scope="col">Ponto</th><th scope="col">Estação</th><th scope="col">Tipo</th>
        <th scope="col" class="n">${rotAltura} calculada (m)</th>${cabF}
        <th scope="col" class="n">σ por km (mm)<br><small>referência</small></th><th scope="col" class="n">Dist. acum. (m)</th></tr></thead>
      <tbody>${pts.map((p) => `<tr>
        <th scope="row">${esc(p.ponto)}</th><td>${esc(p.estacao)}</td>
        <td>${{ re: 'Partida', vante: 'Vante', irradiado: 'Irradiado' }[p.tipo]}</td>
        <td class="n">${f3(p.H)}</td>
        ${comF ? `<td class="n">${Number.isFinite(p.correcao) ? formatarComSinal(p.correcao, 4) : '—'}</td>
          <td class="n"><strong>${Number.isFinite(p.correcao) ? f3(p.Hcorr) : '—'}</strong></td>
          <td class="n">${fmm(p.sigma) || '—'}</td><td class="n">${fmm(p.sigmaAnexoL) || '—'}</td>`
    : `<td class="n">${fmm(p.sigma) || '—'}</td>`}
        <td class="n">${fmm(p.sigmaKm) || '—'}</td>
        <td class="n">${formatar(p.distAcum, 3) || '—'}</td></tr>`).join('')}</tbody>
    </table>` : '<p>Digite a caderneta para ver as alturas.</p>';

  // Estações
  $('tabela-estacoes').innerHTML = r.estacoes.length ? `
    <table class="tabela-resultado">
      <thead><tr><th scope="col">Estação</th><th scope="col">Ré</th><th scope="col" class="n">DH ré (m)</th>
        <th scope="col">Vante</th><th scope="col" class="n">DH vante (m)</th><th scope="col" class="n">Ré − vante (m)</th>
        <th scope="col" class="n">Lance (m)</th><th scope="col" class="n">APV (m)</th><th scope="col" class="n">Irad.</th></tr></thead>
      <tbody>${r.estacoes.map((e) => `<tr>
        <th scope="row">${esc(e.rotulo)}</th><td>${esc(e.rePonto)}</td><td class="n">${formatar(e.dhRe, 3)}</td>
        <td>${esc(e.vantePonto ?? '—')}</td><td class="n">${formatar(e.dhVante, 3)}</td>
        <td class="n">${Number.isFinite(e.difReVante) ? formatarComSinal(e.difReVante, 3) : ''}</td>
        <td class="n">${formatar(e.lance, 3)}</td><td class="n">${f3(e.apv)}</td><td class="n">${e.irradiados}</td></tr>`).join('')}</tbody>
    </table>` : '';

  // Mensagens
  const erros = [...avisosCab, ...r.erros];
  $('mensagens').innerHTML = `
    ${erros.length ? `<h3 class="titulo-msg erro">Corrija (${erros.length})</h3><ul class="msgs erro">${erros.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
    ${r.alertas.length ? `<h3 class="titulo-msg alerta">Atenção (${r.alertas.length})</h3><ul class="msgs alerta">${r.alertas.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
    ${!erros.length && !r.alertas.length && pts.length ? '<p class="status ok">✓ Sem erros nem alertas.</p>' : ''}`;

  // Perfil (alturas corrigidas quando houver fechamento)
  const ptsPerfil = comF ? f.pontos.map((p) => ({ ...p, H: Number.isFinite(p.correcao) ? p.Hcorr : p.H })) : r.pontos;
  const svg = perfilSvg(ptsPerfil, { rotuloAltura: `${rotAltura}${comF ? ' corrigida' : ''} (m)` });
  $('perfil').innerHTML = svg || '<p>O perfil aparece quando houver ao menos dois pontos com altura e distância.</p>';
}

function mostrarFechamento(f) {
  if (!f) return;
  const rot = rotAltura();
  if (!f.calculado) {
    $('fechamento').innerHTML = `<p class="status neutro">${esc(f.motivo || 'Ainda não calculado.')}</p>`;
    $('tolerancias').innerHTML = '';
    $('transporte').innerHTML = '';
    return;
  }
  const e_mm = f.erro_m * 1000;
  const cl = f.classe;
  $('fechamento').innerHTML = `
    <dl class="lista-def">
      <div><dt>${rot} calculada no fecho (${esc(f.pontoFecho)})</dt><dd>${f3(f.Hfecho)} m</dd></div>
      <div><dt>${rot} conhecida</dt><dd>${f3(f.Hconhecida)} m</dd></div>
      <div><dt>Erro de fechamento e</dt><dd>${formatarComSinal(e_mm, 1)} mm</dd></div>
      <div><dt>K (extensão em um sentido)</dt><dd>${Number.isFinite(f.K_km) ? `${formatar(f.K_km, 4)} km` : '—'}</dd></div>
      <div><dt>σ esperado do fechamento</dt><dd>${fmm(f.sigmaEsperado_m) || '—'} mm${Number.isFinite(f.sigmaEsperadoKm_m) ? ` (por km: ${fmm(f.sigmaEsperadoKm_m)})` : ''}</dd></div>
      <div><dt>|e| / σ esperado</dt><dd>${Number.isFinite(f.razaoErroSigma) ? formatar(f.razaoErroSigma, 1) : '—'}${f.razaoErroSigma > 3 ? ' — acima de 3: possível erro grosseiro' : ''}</dd></div>
    </dl>
    ${cl && Number.isFinite(cl.T_mm) ? `<p class="status ${cl.atende ? 'ok' : 'falha'}">${cl.atende ? '✓ Atende' : '✗ Não atende'} à classe ${esc(cl.id)}: |e| = ${formatar(Math.abs(e_mm), 1)} mm ${cl.atende ? '≤' : '>'} T = ${cl.t}√K = ${formatar(cl.T_mm, 1)} mm</p>` : ''}`;

  $('tolerancias').innerHTML = `
    <table class="tabela-resultado tabela-compacta">
      <thead><tr><th scope="col">Classe</th><th scope="col" class="n">T = t√K (mm)</th><th scope="col">Situação</th></tr></thead>
      <tbody>${f.tolerancias.map((t) => `<tr${t.id === f.classe?.id ? ' class="escolhida"' : ''}>
        <th scope="row">${esc(t.id)} — ${t.t}√K${t.id === f.classe?.id ? ' <small>(escolhida)</small>' : ''}</th>
        <td class="n">${Number.isFinite(t.T_mm) ? formatar(t.T_mm, 1) : '—'}</td>
        <td class="${t.atende ? 'txt-ok' : 'txt-falha'}">${Number.isFinite(t.T_mm) ? (t.atende ? 'Atende' : 'Não atende') : '—'}</td></tr>`).join('')}</tbody>
    </table>
    <p class="nota">Tabela 5: nível classe 1 → 6√K; classe 2 → 8√K; classe 3 → 12√K (K em km).</p>`;

  const t = f.transporte;
  $('transporte').innerHTML = t ? `
    <dl class="lista-def">
      <div><dt>Δh nivelamento (ida, até ${esc(t.ponto)})</dt><dd>${formatarComSinal(t.dhIda, 4)} m</dd></div>
      <div><dt>Δh contranivelamento (volta)</dt><dd>${formatarComSinal(t.dhVolta, 4)} m</dd></div>
      <div><dt>Δh médio = (Δh ida − Δh volta) / 2</dt><dd>${formatarComSinal(t.dhMedio, 4)} m</dd></div>
      <div><dt>${esc(t.ponto)} pela média (AA Eq. 17–19)</dt><dd><strong>${f3(t.H)} m</strong>${Number.isFinite(t.sigma) ? ` ± ${fmm(t.sigma)} mm` : ''}</dd></div>
    </dl>
    <p class="nota">σ da média pela forma 4.3.6 c: σ² = σ²(partida) + ¼ (V ida + V volta). Na tabela de alturas, ${esc(t.ponto)} aparece com a distribuição escolhida; a diferença entre os dois valores é menor que 1 mm quando ida e volta têm extensões parecidas.</p>` : '';
}

// ---------- Rascunho e modos ----------
function salvarRascunho(cab, linhas) {
  rascunho.modo = modo;
  rascunho.nome = $('nome-projeto').value;
  rascunho.porModo[modo] = { cabecalho: cab, linhas };
  try { localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(rascunho)); } catch { /* sem armazenamento */ }
}
function lerRascunho() {
  try {
    const r = JSON.parse(localStorage.getItem(CHAVE_RASCUNHO) || 'null');
    if (r?.porModo) return r;
    const antigo = JSON.parse(localStorage.getItem(CHAVE_ANTIGA) || 'null');
    if (antigo) return { modo: 'irradiacao', porModo: { irradiacao: antigo } };
  } catch { /* sem armazenamento */ }
  return { modo: 'irradiacao', porModo: {} };
}

function mostrarModo() {
  document.querySelectorAll('.abas-modo .aba').forEach((b) => {
    const ativo = b.dataset.modo === modo;
    b.classList.toggle('ativa', ativo);
    b.setAttribute('aria-selected', String(ativo));
  });
  document.querySelectorAll('[data-modos]').forEach((el) => { el.hidden = !el.dataset.modos.split(' ').includes(modo); });
  $('rot-arredondar').hidden = modo === 'irradiacao' || $('distribuicao').value !== 'estacao';
  $('descricao-modo').textContent = MODOS[modo].descricao;
  $('bt-exemplo').textContent = MODOS[modo].rotuloExemplo;
  $('bt-exemplo').hidden = !MODOS[modo].exemplo;
}

function classePadrao() {
  const c = classeDoNivel(num($('sigma-km').value), norma.classesNivel_mm_km);
  const alvo = norma.geometrico.find((g) => c && g.classeNivelMax >= c.classe);
  return (alvo || norma.geometrico.at(-1)).id;
}

function trocarModo(novo) {
  if (novo === modo) return;
  salvarRascunho(lerCabecalho(), caderneta.obterLinhas());
  const cabAtual = lerCabecalho();
  modo = novo;
  const salvo = rascunho.porModo[modo];
  // Instrumento e precisões seguem para o novo modo; o resto vem do rascunho do modo
  definirCabecalho(salvo ? { ...salvo.cabecalho } : {
    ...cabAtual, pontoRef: '', H_ref: '', sigmaRef_mm: '', pontoChegada: '', H_chegada: '', sigmaChegada_mm: '',
  });
  mostrarModo();
  caderneta.definirLinhas(salvo?.linhas ?? []);
}

// ---------- Projeto em arquivo (.niv) ----------
function salvarProjeto() {
  const p = criarProjeto({
    nome: $('nome-projeto').value.trim(), tipoAltura: tipoAltura(), modulo: 'geometrico', modo,
    cabecalho: lerCabecalho(), linhas: caderneta.obterLinhas(),
  });
  const blob = new Blob([serializarProjeto(p)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nomeArquivo(p.nome, modo);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function abrirProjeto(ev) {
  const arq = ev.target.files?.[0];
  ev.target.value = '';
  if (!arq) return;
  const r = lerProjeto(await arq.text(), { modulo: 'geometrico' });
  if (!r.ok) { alert(r.erro); return; }
  const p = r.projeto;
  salvarRascunho(lerCabecalho(), caderneta.obterLinhas());
  modo = MODOS[p.modo] ? p.modo : 'irradiacao';
  $('nome-projeto').value = p.nome || '';
  definirTipoAltura(p.tipoAltura);
  definirCabecalho({ pontoChegada: '', H_chegada: '', sigmaChegada_mm: '', ...p.cabecalho });
  mostrarModo();
  caderneta.definirLinhas(p.linhas);
}

async function iniciar() {
  try {
    [norma, instrumentos] = await Promise.all([
      lerJson('../../../data/norma_nbr13133_2021.json'),
      lerJson('../../../data/instrumentos.json'),
    ]);
  } catch {
    $('mensagens').innerHTML = '<p class="status falha">Não foi possível ler os parâmetros da norma (pasta data/). Abra o site por um servidor (python3 -m http.server 8000).</p>';
    return;
  }

  $('instrumento').innerHTML = instrumentos.niveis.map((n) => `<option value="${esc(n.id)}">${esc(n.rotulo)}</option>`).join('');
  $('classe').innerHTML = norma.geometrico.map((g) => `<option value="${esc(g.id)}">${esc(g.rotulo)} — ${g.tol_mm_raizK}√K</option>`).join('');
  $('tol-3fios').value = formatar(norma.alertasPrograma.tolerancia3fios_m * 1000, 1);
  $('dif-rv').value = formatar(norma.alertasPrograma.difReVanteMax_m, 0);
  aplicarInstrumento();
  $('classe').value = classePadrao();

  caderneta = criarCaderneta({ alvo: $('caderneta'), colunas: COLUNAS, calculadas: CALCULADAS, aoMudar: recalcular });

  rascunho = lerRascunho();
  let tipoSalvo = 'cota';
  try { tipoSalvo = localStorage.getItem(CHAVE_TIPO_ALTURA) || 'cota'; } catch { /* sem armazenamento */ }
  definirTipoAltura(tipoSalvo);
  $('nome-projeto').value = rascunho.nome || '';
  document.querySelectorAll('input[name="tipo-altura"]').forEach((r) => r.addEventListener('change', () => { aplicarRotulosAltura(); recalcular(); }));
  $('nome-projeto').addEventListener('input', () => salvarRascunho(lerCabecalho(), caderneta.obterLinhas()));
  $('bt-salvar').addEventListener('click', salvarProjeto);
  $('bt-abrir').addEventListener('click', () => $('arquivo-projeto').click());
  $('arquivo-projeto').addEventListener('change', abrirProjeto);
  modo = MODOS[rascunho.modo] ? rascunho.modo : 'irradiacao';
  const salvo = rascunho.porModo[modo];
  if (salvo) definirCabecalho(salvo.cabecalho);
  mostrarModo();

  $('instrumento').addEventListener('change', () => { aplicarInstrumento(); recalcular(); });
  $('distribuicao').addEventListener('change', mostrarModo);
  $('form-cabecalho').addEventListener('input', recalcular);
  $('form-cabecalho').addEventListener('change', recalcular);
  $('form-cabecalho').addEventListener('submit', (e) => e.preventDefault());
  document.querySelectorAll('.abas-modo .aba').forEach((b) => b.addEventListener('click', () => trocarModo(b.dataset.modo)));
  if (salvo?.linhas?.length) caderneta.definirLinhas(salvo.linhas); else recalcular();

  $('bt-adicionar').addEventListener('click', () => caderneta.adicionarLinha());
  $('bt-limpar').addEventListener('click', () => {
    if (confirm('Apagar todas as linhas da caderneta? O cabeçalho é mantido.')) caderneta.definirLinhas([]);
  });
  $('bt-exemplo').addEventListener('click', async () => {
    const arq = MODOS[modo].exemplo;
    if (!arq) return;
    const ex = await lerJson(`../../../data/exemplos/${arq}`);
    definirCabecalho({ pontoChegada: '', H_chegada: '', sigmaChegada_mm: '', ...ex.cabecalho });
    mostrarModo();
    caderneta.definirLinhas(ex.linhas);
  });
  $('bt-imprimir').addEventListener('click', () => window.print());
}

iniciar();
