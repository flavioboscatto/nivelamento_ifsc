# 3. Parâmetros da ABNT NBR 13133:2021

**Decisão D1 (25/11/2026): o programa segue somente a NBR 13133:2021.** As apostilas do curso (2018) seguem a edição de 1994, que mudou classes, tolerâncias e a ordem de classificação dos níveis; a seção 3.5 registra as diferenças apenas para a tela "Sobre" e para orientar alunos.

Os parâmetros ficam em `data/norma_nbr13133_2021.json` — nenhum valor de norma deve ficar fixo no código.

## 3.1 Classificação de instrumentos — NBR 2021

### 3.1.1 Medidores de ângulos (Tabela 1)

| Classe | Desvio-padrão da direção |
|---|---|
| 1 | σ ≤ 2" |
| 2 | 2" < σ ≤ 5" |
| 3 | 5" < σ ≤ 10" |
| 4 | σ > 10" |

### 3.1.2 Estações totais (Tabela 2)

| Classe | Desvio-padrão da direção | Desvio-padrão linear |
|---|---|---|
| 1 | σ ≤ 2" | ≤ ±(1 mm + 1 ppm) |
| 2 | 2" < σ ≤ 5" | ≤ ±(2 mm + 2 ppm) |
| 3 | 5" < σ ≤ 10" | ≤ ±(3 mm + 3 ppm) |

### 3.1.3 Níveis (Tabela 3) — desvio-padrão de 1 km de duplo nivelamento

| Classe 2021 | Desvio-padrão | Faixa mais próxima em 1994 (IA 2.1.6) |
|---|---|---|
| 1 | ≤ 1 mm/km | classe 4 — muito alta (≤ 1 mm/km) |
| 2 | ≤ 2 mm/km | classe 3 — alta (≤ 3 mm/km) |
| 3 | ≤ 6 mm/km | classe 3 ou 2 — alta/média (≤ 3 / ≤ 10 mm/km) |
| 4 | > 6 mm/km | classe 2 ou 1 — média/baixa |

As faixas das duas edições não coincidem; a coluna da direita é só orientação didática.

> **Inversão de escala:** em 1994 a classe 4 era a **mais** precisa; em 2021 a classe 1 é a mais precisa. A interface deve sempre exibir "classe X (NBR 2021) — ≤ Y mm/km" para evitar confusão com a apostila IA 2.1.6.

Exemplo: Leica Sprinter 150/150M (1,5 mm/km) → **classe 2** (2021). Sprinter 250M (1,0 mm/km) → **classe 1**. Sprinter 50 (2,0 mm/km) → **classe 2**.

### 3.1.4 Aferição (4.2.5, 4.2.7, 4.3)

Níveis e MED a cada dois anos. O cadastro de instrumentos do programa terá campo "data da última aferição" e alertará se vencida (informativo).

## 3.2 Nivelamento geométrico — Tabela 5 (classe I N)

| Instrumento | Visada máxima | Tolerância de fechamento (K em km) | Finalidade |
|---|---|---|---|
| Nível classe 1 | 80 m | **6 mm √K** | Transporte de altitude ou cota |
| Nível classe 2 | 80 m | **8 mm √K** | Rede urbana |
| Nível classe 3 | 80 m | **12 mm √K** | Poligonal principal |

Condições associadas (texto da norma):
- 5.5.2.2 — RN implantadas por nivelamento geométrico **duplo** (nivelamento e contranivelamento) a partir de RN oficiais.
- 5.5.2.3 — Miras aos pares e equidistantes, alternância ré/vante; número de lances par (conveniente).
- 5.5.2.4 — Miras verticalizadas, sobre chapas/pinos/sapatas, nunca no solo.
- 5.5.2.5 — Nível óptico: ler os **três fios** em todas as leituras.
- 5.5.2.6 / 5.5.2.11 — Controle seção a seção e acumulado na linha/circuito.
- 5.5.2.7 — Linha aberta exige contranivelamento.
- 5.5.2.8 — Transporte: seção de duplo nivelamento ou circuito, origens em RN distintas do SGB; **PS a cada 1,0 km em média**; visada ≤ 80 m; visada a ≥ **30 cm** de qualquer superfície.
- 5.5.2.12 — Ajustamento: distribuição proporcional às distâncias **ou** MMQ.

## 3.3 Nivelamento trigonométrico — Tabela 6

| Classe / método | Instrumento | Visada máxima | Tolerância | Finalidade |
|---|---|---|---|---|
| II N Trigonométrico | Teodolito/ET classe 1, **duas séries** de ângulos verticais (ré e vante) | 300 m | **120 mm √K** | Poligonal principal |
| II N Trigonométrico | Teodolito/ET classe 2, **uma série** (ré e vante) | 200 m | **200 mm √K** | Rede em área rural; poligonal secundária; irradiação |
| III N Taqueométrico | Taqueômetro ou teodolito classe 4 | 80 m | — | Irradiação |

Condições:
- 5.2.10 — Ângulos verticais em séries conjugadas (PD e PI).
- 5.2.11 — Rejeitar séries afastadas da média > 3× a precisão nominal.
- 5.5.3 — Medir i e h; no taqueométrico ler os três fios; estação livre dispensa i e h constantes.
- 5.5.3.1 — Visadas > 300 m só sobre água ou terreno com inclinação > 30 %; **visadas > 125 m: considerar curvatura e refração e usar visadas recíprocas e simultâneas**.

## 3.4 Outras disposições usadas pelo programa

| Item | Conteúdo | Uso no programa |
|---|---|---|
| 5.5.1.1–5.5.1.4 | Altitude normal; vinculação ao SGB | Campo "tipo de altura" (cota / altitude normal) |
| 5.5.4, Anexo G | Altitude normal a partir de GNSS | Módulo auxiliar |
| 5.6.1 | $d_h = d_i\cos\alpha = d_i \sin z$ | Redução ao horizonte |
| 5.6.7 | Coordenadas/altitudes devem vir com desvio-padrão | Toda saída traz σ |
| 5.6.8, Anexo L | Propagação simplificada em redes | Doc 4 |
| 5.8 g | Relatório com memória de cálculo das linhas de nivelamento | Etapa 11 |
| 7.3 / 7.3.1 | Aceitação altimétrica: discrepâncias ≤ 3× a precisão em **90 %** dos pontos de inspeção | Módulo "Inspeção" (etapa 12, opcional) |
| Tabela 7 | Amostragem: até 500 pts → 3 % (mín. 10); 501–1000 → 2 % (mín. 15); > 1000 → 1 % (mín. 30) | Idem |
| Anexo C | $e_d = \sqrt{Z^2 + (k\cdot D)^2}$ | Precisão de distância (doc 4) |

## 3.5 Diferenças em relação à edição de 1994 (somente informativo)

Valores citados nas apostilas AA/IA, usados apenas na tela "Sobre" para explicar por que os resultados diferem das apostilas:

| Item | NBR 1994 (apostilas) | NBR 2021 (programa) |
|---|---|---|
| Geométrico para RN de apoio | IN: 12 mm √K | 6 / 8 / 12 mm √K conforme classe do nível |
| Geométrico em circuito/poligonal | IIN: 20 mm √K | idem acima |
| Classes de nível | 1 = baixa … 4 = muito alta | 1 = ≤ 1 mm/km … 4 = > 6 mm/km |
| Diferença ré–vante | ≤ 10 m | "equidistantes" (sem valor) |
| Altura mínima da visada | 50 cm | 30 cm de qualquer superfície |
| PS no transporte | a cada 1 km (IN) / 2 km (IIN) | média de 1,0 km |
| Curvatura e refração (trig.) | DH > 150 m | DH > 125 m, com visadas recíprocas |

## 3.6 Estrutura proposta de `data/norma_nbr13133_2021.json`

```json
{
    "rotulo": "ABNT NBR 13133:2021",
    "geometrico": [
      {"id": "IN-1", "rotulo": "I N — nível classe 1 — transporte de altitude", "classeNivelMax": 1, "visadaMax_m": 80, "tol_mm_raizK": 6},
      {"id": "IN-2", "rotulo": "I N — nível classe 2 — rede urbana", "classeNivelMax": 2, "visadaMax_m": 80, "tol_mm_raizK": 8},
      {"id": "IN-3", "rotulo": "I N — nível classe 3 — poligonal principal", "classeNivelMax": 3, "visadaMax_m": 80, "tol_mm_raizK": 12}
    ],
    "trigonometrico": [
      {"id": "IIN-1", "rotulo": "II N — ET classe 1, duas séries", "classeETMax": 1, "series": 2, "visadaMax_m": 300, "tol_mm_raizK": 120},
      {"id": "IIN-2", "rotulo": "II N — ET classe 2, uma série", "classeETMax": 2, "series": 1, "visadaMax_m": 200, "tol_mm_raizK": 200},
      {"id": "IIIN", "rotulo": "III N — taqueométrico", "visadaMax_m": 80, "tol_mm_raizK": null}
    ],
    "alturaMinVisada_m": 0.30,
    "difReVanteMax_m": 10,
    "curvRefracaoAcima_m": 125,
    "R_m": 6371000,
    "k": 0.13,
    "classesNivel_mm_km": [1, 2, 6, null],
    "classesET": [{"ang_s": 2, "lin": [1, 1]}, {"ang_s": 5, "lin": [2, 2]}, {"ang_s": 10, "lin": [3, 3]}]
}
```
