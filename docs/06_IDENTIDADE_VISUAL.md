# 6. Identidade Visual e Layout

Referências: site do curso <https://agrimensura.florianopolis.ifsc.edu.br>, print da página inicial enviado pelo professor (25/11/2026) e a logo do Curso de Agrimensura sem fundo (`assets/img/logo_agrimensura.png`).

## 6.1 Estrutura do site do curso

1. **Cabeçalho** azul-marinho escuro, com a marca do IFSC à esquerda e menu à direita em **caixa alta, negrito, com espaçamento entre letras**, texto branco; o item ativo tem um **sublinhado verde** curto. Faixa inferior do cabeçalho um tom mais claro, seguida de uma sombra suave sobre o conteúdo.
2. **Seções** com rótulo pequeno em caixa alta, verde-escuro, espaçado (ex.: "O QUE É AGRIMENSURA"), título grande em negrito quase preto com o final destacado em **verde-claro**, e parágrafo em cinza-azulado.
3. **Grade de cartões** com bordas finas cinza-claras compartilhadas (sem sombra, sem cantos arredondados), ícone de linha verde centralizado, título em negrito e texto curto cinza, tudo centralizado.
4. Faixa de números, notícias, chamada final e **rodapé** institucional com links, contato e redes.

A calculadora reproduz: cabeçalho com menu em caixa alta e sublinhado verde, rótulo + título com destaque verde, cartões com borda fina para escolher o método, e o mesmo rodapé (com link de volta ao site do curso). Sugestão: incluir no menu do site principal o item "Ferramentas › Nivelamento".

## 6.2 Paleta (medida nos pixels do print)

```css
:root {
  /* Cabeçalho e superfícies escuras */
  --azul-noite: #0C1C28;        /* fundo do cabeçalho */
  --azul-noite-2: #14232F;      /* faixa inferior do cabeçalho; rodapé */

  /* Verdes */
  --verde: #75B14D;             /* destaque de título, ícones, sublinhado do menu ativo */
  --verde-escuro: #3C723D;      /* rótulos de seção (caixa alta) */
  --verde-if: #549E4D;          /* quadrados da marca IF (referência) */

  /* Texto */
  --texto-titulo: #182128;      /* títulos e títulos de cartões */
  --texto: #637078;             /* parágrafos e textos de cartões */
  --texto-claro: #FFFFFF;       /* menu e textos sobre fundo escuro */

  /* Superfícies e linhas */
  --fundo: #FFFFFF;
  --fundo-alt: #F5F7F6;         /* zebrado leve de tabelas (proposta) */
  --borda: #DDE3DF;             /* bordas dos cartões */

  /* Semânticas da calculadora (propostas, no mesmo tom) */
  --ok: #3C723D;                /* "Atende" — usar o verde-escuro para ter contraste em texto */
  --alerta: #94600F;            /* condição de campo fora do recomendado (âmbar escuro, contraste ≥ 4,5:1) */
  --erro: #B82F29;              /* "Não atende" — vermelho da marca IF */
}
```

Contraste (WCAG AA, texto normal ≥ 4,5:1 sobre branco): `--texto` #637078 ≈ 5,1:1 ✓; `--verde-escuro` #3C723D ≈ 5,7:1 ✓; `--erro` #B82F29 ≈ 6,0:1 ✓; `--verde` #75B14D ≈ 2,6:1 ✗ → usar **só** em títulos grandes, ícones e linhas, nunca em texto pequeno.

Uso semântico: "Atende" / "Não atende" sempre escritos, além da cor.

**Sem modo escuro (D20):** a página é sempre branca, como o site do curso, mesmo com o computador em modo escuro (`color-scheme: light`).

## 6.3 Tipografia

O print sugere uma sans-serif geométrica/grotesca (títulos pesados, menu em caixa alta com espaçamento). Confirmar o nome da família na etapa 2 inspecionando o site no navegador (Inspecionar → aba "Computado" → `font-family`) e carregar a mesma do Google Fonts.

| Elemento | Estilo |
|---|---|
| Menu | 15–16 px, peso 700, caixa alta, `letter-spacing: .06em` |
| Rótulo de seção | 14 px, peso 700, caixa alta, `letter-spacing: .12em`, `--verde-escuro` |
| Título de página | 40–56 px (desktop), peso 800, `--texto-titulo`, final em `--verde` |
| Corpo | 17–18 px, `--texto`, entrelinha 1,6 |
| Tabelas de caderneta | 15 px, `font-variant-numeric: tabular-nums`, números alinhados à direita |

## 6.4 Logo (D21)

| Arquivo | Uso |
|---|---|
| `assets/img/logo_agrimensura_original.jpg` | Original enviada (fundo branco, com o símbolo de pontos) |
| `assets/img/logo_agrimensura_fundo_escuro(_web).png` | Cabeçalho: fundo transparente, texto branco, pontos verde e vermelho realçados para contrastar com #0C1C28 |
| `assets/img/logo_agrimensura_fundo_claro(_web).png` | Relatório e fundos claros: transparente, cores originais |

As versões transparentes foram geradas por "cor para alfa" (remoção do branco preservando as bordas suavizadas), sem os resíduos da versão anterior. Alternativa avaliada e descartada: logo original numa placa branca dentro do cabeçalho escuro (os pontos ficaram apagados).

## 6.5 Layout da calculadora

```
┌────────────────────────────────────────────────────────────────┐
│ [logo branca]      INÍCIO  GEOMÉTRICO  TRIGONOMÉTRICO  TAQUEO…  │  #0C1C28
│                     ‾‾‾‾                                         │  sublinhado verde
├────────────────────────────────────────────────────────────────┤
│ NIVELAMENTO GEOMÉTRICO                        (rótulo verde)     │
│ Circuito **fechado**                          (final em verde)   │
│ [Classe: I N — nível classe 2 ▾] [Cota | Altitude normal]        │
│ [Importar arquivo] [Exemplo ▾] [Limpar]                          │
├────────────────────────────────┬───────────────────────────────┤
│ Caderneta (tabela editável)    │ Resumo: Σré, Σvante, erro,    │
│ Est | Ponto | Ré | Vante | DH  │ tolerância, ATENDE/NÃO ATENDE,│
│ ...                            │ alertas de campo              │
├────────────────────────────────┴───────────────────────────────┤
│ Resultados: APV, H calculada, correção, H corrigida, σH          │
│ Perfil longitudinal (SVG)                                        │
│ [Exportar CSV] [Relatório PDF] [Salvar projeto]                  │
├────────────────────────────────────────────────────────────────┤
│ rodapé institucional (#14232F)                                   │
└────────────────────────────────────────────────────────────────┘
```

Página inicial (D18): bloco de apresentação (rótulo, título com destaque verde, texto do que o site faz) e **dois cartões grandes** no estilo da grade do site (borda #DDE3DF, ícone verde de linha) — **Nivelamento Geométrico** e **Nivelamento Trigonométrico** — cada um listando seus modos e com os botões "Digitar caderneta" e "Importar arquivo". Abaixo, faixa "Como funciona" em três passos e aviso de privacidade (cálculo no navegador).

Celular: menu vira botão "hambúrguer"; o resumo sobe para cima da tabela; a tabela rola horizontalmente dentro do próprio quadro (a página não).

## 6.6 Relatório impresso (PDF)

Segue a preferência do professor: **fontes todas pretas, tabelas sem preenchimento colorido, títulos e subtítulos numerados**. Logo original (preta) no cabeçalho. Rodapé com nome do programa, data/hora de geração e número da página. Nenhuma cor da tela aparece na impressão (`@media print`).
