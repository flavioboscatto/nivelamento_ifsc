# 2. Métodos de Nivelamento e Formulação Matemática

Fontes: apostilas *Introdução à Altimetria* (IA) e *Altimetria Aplicada* (AA), IFSC 2018, e ABNT NBR 13133:2021 (NBR). Cada fórmula indica a origem. Unidades: metros, salvo indicação. Fórmulas em LaTeX (renderizadas pelo GitHub).

## 2.1 Convenções e definições

| Termo | Definição (NBR 3 / AA) | Símbolo no código |
|---|---|---|
| Desnível | Diferença de altura entre dois pontos; positivo = aclive | `dn` |
| Cota | Altura em relação a superfície arbitrária | `H` |
| Altitude normal | Altura referida ao SGB (Imbituba/Santana); NBR 2021 usa $H^N$ | `H` + `tipoAltura='normal'` |
| RN | Referência de nível (altura conhecida) | `RN` |
| PS | Ponto de segurança materializado | `PS` |
| Lance | Desnível entre duas miras (uma estação do nível) | `lance` |
| Seção | Trecho entre duas RN (ou RN–PS) | `secao` |
| Linha | Conjunto de seções entre duas RN principais | `linha` |
| Circuito | Poligonal altimétrica fechada | `circuito` |
| APV (AI) | Altura do plano de visada | `apv` |
| Ré | Leitura em ponto de altura conhecida | `re` |
| Vante | Leitura em ponto de altura a determinar | `vante` |
| Vante de mudança | Vante que será ré na estação seguinte | `tipo='mudanca'` |
| Irradiado (Irad.) | Ponto de detalhe visado da estação (não é mudança); nas apostilas, "vante intermediária" | `tipo='irradiado'` |

**Regra de projeto:** o programa sempre informa se o resultado é **cota** (referência arbitrária) ou **altitude** (referência oficial). A escolha é do usuário no cabeçalho do levantamento.

## 2.2 Nivelamento geométrico

### 2.2.1 Cálculo básico (IA 4.7; AA Eq. 1–2; NBR F.2)

$$APV_i = H_{ré} + L_{ré}$$
$$H_{vante} = APV_i - L_{vante}$$

Forma direta por lance: $\Delta h = L_{ré} - L_{vante}$, $H_{vante} = H_{ré} + \Delta h$.

### 2.2.2 Leitura com três fios (nível óptico — NBR 5.5.2.5)

- Fio médio calculado: $FM_{calc} = (FS + FI)/2$.
- Verificação: $|FM - FM_{calc}| \le t_{3fios}$ (padrão configurável; proposta 2 mm — ver decisão D8 do plano).
- Distância estadimétrica horizontal (luneta horizontal): $DH = C \cdot (FS - FI)$, com $C = 100$.

### 2.2.3 Verificação aritmética da caderneta (conferência obrigatória)

$$\sum L_{ré} - \sum L_{vante\,(mudanças\ e\ final)} = H_{final} - H_{inicial}$$

Leituras intermediárias **não** entram nesta soma. Discrepância > 0,0005 m indica erro de digitação ou de cálculo.

### 2.2.4 Nivelamento de detalhes por irradiação (AA "Nivelamento de Detalhes")

De uma mesma estação, uma ré na RN e várias vantes intermediárias. Sem controle de fechamento: o programa deve alertar que **não há verificação** e recomendar a leitura de um ponto de controle.

### 2.2.5 Transporte de RN — nivelamento e contranivelamento (AA "Transporte de RN"; NBR 5.5.2.2–5.5.2.8)

1. Calcula-se o nivelamento (ida) RN₁ → … → RN₂ e o contranivelamento (volta) RN₂ → … → RN₁, ou uma caderneta contínua que parte e chega em RN₁.
2. Erro de fechamento (AA Eq. 6):
$$e = H_{RN_1}^{chegada} - H_{RN_1}^{conhecida} = \Delta h_{ida} + \Delta h_{volta}$$
3. Extensão nivelada em **um único sentido**:
$$K = \frac{\sum DH_{ida}}{1000}\quad(km)$$
   A apostila usa a soma das distâncias ré + vante do nivelamento (ida). O programa mostra também a extensão do contranivelamento e alerta se diferirem mais de 10 %.
4. Tolerância: $T = t_{classe}\sqrt{K}$ (mm), com $t_{classe}$ conforme a classe escolhida ([doc 3](03_PARAMETROS_NBR13133.md)).
5. Aceite: $|e| \le T$.
6. Altura corrigida do ponto de chegada (AA Eq. 17–19) = média dos desníveis de ida e volta:
$$\overline{\Delta h} = \frac{\Delta h_{ida} - \Delta h_{volta}}{2}\qquad H_{RN_2} = H_{RN_1} + \overline{\Delta h}$$
   Equivale a corrigir a altura da ida em $-e/2$.
7. Controle **seção a seção** (entre RN e PS) e **acumulado na linha** (NBR 5.5.2.6 e 5.5.2.11): o programa calcula erro e tolerância para cada seção e para a linha completa.

### 2.2.6 Circuito fechado (AA "Circuito")

Parte e chega na mesma RN.

- Erro: $e = H_{RN}^{calculada} - H_{RN}^{conhecida}$.
- $K$ = perímetro total percorrido (km). Na apostila: soma de todas as distâncias das visadas de ré e de vante de mudança (Tabela 9: 718,254 m).
- Tolerância e aceite como em 2.2.5.

### 2.2.7 Linha apoiada em duas RN distintas

$e = H_{RN_B}^{calculada} - H_{RN_B}^{conhecida}$; mesma rotina de tolerância e distribuição do circuito.

### 2.2.8 Distribuição do erro de fechamento

O programa oferece três métodos, com o método escolhido registrado no relatório:

**(a) Por estação — método da apostila (AA Eq. 24–26)** — opção didática; não prevista na NBR 2021 (o relatório indica isso)
$$C = \frac{e}{n_{estações}}\qquad H_{corr} = H_{calc} - N \cdot C$$
$N$ = ordem da estação de onde o ponto foi visado (1, 2, …, n). Pontos visados da estação N recebem $-N\cdot C$. A apostila arredonda $C$ a 0,1 mm; o programa deve usar $C$ sem arredondamento e arredondar só a saída (ver errata no doc 7).

**(b) Proporcional à distância — NBR 5.5.2.12 (padrão)**
$$v_P = -e\cdot\frac{d_{acum}(P)}{d_{total}}$$
$d_{acum}(P)$ = distância acumulada das visadas de mudança até a estação que visou P, mais a visada até P (para pontos intermediários). Decisão D3 do plano define o padrão.

**(c) Mínimos quadrados — NBR 5.5.2.12** (etapa 12, redes com mais de um circuito/RN)
Modelo paramétrico: observações $\Delta h_{ij}$ entre nós; incógnitas $H$ dos nós desconhecidos; pesos $p_{ij} = 1/K_{ij}$ (K em km) ou $p = 1/\sigma^2_{\Delta h}$.
$$\mathbf{A}\,\mathbf{x} = \mathbf{l} + \mathbf{v},\quad \mathbf{x} = (\mathbf{A}^T\mathbf{P}\mathbf{A})^{-1}\mathbf{A}^T\mathbf{P}\mathbf{l},\quad \hat\sigma_0^2 = \frac{\mathbf{v}^T\mathbf{P}\mathbf{v}}{n-u},\quad \Sigma_x = \hat\sigma_0^2(\mathbf{A}^T\mathbf{P}\mathbf{A})^{-1}$$
Pontos intermediários (não nós) recebem correção por interpolação linear da correção dos nós adjacentes.

### 2.2.9 Verificações de campo automáticas (alertas, não bloqueiam o cálculo)

| Verificação | Limite | Origem |
|---|---|---|
| Visada máxima | 80 m | NBR Tabela 5 / 5.5.2.8 |
| Equidistância ré–vante (mudanças) | diferença ≤ 10 m (alerta configurável; a NBR 2021 exige "equidistantes" sem fixar valor) | NBR 5.5.2.3 |
| Altura mínima da visada | leitura ≥ 0,30 m | NBR 5.5.2.8 |
| Número de lances par | recomendação | NBR 5.5.2.3 |
| Três fios coerentes | ver 2.2.2 | NBR 5.5.2.5 |
| Extensão ida x volta | diferença ≤ 10 % | critério do programa |
| PS a cada 1 km (média) | transporte de altitude | NBR 5.5.2.8 |

### 2.2.10 Curvatura e refração no geométrico (AA "Coeficientes")

Com visadas equidistantes, o efeito se anula. Para visadas extremas (ré ≠ vante), efeito por visada $c_r = (1-k)\,DH^2/(2R)$; o programa mostra o efeito residual $c_r(DH_{ré}) - c_r(DH_{vante})$ apenas como informação (abaixo de 1 mm para DH < 120 m, AA p. 31).

### 2.2.11 Distâncias calculadas e exibidas (D22)

As apostilas trazem a coluna "Distância" em todas as cadernetas e usam as somas no cálculo da tolerância (ex.: "Distâncias percorridas — nivelamento 383,132 m; contranivelamento 368,548 m" nas respostas dos Exercícios I e II da AA). Por isso o programa calcula e mostra:

| Distância | Como é obtida | Onde aparece |
|---|---|---|
| DH de cada visada (ré, vante, intermediária) | digitada (nível digital, trena) **ou** calculada pela estadimetria $DH = 100\,(FS - FI)$ quando o aluno digita os três fios | coluna da caderneta (valor calculado em itálico, com indicação "estadimetria") |
| Diferença ré − vante por estação | $DH_{ré} - DH_{vante}$ (mudanças) | coluna de controle da equidistância, com alerta acima de 10 m |
| Distância da estação (lance) | $DH_{ré} + DH_{vante}$ | resumo por estação |
| Distância acumulada | soma dos lances até o ponto | coluna; usada na distribuição proporcional e na propagação (4.3.6) e no eixo do perfil |
| Extensão da seção / linha / circuito | soma das DH de ré e vante de mudança | resumo; vira **K** em km na tolerância |
| Extensão do nivelamento e do contranivelamento | somas separadas por sentido | resumo do transporte de RN, com diferença percentual |
| Distância média DHm | $(DH_{ré} + DH_{vante})/2$ | memória de cálculo da propagação (NBR F.1) |

No nivelamento trigonométrico e na taqueometria: DH, DV ($D_i\cos Z$ ou $DH\cot Z$), distância inclinada $D_i$, soma das DH da poligonal (K) e, quando houver coordenadas, a distância calculada entre pontos — todas em colunas próprias.

Leituras intermediárias entram na distância da estação apenas para informação; **não** entram em K (convenção das apostilas: Tabela 9 soma só ré e vantes de mudança — 718,254 m).

## 2.3 Nivelamento trigonométrico

### 2.3.1 Equação fundamental (IA 5.6 Eq. 8.1–8.9; NBR Anexo I)

Com distância horizontal:
$$DN = H_{visado} - H_{estação} = DH\cdot\cot Z + i - h + c_r$$
Com distância inclinada (estação total):
$$DH = D_i\sin Z\qquad DN = D_i\cos Z + i - h + c_r$$
Com ângulo de inclinação $\alpha = 90° - Z$: $DN = DH\tan\alpha + i - h + c_r$ (NBR 5.6.1).

$i$ = altura do instrumento; $h$ (ou $s$) = altura do sinal (prisma/mira).

### 2.3.2 Correção de curvatura e refração

$$c_r = \frac{(1-k)}{2R}\,DH^2$$

| Parâmetro | IA (apostila) | NBR Anexo I | NBR 5.6.2 | Padrão do programa |
|---|---|---|---|---|
| $R$ | 6 400 km | 6 360 000 m (lat. 62° S) | 6 371 000 m | **6 371 000 m** (editável) |
| $k$ | 0,13 | 0,13 | — | **0,13** (editável) |
| Aplicar a partir de | DH > 150 m | — | DH > 125 m (5.5.3.1) | **125 m** (NBR 2021) |

O programa calcula $c_r$ sempre e mostra a coluna; aplica automaticamente acima do limiar (ou sempre, se o usuário marcar).

Valores de referência ($R$ = 6 371 km, $k$ = 0,13): 80 m → 0,4 mm; 125 m → 1,1 mm; 150 m → 1,5 mm; 300 m → 6,1 mm; 500 m → 17,1 mm.

### 2.3.3 Séries conjugadas PD/PI (NBR 5.2.10)

Para cada visada com posição direta (PD) e inversa (PI):
$$Z = \frac{Z_{PD} - Z_{PI} + 360°}{2}\qquad \varepsilon_{índice} = \frac{Z_{PD} + Z_{PI} - 360°}{2}$$
Distância: média de $D_i$ das duas posições. Várias séries: média das séries; rejeitar, uma de cada vez, séries que se afastem da média mais de 3× a precisão nominal (NBR 5.2.11).

### 2.3.4 Visadas recíprocas (NBR 5.5.3.1 e Anexo H)

Obrigatório para visadas > 125 m. Com observações ida (A→B) e volta (B→A), quase simultâneas:
$$\Delta h_{AB} = \frac{\Delta h_{A\to B} - \Delta h_{B\to A}}{2}$$
onde cada $\Delta h$ é calculado **sem** $c_r$ — o efeito se cancela. O programa mostra também a diferença $\Delta h_{A\to B} + \Delta h_{B\to A}$ como controle (≈ $2c_r$ + erros).

Forma do Anexo H (zênite centrado): $\Delta z = \Sigma\cdot 206265\cdot \sin^2 z / D$, com $\Sigma = (\text{esfericidade+refração}) + (i - s)$; $\delta z = -\tfrac12(Z^x_{avante} + Z^x_{ré} - 180°)$. Implementar como alternativa didática, conferindo com Tabela H.1 (ΔH = 3,943 m; f = 3 mm).

### 2.3.5 Poligonal altimétrica trigonométrica (classe II N)

Encadeamento de estações com ré/vante (ou estação livre, NBR 5.5.3): $H_{n+1} = H_n + DN$. Fechamento, tolerância ($120\sqrt K$ ou $200\sqrt K$ mm) e distribuição como em 2.2.6–2.2.8, com $K$ = soma das DH (km).

## 2.4 Estadimetria e taqueometria (classe III N)

### 2.4.1 Estadimetria (AA Eq. 29–35)

$S = FS - FI$ (número gerador), $C = d/s = 100$.
- Luneta horizontal: $DH = C\cdot S$
- Visada inclinada: $DH = C\cdot S\cdot \sin^2 Z$
- Distância vertical: $DV = \tfrac12\, C\cdot S\cdot \sin 2Z = DH\cot Z$

### 2.4.2 Nivelamento taqueométrico (AA Eq. 37–40)

$$DN = DH\cot Z + i - FM\qquad H_P = H_E + DN$$
$$X_P = X_E + DH\sin Az\qquad Y_P = Y_E + DH\cos Az$$
Se o ângulo horizontal foi zerado em uma direção de referência, $Az = Az_{ref} + Hz$ (reduzido a 0–360°).

## 2.5 Estatística de observações repetidas (AA Exemplo I)

$$\bar x = \frac{\sum x_i}{n}\quad v_i = \bar x - x_i\quad s = \sqrt{\frac{\sum v_i^2}{n-1}}\quad s_{\bar x} = \frac{s}{\sqrt n}$$
Resultado: $\bar x \pm s_{\bar x}$.

Detecção de observação atípica: critério proposto $|v_i| > 3s$ calculado **sem** a observação testada (com 10 observações, o 3s com todas pode mascarar o outlier), removendo uma de cada vez e recalculando (análogo a NBR 5.2.11). Alternativa configurável: limite fixo (3× precisão nominal). A apostila decide visualmente pelo gráfico — o programa reproduz o gráfico (observações + linha da média).

## 2.6 Altitude normal a partir de GNSS (NBR 5.5.4 e Anexo G) — módulo auxiliar

Absoluta: $H^N \cong h - \zeta$, $\sigma_H = \sqrt{\sigma_h^2 + \sigma_\zeta^2}$.
Relativa: $\Delta\zeta = \zeta - \zeta_{RN}$, $H^N \cong h + H^N_{RN} - h_{RN} - \Delta\zeta$,
$\sigma_H = \sqrt{\sigma_h^2 + \sigma_{H_{RN}}^2 + \sigma_{h_{RN}}^2 + (\sigma_{\Delta\zeta}\cdot D\cdot 10^{-6})^2}$, com $D$ ≤ 35 km.

## 2.7 Conversões angulares

- Sexagesimal ↔ decimal: $g = G + M/60 + S/3600$.
- Grado (gon): $g = gon\cdot 0{,}9$.
- Radianos para cálculo; segundos → rad: $\times \pi/648000$.
- **Entrada nas cadernetas (D33): sempre sexagesimal, no formato GG,MMSS** dos equipamentos (`91,1940` = 91°19'40"; `91,19405` = 91°19'40,5"); também `91°19'40"` e `91 19 40`. Graus decimais e grados não são aceitos na interface (o núcleo `parseAngulo` ainda os converte, só para uso interno e testes).

## 2.8 Representação numérica

- Cálculo em `Number` (float64 do JavaScript) sem arredondamento intermediário.
- Saída: alturas e leituras 3 casas (mm); correções 4 casas; tolerâncias e erros em mm com 1 casa; ângulos em segundos inteiros (ou décimos, se a entrada tiver).
- Vírgula decimal em toda a interface e nas exportações CSV (`;` como separador).
