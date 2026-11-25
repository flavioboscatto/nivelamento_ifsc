# CLAUDE.md — Calculadora de Nivelamento IFSC

## Contexto
Site estático do Curso Técnico em Agrimensura (IFSC Florianópolis) para cálculo de nivelamento geométrico, trigonométrico e taqueométrico em aula, conforme **somente** a ABNT NBR 13133:2021 (as apostilas de 2018 seguem a de 1994: usar apenas seus métodos e dados, nunca suas tolerâncias). Usuários: alunos e professores. Todo cálculo roda no navegador.

Leia antes de qualquer tarefa:
- `docs/01_PLANO_IMPLEMENTACAO.md` — etapas e decisões
- `docs/02_METODOS_E_FORMULAS.md`, `docs/03_PARAMETROS_NBR13133.md`, `docs/04_PROPAGACAO_PRECISOES.md` — a matemática
- `docs/07_CASOS_DE_TESTE.md` e `tests/casos_referencia.json` — valores que devem conferir

## Situação atual (25/11/2026)
- Planejamento concluído; decisões D1, D2, D13–D19 fechadas (plano 1.5.1).
- **Etapa 0:** repositório enviado ao GitHub; publicação no Netlify (`nivelamentoifsc.netlify.app`, sem build, `netlify.toml`).
- **Etapa 1 concluída:** `src/core/numeros.js`, `angulos.js`, `estatistica.js`; 13 testes passando (`node --test`).
- **Etapa 2 concluída (aguardando aprovação visual):** `assets/css/*`, `src/ui/layout.js`, `index.html` com apresentação e duas opções (Geométrico e Trigonométrico); `geometrico.html`, `trigonometrico.html` e `sobre.html` provisórias.
- Pendente da etapa 2: confirmar a família tipográfica do site (usando Inter provisoriamente).
- **Etapa 3 concluída (aguardando teste manual do professor):** `src/core/geometrico.js` (caderneta, APV, alturas, distâncias, verificação aritmética, alertas, σ F.1), `src/core/tolerancias.js` (classe do nível), `src/ui/caderneta.js`, `src/ui/perfil_svg.js`, `src/ui/paginas/geometrico.js`, `geometrico.html` (modo irradiação); `data/norma_nbr13133_2021.json`, `data/instrumentos.json`, `data/exemplos/nbr_f2.json`; 27 testes passando.
- Etapa 3: o "Exemplo I da AA / Tabela 1" do aceite fica para quando o professor tiver os dados (25/11/2026); por ora a irradiação é testada com G01 e com a estação a do circuito G06.
- Ajustes pedidos em 25/11/2026 (feitos): status Ré/Vante/Irad. por linha, Cota/Altitude no início da página, projeto em arquivo `.niv` (`src/io/projeto.js`), excluir linha, página "Sobre a norma" só com as seções usadas, "Site do curso" em nova guia.
- **Etapa 4 concluída (aguardando teste manual do professor):** `src/core/fechamento.js` (transporte, circuito, linha), `ajustamento.js` (proporcional à distância e por estação), `propagacao.js` (4.3.6 a–c e Anexo L), `tolerancias.js` (T = t√K, Tabela 5); página com quatro modos, rascunho por modo e exemplos AA Ex. I e Tab. 9 em `data/exemplos/`; 38 testes passando (G04–G08, P01, tabela 2021 do doc 7).
- Pendente da etapa 4: G02 e G03 sem dados no projeto (só a tolerância é testada); linha com várias seções/PS é tratada como uma caderneta por seção.
- **Etapa 5 concluída (aguardando teste manual do professor):** `src/core/trigonometrico.js` (irradiação com Di ou DH, PD/PI, c+r por limiar, σ pela forma geral = F.3, poligonal II N com fechamento, visadas recíprocas), `trigonometrico.html` + `src/ui/paginas/trigonometrico.js`; 50 testes (T01, T03, A01, A04). ET pelas classes da Tabela 2 até chegarem os modelos FOIF/Ruide.
- Pendente da etapa 5: T02 (Anexo H) sem dados no projeto; T03 3ª visada difere 0,8 mm por arredondamento de c+r na norma (errata E11).
- **Etapa 6 concluída (aguardando teste manual):** `src/core/taqueometria.js` (estadimetria, DN, H, X, Y, σ do doc 4.5), modo Taqueometria na página trigonométrica com exemplo AA Ex. V; 56 testes (E01, Q01). **Q01 confere com o doc 7, mas os valores esperados ainda precisam da conferência do professor** (apostila sem resposta).
- **Etapa 7 concluída (aguardando teste manual):** `apoio.html` + `src/ui/paginas/apoio.js` (série de observações, atípicas por 3 s sem a observação ou limite fixo, exclusão manual, gráfico com média e ±3 s, projeto .niv); `analisarSerie` e `lerSerie` em `estatistica.js`; links no rodapé e na página inicial; 60 testes (S01, S02). Figuras 7 e 8 da AA não estão no projeto: o gráfico segue o doc 2.5 (observações + linha da média).
- **Etapa 8 dispensada (25/11/2026, D34):** sem conversor angular, GNSS fica para depois; Anexo C e c+r já estão dentro do trigonométrico.
- **Entrada de ângulos em GG,MMSS (D33):** `lerAnguloSexagesimal` em `angulos.js`, usado no trigonométrico e na taqueometria.
- **Etapa 11 concluída (aguardando teste de impressão):** `src/ui/relatorio.js` (prévia A4, impressão/PDF com títulos numerados, rodapé com programa, data/hora e página via `@page`), `src/io/csv.js` (CSV com `;`, vírgula decimal, BOM); dados do relatório (objeto, finalidade, local, data, equipe, operador) nas três páginas e no `.niv`; 64 testes. G04 e T01 cabem na largura A4 na prévia.
- **Exportações (25/11/2026):** planilha `.xlsx` (abas Identificação, Caderneta, Resultados e extras), relatório Word `.docx` editável (mesmo conteúdo do PDF, com logo, tabelas, figuras e rodapé com página) e figuras `.png` (perfil, gráfico da série). Geradores próprios sem dependências: `src/io/zip.js`, `xlsx.js`, `docx.js`, `src/ui/figuras.js`. Tabela de curvatura e refração na página de apoio. 70 testes.
- **Próximas etapas:** 9–10 (importação) aguardam arquivos de amostra; 12 (MMQ, opcional), 13 (modo aula e PWA offline), 14 (publicação e validação com a turma).
- Regra geral: **seguir sempre a NBR 13133:2021** (D23–D27).
- Aguardando: arquivos de amostra (etapas 9–10); modelos/fichas técnicas dos equipamentos; conferência do caso Q01.

## Pilha técnica
- HTML + CSS + JavaScript com módulos ES nativos. **Sem framework e sem etapa de build.**
- Testes: `node --test` (Node 20+, sem dependências).
- Servidor local: `python3 -m http.server 8000`.
- Desenvolvimento no Mac (terminal) e Windows; caminhos sempre relativos.

## Regras de trabalho
1. Uma etapa por vez; parar e pedir confirmação antes de iniciar a próxima.
2. Em arquivos existentes, mostrar só os trechos alterados; nada de refatoração fora do escopo (sugestões vão numa lista separada).
3. Se o plano conflitar com o código, parar e perguntar.
4. **Nunca alterar fórmulas, constantes ou tolerâncias da norma** sem confirmação explícita. Interface e apresentação podem mudar; a matemática não.
5. Todo cálculo novo entra com teste de valor conhecido (apostila, norma ou cálculo independente).
6. Após cada lote de alterações: rodar `node --test` e indicar o teste manual.
7. Atualizar este arquivo e o plano ao concluir cada etapa.

## Regras do domínio
- `src/core/` não acessa DOM nem `window`: funções puras, entrada e saída em objetos simples.
- Unidades internas: metros e radianos. Converter só na entrada/saída.
- Sem arredondamento intermediário; arredondar só na exibição (alturas 3 casas, correções 4, mm com 1 casa).
- Interface e mensagens em português do Brasil, com **vírgula decimal**; CSV com `;`.
- Parâmetros de norma e de instrumentos **só** em `data/*.json` (`norma_nbr13133_2021.json`, `instrumentos.json`).
- Sempre indicar: norma (NBR 13133:2021), classe, tipo de altura (cota ou altitude normal), método de distribuição do erro e forma de propagação usada.
- Toda altura calculada sai com desvio-padrão.
- Mensagens de erro em linguagem de agrimensor ("A leitura de vante da estação 3 está vazia"), nunca exceções cruas.
- Status "Atende / Não atende" sempre em texto, não só por cor.
- Pontos têm três status: **Ré**, **Vante** e **Irradiado** (abreviado **Irad.**). Não usar "intermediária" na interface.
- O usuário escolhe no início da página se trabalha com **Cota** (referência arbitrária) ou **Altitude** (normal, SGB); rótulos e mensagens usam a palavra escolhida (nunca "altura" genérico). A escolha vale para o site todo (`localStorage`).
- Ângulos sempre sexagesimais, digitados em **GG,MMSS** (formato dos equipamentos: 91,1940 = 91°19'40"); sem graus decimais, grados nem conversores.
- Projetos são salvos e abertos em arquivo `.niv` (JSON, `formato: "nivelamento-ifsc"`, versionado); resultados não são gravados, sempre recalculados.
- Arquivos de equipamentos: só implementar leitor com amostra real em `tests/dados/`.

## Visual
- Seguir `docs/06_IDENTIDADE_VISUAL.md` (cores do site agrimensura.florianopolis.ifsc.edu.br e logo do curso).
- Relatório impresso: fontes pretas, tabelas sem preenchimento colorido, títulos numerados, rodapé com nome do programa, data/hora e página.

## Não fazer
- Não versionar PDFs de normas ou apostilas (licenciados).
- Não enviar dados do usuário a nenhum servidor nem usar analytics.
- Não adicionar dependências sem aprovação; se aprovadas, fixar versão e copiar para `vendor/`.
