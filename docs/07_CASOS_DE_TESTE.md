# 7. Casos de Teste de Referência e Erratas

Valores **recalculados em 25/11/2026** (script Python independente) a partir dos dados das apostilas e da norma. Cada caso vira teste automatizado (`node --test`), com tolerância numérica de 0,0005 m para alturas e 0,05 mm para tolerâncias. Versão para máquina: `tests/casos_referencia.json`.

Siglas: AA = *Altimetria Aplicada*; IA = *Introdução à Altimetria*; NBR = NBR 13133:2021.

## 7.1 Geométrico

| ID | Fonte | Dados | Resultado esperado | Confere com a fonte? |
|---|---|---|---|---|
| G01 | NBR F.2 | RN80 = 9,315 ± 3,4 mm; ré 1,335 (DH 60,325); vante A1 1,511 (DH 55,078); σL = 0,0006/30 | H(A1) = 9,139 m; σ = 3,77 mm (3,8) | Sim |
| G02 | AA Tab. 4 (seção 1, ida+volta) | 9 estações a–i | chegada 9,320; e = +5,0 mm; K = 0,3788 km; T(12√K) = 7,39 mm → atende | Sim (7,4 mm) |
| G03 | AA Tab. 6 (linha) | — | e = +9 mm; K = 0,607; T = 9,35 mm; H(RN2) corr. = 6,914 | Sim |
| G04 | AA Ex. I transporte (Tab. 7) | partida RN1 = 9,315 | RN2 ida 8,656; volta 9,309; e = −6,0 mm; K = 0,383132 km; T = 7,43 mm; RN2 corr. = **8,659** | Sim |
| G05 | AA Ex. II transporte (Tab. 8) | partida RN1 = 132,459 | RN2 ida 133,865; volta 132,467; e = +8,0 mm; T(√0,453132) = 8,08 mm; RN2 corr. = **133,861** | Sim |
| G06 | AA Tab. 9/10 circuito | RN2 = 6,500, 7 estações | fecho 6,489; e = −11 mm; perímetro 718,254 m; T(20√K) = 16,95 mm; C = e/7 = −1,571 mm/estação; ponto 2 → 5,785; ponto 14 → 5,811 | Sim (ver E2) |
| G07 | AA Ex. III circuito (Tab. 11) | RN1 = 972,367, 5 estações | fecho 972,373; e = +6 mm; perím. 515,928; T = 14,37 mm; C = 1,2 mm | Sim |
| G08 | AA Ex. IV circuito (Tab. 12) | RN1 = 972,367, 6 estações | fecho 972,361; e = −6 mm; perím. 490,5; T = 14,01 mm; C = −1,0 mm | Sim |

Os valores de cálculo (alturas, erro, K, correções) conferem com as apostilas. As **tolerâncias** das apostilas (12√K e 20√K) são da NBR 1994; o programa usa somente a **NBR 13133:2021** (decisão D1). Tolerâncias esperadas pela Tabela 5 da NBR 2021:

| ID | Erro (mm) | K (km) | Classe 1 — 6√K | Classe 2 — 8√K | Classe 3 — 12√K |
|---|---|---|---|---|---|
| G02 | +5,0 | 0,3788 | 3,69 — não atende | 4,92 — não atende | 7,39 — atende |
| G03 | +9,0 | 0,6066 | 4,67 — não atende | 6,23 — não atende | 9,35 — atende |
| G04 | −6,0 | 0,3831 | 3,71 — não atende | 4,95 — não atende | 7,43 — atende |
| G05 | +8,0 | 0,4531 | 4,04 — não atende | 5,39 — não atende | 8,08 — atende |
| G06 | −11,0 | 0,7183 | 5,08 — não atende | 6,78 — não atende | 10,17 — **não atende** |
| G07 | +6,0 | 0,5159 | 4,31 — não atende | 5,75 — não atende | 8,62 — atende |
| G08 | −6,0 | 0,4905 | 4,20 — não atende | 5,60 — não atende | 8,40 — atende |

Observação didática: com o Sprinter (classe 2), nenhum dos exercícios das apostilas atenderia a NBR 2021; o circuito da Tabela 9 (G06), que atendia a IIN de 1994 (20√K = 16,95 mm), não atende nem a classe 3 de 2021. Sugere-se revisar os dados dos exercícios nas próximas edições das apostilas.

## 7.2 Estatística

| ID | Fonte | Resultado esperado |
|---|---|---|
| S01 | AA Exemplo I, 10 observações | média 12,7839; s = 0,0237; s média = 0,0075 |
| S02 | idem, sem a observação 7 (12,718) | média **12,7912**; s = 0,0056; s média = 0,0019 → **12,791 ± 0,002 m** |

## 7.3 Trigonométrico, estadimetria e taqueometria

| ID | Fonte | Resultado esperado |
|---|---|---|
| T01 | NBR F.4 | σH(P20) = ±0,0232 m (σ² = 0,0005374) |
| T02 | NBR Anexo H, Tab. H.1 | ΔH = 3,943 m; [Δh] = 3,946 m; f = 3 mm; T(12√K, K=0,5051) = 8,5 mm (o anexo usa 12√K) |
| T03 | NBR Anexo I, Tab. I.1 | H determinada nas 3 estações: 37,254 / 37,247 / 37,236; média 37,246 (implementar com R = 6 360 000 m como no anexo) |
| E01 | AA Exemplo II (estadimetria) | DH = 100 × 0,094 × sen²(91°19'40") = **9,395 m** |
| Q01 | AA Exercício V (taqueometria), estação 100: H = 40,034, X = 1000, Y = 5000, i = 1,57 | P12: DH 23,868; H 38,244; X 979,803; Y 4987,281 — P13: DH 31,775; H 41,494; X 972,828; Y 5016,471 — P14: DH 34,400; H 40,601; X 1028,366; Y 5019,460 — P15: DH 21,736; H 25,001; X 1004,306; Y 5021,305 |

Q01: a apostila não traz a resposta (página "Resposta do Exercício V" em branco). **Valores a conferir pelo professor** antes de virar teste definitivo.

## 7.4 Auxiliares

| ID | Fonte | Resultado esperado |
|---|---|---|
| A01 | NBR C.2 | e_d = 3,75 mm (3 mm + 3 ppm, 750 m) |
| A02 | NBR G.1 | H_B = 153,296 ± 171 mm |
| A03 | NBR G.2 | ver errata E4 |
| A04 | Curvatura/refração R = 6 371 km, k = 0,13 | 80 m → 0,437 mm; 150 m → 1,536 mm; 500 m → 17,070 mm |

## 7.5 Erratas e inconsistências encontradas

| Nº | Onde | Problema | Tratamento no programa |
|---|---|---|---|
| E1 | AA Exemplo I, conclusão | Texto diz **12,797 ± 0,002 m**; a Tabela 3 e o cálculo dão **12,791 ± 0,002 m** | Usar 12,791. Sugerir correção da apostila |
| E2 | AA Tab. 10 | C = 0,0016 m arredondado antes de multiplicar por N (ex.: N=7 → 0,0110; com C exato 0,0110 também). Diferenças de até 0,5 mm em pontos intermediários se o arredondamento for feito antes | Opção "arredondar C como a apostila" no modo de distribuição por estação, só para conferência |
| E3 | AA Tab. 9 | Linha `c A2 … 48,492` está rotulada como estação c, mas é a vante de mudança da estação b | O leitor de caderneta não depende do rótulo: usa a ordem ré→vantes |
| E4 | NBR G.2 | Dado h_A = 78,901 m, mas a substituição usa 78,907 m; com 78,901 o resultado é **153,396 m**, não 153,390 m (σ = 149 mm confere) | Teste usa 153,396 e registra a divergência |
| E5 | NBR F.4 | Na substituição numérica falta o fator $D_i$ no último termo; o resultado (0,0005370) está correto porque o termo é desprezível | Implementar a fórmula completa (com $D_i$) |
| E6 | NBR F.4 | Usa σ_Di = 0,002 m, embora a ET seja 2 mm + 2 ppm (pelo Anexo C daria 2,0007 mm) | Sem efeito no resultado |
| E7 | IA 5.6 x NBR 2021 | Apostila: correção de curvatura e refração para visadas > 150 m, R = 6 400 km; NBR 2021: > 125 m | Programa usa 125 m (2021); R padrão 6 371 km |
| E8 | IA 2.1.6 x NBR 2021 Tabela 3 | Classes de níveis invertidas entre edições | Rótulo sempre com mm/km |
| E10 | NBR Anexos H e I | Coeficiente escrito "68,398 × 10⁻¹² × D²"; com D em metros o correto é **68,398 × 10⁻⁹** (= 0,87 / (2 × 6 360 000)). Os valores tabelados (0,002 / 0,008 / 0,015 m) conferem com 10⁻⁹ | Usar $(1-k)/(2R)$; nunca a constante impressa |
| E9 | IA 4.1 / AA | "Leitura mínima 0,500" (1994) x 30 cm de qualquer superfície (2021 5.5.2.8) | Programa usa 30 cm (2021) |
