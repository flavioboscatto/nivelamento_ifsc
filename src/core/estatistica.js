// estatistica.js — séries de observações repetidas (Altimetria Aplicada, Exemplo I).
// Ver docs/02_METODOS_E_FORMULAS.md, item 2.5.

export function media(obs) {
  if (!obs.length) return NaN;
  return obs.reduce((a, b) => a + b, 0) / obs.length;
}

/** Desvio-padrão amostral s (n − 1). */
export function desvioPadrao(obs) {
  const n = obs.length;
  if (n < 2) return NaN;
  const m = media(obs);
  return Math.sqrt(obs.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1));
}

/** Desvio-padrão da média: s / √n. */
export const desvioPadraoMedia = (obs) => desvioPadrao(obs) / Math.sqrt(obs.length);

/** Resíduos v = média − observação (convenção da apostila, Tabela 2). */
export function residuos(obs) {
  const m = media(obs);
  return obs.map((x) => m - x);
}

/**
 * Detecta observações atípicas removendo uma de cada vez.
 * Critério: |x − média_sem_x| > fator · s_sem_x  (padrão fator = 3).
 * Opcional `limiteFixo` (m): usa |x − média_sem_x| > limiteFixo (ex.: 3 × precisão nominal, NBR 5.2.11).
 * Retorna { mantidas, removidas:[{indice, valor, afastamento}] }.
 */
export function detectarAtipicas(obs, { fator = 3, limiteFixo = null, minimo = 3 } = {}) {
  const itens = obs.map((valor, indice) => ({ valor, indice }));
  const removidas = [];
  while (itens.length > minimo) {
    let pior = null;
    for (const it of itens) {
      const outros = itens.filter((o) => o !== it).map((o) => o.valor);
      const m = media(outros);
      const s = desvioPadrao(outros);
      const afast = Math.abs(it.valor - m);
      const limite = limiteFixo ?? fator * s;
      if (afast > limite && (!pior || afast / limite > pior.razao)) pior = { it, afast, razao: afast / limite };
    }
    if (!pior) break;
    removidas.push({ indice: pior.it.indice, valor: pior.it.valor, afastamento: pior.afast });
    itens.splice(itens.indexOf(pior.it), 1);
  }
  return { mantidas: itens.map((i) => i.valor), removidas };
}

/** Resumo completo para exibição. */
export function resumoSerie(obs) {
  return {
    n: obs.length,
    media: media(obs),
    s: desvioPadrao(obs),
    sMedia: desvioPadraoMedia(obs),
    residuos: residuos(obs),
  };
}
