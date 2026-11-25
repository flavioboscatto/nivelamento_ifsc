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
- **Próxima etapa:** Etapa 3 — caderneta geométrica com digitação manual e irradiação.
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
- Arquivos de equipamentos: só implementar leitor com amostra real em `tests/dados/`.

## Visual
- Seguir `docs/06_IDENTIDADE_VISUAL.md` (cores do site agrimensura.florianopolis.ifsc.edu.br e logo do curso).
- Relatório impresso: fontes pretas, tabelas sem preenchimento colorido, títulos numerados, rodapé com nome do programa, data/hora e página.

## Não fazer
- Não versionar PDFs de normas ou apostilas (licenciados).
- Não enviar dados do usuário a nenhum servidor nem usar analytics.
- Não adicionar dependências sem aprovação; se aprovadas, fixar versão e copiar para `vendor/`.
