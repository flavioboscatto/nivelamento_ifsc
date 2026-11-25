# Nivelamento IFSC — Calculadora de Nivelamento Geométrico e Trigonométrico

Aplicação web **estática** do Curso Técnico em Agrimensura do IFSC Câmpus Florianópolis para cálculo, em aula, de nivelamentos geométricos, trigonométricos e taqueométricos, com tolerâncias e propagação de precisões conforme a **ABNT NBR 13133:2021**.

Todo o processamento acontece **no navegador do usuário**: nenhum dado de campo é enviado a servidor.

## 1. Situação

Fase de **planejamento concluída** (25/11/2026). Implementação ainda não iniciada.

Repositório: <https://github.com/flavioboscatto/nivelamento_ifsc> · Site: <https://nivelamentoifsc.netlify.app> (provisório)

## 2. Documentação

| Nº | Documento | Conteúdo |
|---|---|---|
| 1 | [docs/01_PLANO_IMPLEMENTACAO.md](docs/01_PLANO_IMPLEMENTACAO.md) | Arquitetura, etapas numeradas, critérios de aceite, decisões pendentes |
| 2 | [docs/02_METODOS_E_FORMULAS.md](docs/02_METODOS_E_FORMULAS.md) | Métodos de nivelamento e toda a matemática |
| 3 | [docs/03_PARAMETROS_NBR13133.md](docs/03_PARAMETROS_NBR13133.md) | Classes de instrumentos, tolerâncias e condições da NBR 13133:2021 |
| 4 | [docs/04_PROPAGACAO_PRECISOES.md](docs/04_PROPAGACAO_PRECISOES.md) | Propagação de variâncias para cada método |
| 5 | [docs/05_IMPORTACAO_EQUIPAMENTOS.md](docs/05_IMPORTACAO_EQUIPAMENTOS.md) | Leica Sprinter, FOIF e Ruide RQS — estratégia de leitura de arquivos |
| 6 | [docs/06_IDENTIDADE_VISUAL.md](docs/06_IDENTIDADE_VISUAL.md) | Cores, layout e logo, alinhados ao site do curso |
| 7 | [docs/07_CASOS_DE_TESTE.md](docs/07_CASOS_DE_TESTE.md) | Exemplos resolvidos (apostilas e norma) usados como testes, com erratas encontradas |
| — | [CLAUDE.md](CLAUDE.md) | Regras para o Claude Code trabalhar neste repositório |
| — | [tests/casos_referencia.json](tests/casos_referencia.json) | Mesmos casos de teste em formato de máquina |

## 3. Fontes técnicas

1. ABNT NBR 13133:2021 — Execução de levantamento topográfico — Procedimento.
2. FRAGA, A. M.; DALRI, J. C.; LEMOS II, D. L.; ARAUJO, R. Z. *Introdução à Altimetria*. Florianópolis: IFSC, 2018.
3. LIMA, A. P. B.; DALRI, J. C.; LEMOS II, D. L.; FRAGA, A. M. *Altimetria Aplicada*. Florianópolis: IFSC, 2018.

> **Atenção:** o PDF da NBR 13133:2021 é licenciado para uso exclusivo do IFSC. **Não versionar a norma nem as apostilas no GitHub** (ver `.gitignore`, pasta `referencias/`).

## 4. Como executar (após implementação)

```bash
# servidor local simples (qualquer um serve)
python3 -m http.server 8000
# abrir http://localhost:8000

# testes do núcleo de cálculo (Node 20+, sem dependências)
node --test
```

## 5. Publicação

Site estático publicado no **Netlify** a partir da branch `main` (sem comando de build; pasta publicada = raiz; configuração em `netlify.toml`). Futuramente pode migrar para o servidor do curso.
