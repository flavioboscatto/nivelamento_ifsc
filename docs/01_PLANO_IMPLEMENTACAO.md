# 1. Plano de Implementação — Calculadora de Nivelamento IFSC

Versão 1.0 — 25/11/2026 — Responsável: Prof. Flavio Boscatto (coordenação do Curso Técnico em Agrimensura, IFSC Florianópolis).

## 1.1 Objetivo

Página web estática, usada em aula e em campo, que calcula nivelamentos geométricos, trigonométricos e taqueométricos:
1. com a mesma lógica das cadernetas e apostilas do curso;
2. com tolerâncias, classes e propagação de precisões **exclusivamente** da ABNT NBR 13133:2021 (as apostilas servem como fonte dos métodos e dos dados de teste);
3. importando dados do nível Leica Sprinter e das estações totais FOIF e Ruide RQS;
4. com processamento 100 % no navegador (nenhum dado sai da máquina);
5. com a identidade visual do site do curso.

## 1.2 Escopo

### 1.2.1 Organização do site (D18)

A página inicial explica o que o site faz e oferece **duas opções**:
1. **Nivelamento Geométrico** — irradiação, transporte de RN (nivelamento e contranivelamento), circuito fechado, linha entre duas RN.
2. **Nivelamento Trigonométrico** — irradiação, poligonal altimétrica, visadas recíprocas e taqueometria/estadimetria (como modo dentro do trigonométrico).

Estatística de séries e ferramentas auxiliares ficam como recursos de apoio (links secundários e na página "Sobre a norma"), sem disputar espaço com as duas opções principais.

### 1.2.2 Entrada de dados (D19)

**Em todos os módulos o aluno pode digitar os dados manualmente** numa caderneta editável, igual à de papel do IFSC. A importação de arquivos é uma alternativa que preenche a mesma caderneta, que continua editável depois. Requisitos da digitação:
- vírgula ou ponto decimal; ângulos em `91°19'40"`, `91 19 40` ou decimal;
- navegação por Tab/Enter, adicionar e remover linhas, colar um bloco copiado do Excel/LibreOffice;
- validação linha a linha com mensagem clara, sem perder o que foi digitado;
- rascunho salvo automaticamente no navegador e opção de salvar/abrir o projeto em arquivo.

### 1.2.3 Dentro do escopo (versão 1)

| Módulo | Conteúdo | Docs |
|---|---|---|
| Geométrico | irradiação/detalhes; transporte de RN (nivelamento e contranivelamento, seções com PS); circuito fechado; linha entre duas RN; 3 fios; verificações de campo; tolerância e classificação; distribuição do erro; σ por ponto; perfil | 2.2, 3.2, 4.3 |
| Trigonométrico | irradiação; PD/PI; curvatura e refração; visadas recíprocas; poligonal altimétrica com fechamento; σ por ponto | 2.3, 3.3, 4.4 |
| Taqueometria / estadimetria | DH, DN, H, X, Y a partir de FS/FM/FI, Z e Hz | 2.4, 4.5 |
| Estatística | média, desvio-padrão, desvio da média, resíduos, atípicos, gráfico | 2.5 |
| Ferramentas | conversor de ângulos; precisão de distância MED (Anexo C); c+r; GNSS → altitude normal (Anexo G) | 2.6, 2.7 |
| Importação | Leica Sprinter, FOIF, Ruide RQS, CSV genérico com mapeamento | 5 |
| Saídas | tabelas, perfil SVG, CSV, projeto JSON, relatório para impressão/PDF | 5.7, 6.6 |
| Modo aula | carregar exemplos/exercícios das apostilas; mostrar fórmulas e passo a passo | 7 |

### 1.2.4 Fora do escopo (versão 1)

Cálculo de poligonais planimétricas completas, curvas de nível/MDT, cálculo de volumes, contas de usuário e armazenamento em servidor. Podem entrar em versões futuras.

## 1.3 Arquitetura

### 1.3.1 Princípios

1. **Estático e sem build**: HTML + CSS + JavaScript (módulos ES nativos). Abre com qualquer servidor estático; sem Node no deploy. Facilita manutenção por professores que programam em Python.
2. **Núcleo de cálculo puro** (`src/core/`): funções sem DOM, testáveis com `node --test` — a mesma ideia de separar cálculo e interface usada nos projetos Python.
3. **Parâmetros de norma e instrumentos em JSON** (`data/`), nunca fixos no código.
4. **Sem bibliotecas obrigatórias.** Gráficos em SVG próprio; PDF via impressão do navegador. Biblioteca opcional (somente se necessário e com versão fixa, copiada em `vendor/`): SheetJS para ler/gerar `.xlsx`.
5. **Privacidade**: `FileReader` local; projetos salvos no `localStorage` (rascunho) e exportados como arquivo `.nivel.json`.
6. **Acessível e responsivo**: funciona em celular no campo; status nunca só por cor.

### 1.3.2 Por que JavaScript e não Python

O requisito é rodar no navegador sem servidor. Python no navegador (Pyodide/PyScript) exige baixar ~10 MB e demora para abrir em celular/rede de campo. JavaScript roda nativamente e o volume de cálculo é pequeno. A lógica será escrita de forma próxima ao Python (funções puras, nomes em português) para facilitar revisão.

### 1.3.3 Estrutura de pastas

```
00_Nivelamento/
├── index.html                 # página inicial: o que o site faz + 2 opções
├── geometrico.html            # modos: irradiação, transporte, circuito, linha
├── trigonometrico.html        # modos: irradiação, poligonal, recíprocas, taqueometria
├── apoio.html                 # estatística de séries e ferramentas auxiliares
├── sobre.html                 # norma, fórmulas, créditos, erratas
├── assets/
│   ├── css/  tokens.css  base.css  componentes.css  impressao.css
│   ├── img/  logo_agrimensura_branca.svg  logo_agrimensura.jpeg  favicon.svg
│   └── fontes/                # se a fonte do site for hospedada localmente
├── src/
│   ├── core/                  # SEM DOM — testável no Node
│   │   ├── numeros.js         # parseDecimal, formatar (vírgula), arredondar
│   │   ├── angulos.js         # DMS/decimal/gon/rad, PD-PI
│   │   ├── estatistica.js
│   │   ├── geometrico.js      # APV, cotas, verificação aritmética, transporte, circuito
│   │   ├── trigonometrico.js  # DN, c+r, recíprocas, poligonal altimétrica
│   │   ├── taqueometria.js    # estadimetria, DN, X, Y
│   │   ├── tolerancias.js     # perfis NBR, classificação, verificações de campo
│   │   ├── ajustamento.js     # distribuição por estação/distância; MMQ
│   │   ├── propagacao.js      # F.1, F.3, Anexo C, Anexo L, forma geral
│   │   └── gnss.js            # Anexo G
│   ├── io/
│   │   ├── csv.js             # leitor/gravador CSV tolerante (; , tab; vírgula/ponto)
│   │   ├── mapeador_csv.js
│   │   ├── leica_sprinter.js
│   │   ├── foif.js
│   │   ├── ruide_rqs.js
│   │   └── projeto.js         # .nivel.json
│   └── ui/
│       ├── layout.js          # cabeçalho/rodapé comuns
│       ├── caderneta.js       # tabela editável com navegação por teclado
│       ├── resumo.js          # painel de fechamento/tolerância
│       ├── perfil_svg.js
│       ├── relatorio.js
│       └── paginas/*.js       # um controlador por página
├── data/
│   ├── norma_nbr13133_2021.json
│   ├── instrumentos.json
│   └── exemplos/              # exercícios das apostilas em JSON (modo aula)
├── tests/
│   ├── casos_referencia.json
│   ├── dados/                 # arquivos de amostra dos equipamentos (anonimizados)
│   └── *.test.js
├── docs/                      # esta documentação
├── CLAUDE.md
└── README.md
```

### 1.3.4 Modelo de dados do levantamento

```js
{
  versao: 1,
  cabecalho: { servico, local, data, equipe:[], operador, instrumento:'sprinter150m',
               norma:'NBR13133_2021', classe:'IN-2', tipoAltura:'cota'|'altitude_normal',
               referencia:{ ponto:'RN1', H:9.315, sigma:0.0034 } },
  metodo: 'geom_irradiacao'|'geom_transporte'|'geom_circuito'|'geom_linha'|'trig_irradiacao'|'trig_poligonal'|'taqueometria',
  observacoes: [ /* ver doc 5.1 */ ],
  opcoes: { distribuicao:'estacao'|'distancia'|'mmq', aplicarCR:'auto'|'sempre'|'nunca', R:6371000, k:0.13 },
  resultados: { /* gerado, nunca editado à mão */ }
}
```

## 1.4 Etapas

Cada etapa: objetivo, arquivos, critério de aceite e teste manual. **Uma etapa por vez**, com validação do professor antes de seguir. Ao concluir, atualizar `CLAUDE.md` (seção de situação) e este plano.

### Etapa 0 — Repositório e publicação mínima — *push em 25/11/2026; publicação no Netlify pelo professor*
- **Objetivo:** repositório GitHub com esta documentação, `.gitignore`, licença, `index.html` publicado no Netlify (`netlify.toml`).
- **Arquivos:** `README.md`, `CLAUDE.md`, `.gitignore`, `LICENSE`, `index.html`.
- **Aceite:** link público (Netlify) abre a página inicial; PDFs da norma/apostilas **não** estão no repositório.
- **Teste manual:** abrir o link no computador e no celular.

### Etapa 1 — Núcleo numérico e angular — *concluída em 25/11/2026 (13 testes)*
- **Objetivo:** `numeros.js`, `angulos.js`, `estatistica.js` + executor de testes.
- **Aceite:** `node --test` passa S01, S02, conversões (`91°19'40"` ↔ 91,327778° ↔ 101,4753 gon), `parseDecimal('1,335') === 1.335`, PD/PI (Z e erro de índice).
- **Teste manual:** nenhum (só testes automáticos).

### Etapa 2 — Casca visual (layout do site) — *concluída em 25/11/2026, aguardando aprovação*
- **Objetivo:** cabeçalho, menu, rodapé, tokens de cor, tipografia, página inicial com cartões, modo escuro, impressão.
- **Tarefa de confirmação:** extrair do site do curso (DevTools) as cores e fontes exatas e atualizar `tokens.css` e o doc 6.
- **Aceite:** visual coerente com o site em desktop e celular (390 px) sem rolagem horizontal; aprovado pelo professor.
- **Teste manual:** comparar lado a lado com o site; testar no celular.

### Etapa 3 — Geométrico: caderneta e irradiação — *concluída em 25/11/2026 (27 testes), aguardando teste manual*
- **Objetivo:** tabela editável (estação, ponto, ré, vante, intermediária, FS/FI opcionais, DH, observação), cálculo de APV e cotas, verificação aritmética, alertas de campo, σ (F.1), perfil SVG.
- **Aceite:** G01 confere (9,139 ± 3,8 mm); Exemplo I da AA reproduz a Tabela 1; DH por estadimetria quando houver três fios; colunas de diferença ré−vante e distância acumulada; navegação só por teclado (Enter/Tab) funciona.
- **Teste manual:** digitar a caderneta da NBR F.2 e a do Exemplo I.
- **Feito:** núcleo `geometrico.js` (já encadeia estações com vante de mudança, base da etapa 4), σ pela F.1 nas vantes e F.1 sem simplificação nas intermediárias (D27), σ por km ao lado (D25), alertas D26 lidos de `data/norma_nbr13133_2021.json`, rascunho no navegador, exemplo F.2 em `data/exemplos/`. Falta o "Exemplo I / Tabela 1" da AA (dados não estão no repositório; o Exemplo I documentado é o de estatística).

### Etapa 4 — Geométrico: transporte, circuito e linha — *concluída em 25/11/2026 (38 testes), aguardando teste manual*
- **Objetivo:** seções/PS, nivelamento e contranivelamento, circuito, linha entre RN; tolerância pela classe (Tabela 5); distribuição proporcional à distância (padrão) e por estação (opção didática); altura corrigida e σ (doc 4, itens 4.3.4 e 4.3.6).
- **Aceite:** G02–G08 conferem (alturas, erro, K, correções, distâncias percorridas no nivelamento e no contranivelamento — 383,132 / 368,548 m no G04 e 453,132 / 488,596 m no G05) e a tabela de tolerâncias 2021 do doc 7 é reproduzida; relatório de seção e de linha.
- **Teste manual:** resolver Exercícios I–IV da AA na tela e comparar com as respostas.
- **Feito:** caderneta contínua por modo (transporte = ida até a RN de chegada e volta à partida; K = ida); erro, K, T = t√K nas três classes da Tabela 5 com "Atende/Não atende" em texto; distribuição proporcional (padrão, D23) e por estação (didática, com opção de arredondar C — errata E2); σ rigoroso (4.3.6) com Anexo L e σ por km ao lado (D24, D25); RN de chegada do transporte também pela média ida/volta (4.3.6 c); |e|/σ esperado (4.3.3). G02 e G03 não têm dados no repositório (só tolerâncias testadas). Seções com PS: uma caderneta por seção.

### Etapa 5 — Trigonométrico — *concluída em 25/11/2026 (50 testes), aguardando teste manual*
- **Objetivo:** irradiação com Di ou DH; PD/PI; c+r automático por limiar; recíprocas; poligonal altimétrica com fechamento II N; σ (F.3 e forma geral).
- **Aceite:** T01 e T03 conferem; T02 (Anexo H) reproduz ΔH = 3,943 m e f = 3 mm.
- **Teste manual:** caderneta da Tabela F.2 e Anexo I.
- **Feito:** caderneta com estação sobre ponto (i) ou estação livre (ré); Z PD/PI; Di ou DH; c+r sempre calculado e aplicado acima de 125 m (editável); σ por visada pela forma geral (4.4.2), igual à F.3 com estação sobre ponto; poligonal fechada ou entre pontos conhecidos, tolerância 120√K / 200√K, distribuição proporcional, σ rigoroso e Anexo L; visadas recíprocas com controle ida + volta ≈ −2·(c+r). T02 (Anexo H) sem dados no repositório; T03 aceita 1 mm na 3ª visada (errata E11).

### Etapa 6 — Taqueometria e estadimetria
- **Aceite:** E01 = 9,395 m; Q01 conferido pelo professor.

### Etapa 7 — Estatística de séries
- **Aceite:** S01/S02; gráfico igual às Figuras 7 e 8 da AA; detecção do atípico (obs. 7).

### Etapa 8 — Ferramentas auxiliares
- Conversor angular, Anexo C (A01), c+r (A04), GNSS → altitude normal (A02, A03).

### Etapa 9 — Importação Leica Sprinter
- **Pré-requisito:** arquivos de amostra + caderneta em papel correspondente.
- **Aceite:** arquivo de amostra importado reproduz a caderneta; linhas desconhecidas aparecem como aviso.

### Etapa 10 — Importação FOIF e Ruide RQS (+ mapeador CSV genérico)
- **Pré-requisito:** arquivos de amostra de cada estação.
- **Aceite:** amostras importadas corretamente para o módulo trigonométrico/taqueométrico; mapeador CSV lê qualquer planilha com colunas nomeadas.

### Etapa 11 — Relatórios e exportações
- **Objetivo:** relatório para impressão/PDF (fontes pretas, tabelas sem preenchimento, títulos numerados, rodapé com programa, data/hora e página), contendo os itens da NBR 5.8 aplicáveis: objeto, finalidade, data, referência altimétrica, instrumentos, equipe, precisões, memória de cálculo. CSV e `.nivel.json`.
- **Aceite:** relatório de G04 e de T01 impresso em A4 sem cortes; CSV abre no Excel/LibreOffice com vírgula decimal.

### Etapa 12 — Ajustamento MMQ e inspeção (opcional)
- Rede com vários circuitos/RN; $\hat\sigma_0$; módulo de inspeção (Tabela 7 e critério 7.3.1 — 90 % dos pontos ≤ 3σ).

### Etapa 13 — Modo aula e PWA
- Exemplos das apostilas em `data/exemplos/`, botão "mostrar fórmula/passo a passo", funcionamento offline (service worker) para uso em campo sem internet.

### Etapa 14 — Publicação e validação com turma
- Publicar (GitHub Pages ou servidor do curso), link no menu do site, teste em aula, coleta de correções.

## 1.5 Decisões pendentes (confirmar com o professor)

### 1.5.1 Decisões fechadas

| Nº | Decisão | Data |
|---|---|---|
| D1 | Somente **NBR 13133:2021** (sem perfil 1994). Tolerâncias das apostilas não são reproduzidas | 25/11/2026 |
| D2 | Repositório: <https://github.com/flavioboscatto/nivelamento_ifsc>; publicação no **Netlify** (substitui o GitHub Pages) | 25/11/2026 |
| D13 | Logo sem fundo recebida (`assets/img/logo_agrimensura.png`); versão branca derivada para o cabeçalho escuro | 25/11/2026 |
| D14 | Cores do site extraídas do print enviado pelo professor (doc 6) | 25/11/2026 |
| D15 | Importação dos equipamentos (etapas 9 e 10) fica para quando houver arquivos de amostra; as etapas 0–8 e 11 seguem antes | 25/11/2026 |
| D18 | Página inicial com explicação do site e duas opções: Nivelamento Geométrico e Nivelamento Trigonométrico (taqueometria como modo do trigonométrico) | 25/11/2026 |
| D19 | Digitação manual disponível em todos os módulos; importação apenas preenche a mesma caderneta editável | 25/11/2026 |
| D20 | Fundo da página sempre branco; sem modo escuro automático (o computador do professor em modo escuro deixava a página azul-marinho) | 25/11/2026 |
| D21 | Logo: nova versão com o símbolo de pontos (enviada 25/11). Cabeçalho usa versão transparente com texto branco e pontos verde/vermelho realçados; relatório usa versão para fundo claro | 25/11/2026 |
| D22 | Distâncias sempre calculadas e exibidas: DH por visada (digitada ou por estadimetria), diferença ré−vante, acumulada, extensões por sentido e K (doc 2, 2.2.11) | 25/11/2026 |
| D23 | **Seguir sempre a norma:** distribuição do erro proporcional à distância (NBR 5.5.2.12); "por estação" só como opção didática identificada | 25/11/2026 |
| D24 | Propagação no circuito/linha: fórmula rigorosa (doc 4, 4.3.6) como padrão, com a do Anexo L ao lado | 25/11/2026 |
| D25 | σ do nível pela leitura (NBR F.1: 0,6 mm a 30 m) como padrão; σ por km mostrado ao lado | 25/11/2026 |
| D26 | Alertas: 3 fios com tolerância de 2 mm; diferença ré−vante acima de 10 m (editáveis) | 25/11/2026 |
| D27 | σ de vantes intermediárias com ré e vante separadas; NBR F.1 quando equidistantes | 25/11/2026 |
| D28 | Nome/endereço provisório: **nivelamentoifsc** no Netlify (`nivelamentoifsc.netlify.app`) | 25/11/2026 |
| D29 | Status dos pontos: Ré, Vante e Irradiado ("Irad."); cada linha da caderneta tem uma lista de status que move a leitura de coluna (dados do nível vêm sem código) | 25/11/2026 |
| D30 | Cota ou Altitude escolhida no início da página; rótulos e mensagens seguem a escolha | 25/11/2026 |
| D31 | Projeto salvo/aberto em arquivo `.niv` (JSON próprio, versionado) | 25/11/2026 |
| D32 | Página "Sobre a norma": só a indicação das seções de onde saíram as fórmulas de cálculo e de propagação | 25/11/2026 |

### 1.5.2 Decisões pendentes

| Nº | Decisão | Proposta |
|---|---|---|
| D4 | Relatório | PDF pela impressão do navegador (sem biblioteca) |
| D5 | Unidade angular padrão | Sexagesimal; gon e decimal disponíveis |
| D6 | Erratas das apostilas | Documentadas no doc 7; corrigir nas próximas edições das apostilas? |
| D7 | Rótulo de classe de nível | Sempre "classe X (NBR 2021) — ≤ Y mm/km" |
| D12 | Modelo do Sprinter do curso | 150M ou 250M (com memória) → importação; 50/150 → só digitação |

## 1.6 Riscos

| Risco | Mitigação |
|---|---|
| Formatos proprietários das estações sem documentação | Mapeador CSV genérico; amostras reais antes de codificar |
| Alunos compararem com tolerâncias das apostilas (1994) | Tela "Sobre" explica as diferenças; norma e classe visíveis em todas as telas e no relatório |
| Erros de digitação em campo | Verificação aritmética, 3 fios, alertas, prévia de importação |
| Celular sem internet em campo | PWA offline (etapa 13) |
| Direitos autorais da norma | Não versionar PDFs; citar apenas itens e fórmulas |

## 1.7 O que o professor precisa enviar

1. Arquivos de amostra do Sprinter, FOIF e Ruide RQS (ver doc 5.5) e o modelo exato de cada equipamento — **mais adiante** (D15).
2. Confirmação das decisões pendentes (1.5.2).
3. Conferência dos resultados do Exercício V (caso Q01).
4. Opcional: logo em SVG (a versão PNG tem resíduos semitransparentes da remoção de fundo, visíveis só com zoom).

Recebidos: logo sem fundo, print das cores do site, endereço do repositório.
