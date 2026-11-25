# 4. Propagação de Precisões (Variâncias)

A NBR 13133:2021 exige que alturas e coordenadas sejam apresentadas com desvio-padrão (5.6.7) e admite a propagação **simplificada** (Anexos E, F e L) ou rigorosa (matricial). O programa implementa a simplificada da norma como padrão e a forma geral (lei de propagação) para os casos que a norma não cobre, sempre indicando no relatório qual foi usada.

## 4.1 Lei geral de propagação

Para $y = f(x_1, \dots, x_n)$ com observações não correlacionadas:
$$\sigma_y^2 = \sum_{j=1}^{n}\left(\frac{\partial f}{\partial x_j}\right)^2\sigma_{x_j}^2$$
Forma matricial (usada no MMQ): $\Sigma_y = \mathbf{J}\,\Sigma_x\,\mathbf{J}^T$.

Unidades: ângulos sempre em **radianos** dentro da fórmula: $\sigma_{rad} = \sigma'' \cdot \pi/648000$.

## 4.2 Precisão dos instrumentos (entradas)

### 4.2.1 Distância com MED/estação total — NBR 4.2.5.1 e Anexo C

$$e_d = \sqrt{Z^2 + (k\cdot D)^2}\quad\text{(mm; Z em mm; k em ppm; D em km)}$$
Exemplo C.2: 3 mm + 3 ppm, D = 750 m → $e_d$ = ±3,75 mm.

> A ficha técnica costuma dar "a + b ppm" como soma; a norma combina quadraticamente. O programa usa a forma da norma e mostra a nota.

### 4.2.2 Leitura de mira no nível — NBR F.1/F.2

$$\sigma_L = \frac{\sigma_{leitura}}{d_{ref}}\quad(\text{m/m})$$
Ex.: Leica Sprinter, 0,6 mm a 30 m (leitura eletrônica) → $\sigma_L$ = 0,00002 m/m. Leitura óptica no Sprinter: 1,2 mm a 30 m.

Alternativa a partir do desvio-padrão por km de duplo nivelamento ($\sigma_{km}$, Tabela 3):
$$\sigma_{\Delta h} = \sigma_{km}\sqrt{K}$$
O programa oferece as duas formas; padrão = forma da NBR F.1 (quando houver $\sigma_L$ cadastrado).

### 4.2.3 Ângulo zenital

$\sigma_Z$ = precisão nominal da ET (Tabela 1/2). Média de PD e PI: $\sigma_{Z,média} = \sigma_Z/\sqrt{2}$ (opção, desligada por padrão — a NBR F.4 usa o nominal).

### 4.2.4 Alturas do instrumento e do sinal

NBR F.3 adota ±2 mm para cada uma → $\sigma_i^2 + \sigma_h^2 = 0{,}000008$ m². Campos editáveis (padrão 2 mm).

## 4.3 Nivelamento geométrico

### 4.3.1 Irradiação — NBR F.1

$$\sigma_{H_V} = \pm\sqrt{\sigma_{H_R}^2 + 2\,(\sigma_L\cdot DH_m)^2}\qquad DH_m = \frac{DH_{ré} + DH_{vante}}{2}$$

Exemplo F.2: $H_{RN80}$ = 9,315 ± 3,4 mm; DH ré 60,325, vante 55,078; $\sigma_L$ = 0,00002 → $H_{A1}$ = 9,139 ± 3,8 mm.

Para vante intermediária sem equidistância, o programa usa a forma não simplificada (mais correta, mesma ordem de grandeza):
$$\sigma_{H_V}^2 = \sigma_{H_R}^2 + (\sigma_L DH_{ré})^2 + (\sigma_L DH_{vante})^2$$
(Com $DH_{ré} = DH_{vante}$ coincide com F.1.) Decisão de qual exibir: D10 do plano.

### 4.3.2 Encadeamento (linha, circuito) antes do ajustamento

Cada mudança herda a variância da anterior:
$$\sigma_{H_n}^2 = \sigma_{H_{RN}}^2 + \sum_{j=1}^{n}2\,(\sigma_L\cdot DH_{m,j})^2$$
Ou, pela forma por km: $\sigma_{H_n}^2 = \sigma_{H_{RN}}^2 + \sigma_{km}^2 K_n$.

### 4.3.3 Fechamento esperado e coerência da tolerância

Desvio-padrão esperado do erro de fechamento: $\sigma_e = \sigma_{km}\sqrt{K_{total}}$. O programa informa a razão $|e|/\sigma_e$ (indicador didático: > 3 sugere erro grosseiro) além do teste de tolerância da norma.

### 4.3.4 Média de nivelamento e contranivelamento

$\overline{\Delta h} = (\Delta h_{ida} - \Delta h_{volta})/2$:
$$\sigma_{\overline{\Delta h}}^2 = \tfrac14(\sigma_{ida}^2 + \sigma_{volta}^2)\ \Rightarrow\ \sigma_{H_{RN_2}}^2 = \sigma_{H_{RN_1}}^2 + \sigma_{\overline{\Delta h}}^2$$

### 4.3.5 Após distribuição proporcional / por estação

A distribuição do erro combina os dois sentidos do circuito/linha; a variância resultante é dada em 4.3.6 (forma rigorosa) e comparada à do Anexo L (4.6).

### 4.3.6 Circuito e linha entre duas RN — proposta combinando os dois sentidos (D16)

**Ideia.** Num circuito, cada ponto está ligado à RN por **dois caminhos**: o percorrido até ele (como a ida de um transporte de RN) e o restante do circuito até voltar à RN (como o contranivelamento). Após a distribuição do erro, a altura do ponto é uma combinação dos dois caminhos, e as variâncias se combinam como **resistências em paralelo**.

Notação (tudo em m²):
- $V_j$ = variância de cada estação (lance) $j$ da caderneta:
  - pela leitura (NBR F.1): $V_j = (\sigma_L\,DH_{ré,j})^2 + (\sigma_L\,DH_{vante,j})^2 \;\approx\; 2(\sigma_L DH_{m,j})^2$
  - ou pelo σ por km: $V_j = \sigma_{km}^2\cdot K_j$, com $K_j = (DH_{ré,j} + DH_{vante,j})/1000$
- $V_a(P) = \sum_{j \le n_P} V_j$: variância acumulada da RN até o ponto de mudança P (caminho de **ida**).
- $V_T = \sum_{todas} V_j$: variância do circuito completo ($\sigma_e^2$, desvio-padrão esperado do erro de fechamento).
- $V_T - V_a(P)$: caminho de **volta** (restante do circuito).

**(a) Circuito fechado — mesma RN no início e no fim**

$$\boxed{\sigma_{H_P}^2 = \sigma_{H_{RN}}^2 + \frac{V_a(P)\,\big(V_T - V_a(P)\big)}{V_T}}$$

O termo da RN entra inteiro porque os dois caminhos partem da mesma RN (o erro dela é comum, não se reduz). Com o σ por km e distâncias acumuladas $d$ num circuito de perímetro $L$ (km):
$$\sigma_{H_P}^2 = \sigma_{H_{RN}}^2 + \sigma_{km}^2\,\frac{d\,(L-d)}{L}$$
O máximo ocorre no meio do circuito: $\sigma^2_{máx} = \sigma_{RN}^2 + \sigma_{km}^2 L/4$.

**(b) Linha entre duas RN distintas (A e B)**

Cada caminho carrega o erro da sua RN:
$$V_1 = \sigma_{H_A}^2 + V_a(P)\qquad V_2 = \sigma_{H_B}^2 + \big(V_T - V_a(P)\big)\qquad \sigma_{H_P}^2 = \frac{V_1\,V_2}{V_1 + V_2}$$

**(c) Transporte com nivelamento e contranivelamento** (caso particular, já em 4.3.4)
$$\sigma_{H_{RN_2}}^2 = \sigma_{H_{RN_1}}^2 + \tfrac14\left(V_{ida} + V_{volta}\right)$$

**(d) Pontos intermediários (irradiados) de uma estação $j$**

Não participam do fechamento; herdam o σ do ponto de ré da estação e somam a própria irradiação (F.1 sem simplificação):
$$\sigma_{H_I}^2 = \sigma_{H_{ré,j}}^2 + (\sigma_L DH_{ré,j})^2 + (\sigma_L DH_I)^2$$

**(e) Comparação com o Anexo L (modo simplificado da norma)**

O Anexo L adota, por vértice, o menor σ entre os dois sentidos: $\sigma^2_L = \sigma_{RN}^2 + \min(V_a, V_T - V_a)$. Como $\frac{V_a(V_T-V_a)}{V_T} \le \min(V_a, V_T-V_a)$, a fórmula (a) dá sempre valor **menor ou igual** — o que confirma o texto da norma de que o Anexo L é "mais conservador". A fórmula (a) é o resultado exato do ajustamento de um circuito único por MMQ com pesos $1/V_j$ (para a distribuição proporcional à distância, coincide quando $V_j \propto DH$).

O programa mostrará as duas colunas (rigorosa e Anexo L), e o relatório informará qual foi adotada.

**Exemplo — circuito da AA Tabela 9 (caso G06), σ_RN = 0 (cota arbitrária)**

σ por leitura NBR F.1 (Sprinter, σ_L = 0,00002 m/m) e σ por km (1,5 mm/km), em mm:

| Ponto de mudança | Ida √Va | Volta √(VT−Va) | Anexo L | Fórmula (a) — leitura | Fórmula (a) — 1,5 mm/km |
|---|---|---|---|---|---|
| A1 | 1,69 | 3,49 | 1,69 | 1,52 | 0,47 |
| A2 | 2,15 | 3,22 | 2,15 | 1,79 | 0,58 |
| A3 | 2,75 | 2,73 | 2,73 | 1,94 | 0,63 |
| PS1 | 2,99 | 2,46 | 2,46 | 1,90 | 0,63 |
| A4 | 3,31 | 2,01 | 2,01 | 1,72 | 0,57 |
| A5 | 3,60 | 1,43 | 1,43 | 1,33 | 0,44 |
| RN2 | 3,87 | 0,00 | 0,00 | 0,00 | 0,00 |

Ponto intermediário 14 (estação f, ré A4 a 51,436 m, visada 12,356 m): σ = 2,02 mm.
σ esperado do fechamento: √VT = 3,87 mm (leitura) ou 1,5√0,718 = 1,27 mm (por km).

> **Decisão D17:** as duas fontes de σ do nível diferem cerca de 3×. A forma da NBR F.1 (0,6 mm por leitura a 30 m, crescendo linearmente com a distância) é mais conservadora; a forma por km (ISO 17123-2, ficha técnica) é a que caracteriza a classe do nível. Proposta: usar a da NBR F.1 como padrão (é a da norma) e mostrar a outra como referência.

Estes valores entram como caso de teste **P01** em `tests/casos_referencia.json`.

### 4.3.7 Após MMQ (etapa 12)

$\Sigma_{\hat x} = \hat\sigma_0^2(\mathbf A^T\mathbf P\mathbf A)^{-1}$; reportar $\hat\sigma_0^2$ e teste qui-quadrado (informativo).

## 4.4 Nivelamento trigonométrico

### 4.4.1 Forma simplificada da norma — NBR F.3

$$\sigma_{H_V} = \pm\sqrt{\sigma_{H_I}^2 + 0{,}000008 + (\cos Z)^2\,\sigma_{D_i}^2 + (D_i\sin Z)^2\left(\sigma_Z\frac{\pi}{648000}\right)^2}$$

Exemplo F.4: $\sigma_{H_{E01}}$ = 0,023 m; Z = 90°03'11"; $D_i$ = 26,479 m; $\sigma_Z$ = 5"; $\sigma_{D_i}$ = 0,002 m → $\sigma_{H_{P20}}$ = ±0,0232 m.

### 4.4.2 Forma geral (derivação de $DN = D_i\cos Z + i - h + c_r$)

$$\sigma_{DN}^2 = \cos^2 Z\,\sigma_{D_i}^2 + (D_i\sin Z)^2\sigma_Z^2 + \sigma_i^2 + \sigma_h^2 + \left(\frac{DH^2}{2R}\right)^2\sigma_k^2$$
Com DH (distância horizontal dada): $\sigma_{DN}^2 = \cot^2 Z\,\sigma_{DH}^2 + \left(\frac{DH}{\sin^2 Z}\right)^2\sigma_Z^2 + \sigma_i^2 + \sigma_h^2 + \dots$

O termo de refração ($\sigma_k \approx 0{,}05$–$0{,}1$) só é relevante para visadas longas; incluir como opção.

### 4.4.3 Visadas recíprocas

$\sigma_{\Delta h}^2 = \tfrac14(\sigma_{\Delta h, ida}^2 + \sigma_{\Delta h, volta}^2)$, sem termo de refração.

### 4.4.4 Distância horizontal

$DH = D_i\sin Z$: $\sigma_{DH}^2 = \sin^2 Z\,\sigma_{D_i}^2 + (D_i\cos Z)^2\sigma_Z^2$.

## 4.5 Estadimetria / taqueometria

$DH = C\,S\sin^2 Z$, $S = FS - FI$, $\sigma_S = \sqrt2\,\sigma_{leit}$:
$$\sigma_{DH}^2 = (C\sin^2 Z)^2\sigma_S^2 + (C\,S\sin 2Z)^2\sigma_Z^2$$
$DN = \tfrac12 C S\sin 2Z + i - FM$:
$$\sigma_{DN}^2 = (\tfrac12 C\sin 2Z)^2\sigma_S^2 + (C\,S\cos 2Z)^2\sigma_Z^2 + \sigma_i^2 + \sigma_{FM}^2$$
$\sigma_{leit}$ padrão: 1 mm (estimativa do milímetro, IA 2.1.4) — editável. Coordenadas: $\sigma_X^2 = \sin^2 Az\,\sigma_{DH}^2 + (DH\cos Az)^2\sigma_{Az}^2$; $\sigma_Y^2 = \cos^2 Az\,\sigma_{DH}^2 + (DH\sin Az)^2\sigma_{Az}^2$.

## 4.6 Redes e poligonais altimétricas — Anexo L (modo simplificado)

1. Propagar do ponto conhecido para o vértice seguinte, usando o σ do vértice anterior + as medições ao novo vértice (L.1.2).
2. Com uma única base: propagar também no sentido contrário, iniciando no último vértice (L.1.3).
3. Com duas bases: propagar a partir da segunda base no sentido inverso (L.1.4).
4. Adotar, para cada vértice, o **menor** desvio-padrão entre as duas propagações (L.1.5–L.1.7).

Implementação: função `propagarDuplo(cadeia)` que roda a propagação nos dois sentidos e faz `min(σ_ida, σ_volta)` por vértice.

## 4.7 Estatística de séries

$s_{\bar x} = s/\sqrt n$ (AA Exemplo I). Resultado: $\bar x \pm s_{\bar x}$.

## 4.8 GNSS → altitude normal (Anexo G)

Ver 2.6. Exemplos G.1 (153,296 ± 171 mm) e G.2 (153,390 ± 149 mm) como testes.
