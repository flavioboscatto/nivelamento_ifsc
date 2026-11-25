# 5. Importação de Dados de Equipamentos

**Situação:** aguardando arquivos digitais de amostra (prometidos pelo Prof. Flavio). Nenhum formato será implementado "de memória": cada leitor só é escrito depois de termos ao menos dois arquivos reais do equipamento, e esses arquivos (anonimizados) viram testes em `tests/dados/`.

## 5.1 Arquitetura dos leitores

Todos os leitores rodam no navegador (`FileReader`, sem envio a servidor) e convertem o arquivo para um **modelo interno único**:

```js
// Observação de nivelamento geométrico
{ estacao: 'E1', ponto: 'RN1', tipo: 're'|'vante'|'mudanca'|'intermediaria',
  leitura: 1.335,           // m (fio médio ou leitura eletrônica)
  fs: null, fi: null,       // m, se houver 3 fios
  dh: 40.325,               // m
  hora: '09:14:22', obs: '' , origem: {arquivo, linha} }

// Observação de estação total
{ estacao: 'E01', i: 1.498, ponto: 'P20', h: 1.55,
  hz: 0.0, z: 1.5717, di: 26.479, dh: null, dn: null,   // ângulos em rad
  face: 'PD'|'PI'|null, x: null, y: null, zc: null, codigo: 'meio-fio',
  origem: {arquivo, linha} }
```

Fluxo: `arquivo → detectarFormato() → leitor específico → validar() → prévia em tabela editável → enviar ao módulo de cálculo`.

Regras:
1. Mostrar sempre a **prévia** com a linha de origem; o usuário confirma antes de calcular.
2. Unidades angulares detectadas pelo cabeçalho/configuração do arquivo (graus sexagesimais, decimais ou gon); se ambíguo, perguntar.
3. Decimal com vírgula ou ponto; separador `;`, `,` ou tabulação — função única `parseDecimal()`.
4. Linhas não reconhecidas são listadas como avisos, não descartadas em silêncio.
5. Mapeador CSV genérico (escolher qual coluna é o quê) como plano B para qualquer equipamento.

## 5.2 Nível digital Leica Sprinter

Ficha técnica (folheto Leica Sprinter):

| Modelo | σ 1 km duplo nivelamento (mira de alumínio código de barras) | Memória / USB | Classe NBR 2021 |
|---|---|---|---|
| Sprinter 50 | 2,0 mm | não | 2 |
| Sprinter 150 | 1,5 mm | não | 2 |
| Sprinter 150M | 1,5 mm | 2 000 pontos, USB e RS232 | 2 |
| Sprinter 250M | 1,0 mm (0,7 mm mira de fibra de vidro) | 2 000 pontos, USB e RS232 | 1 |

Todos: leitura única a 30 m — 0,6 mm (eletrônica), 1,2 mm (óptica); distância σ = 10 mm até 10 m e D×0,001 acima; alcance eletrônico 2–100 m.

**Pendências:**
- Qual modelo o curso usa (com memória = 150M/250M; sem memória = digitação manual)?
- Formato do arquivo exportado: o Sprinter M exporta pelo *Sprinter DataLoader* (planilha/ASCII) e a família Leica também usa o formato **GSI** (palavras de 8 ou 16 caracteres, ex.: `11` = nº do ponto, `32` = distância horizontal, `33x` = leituras de mira, `83` = altura). Os códigos exatos para o Sprinter serão confirmados com os arquivos de amostra.
- Modos de medição registrados no arquivo (BF, BFFB, intermediárias, implantação) e como o Sprinter marca ré, vante e intermediária.

Leitor previsto: `src/io/leica_sprinter.js` com sub-leitores `gsi8`, `gsi16` e `dataloader_csv`.

## 5.3 Estação total FOIF

**Pendências:** modelo (série RTS/OTS…), versão de firmware, formato exportado (CSV/TXT de dados brutos, coordenadas, ou formato proprietário), unidade angular, se registra face PD/PI e se exporta altura do instrumento e do prisma por linha ou só no registro da estação.

Leitor previsto: `src/io/foif.js`.

## 5.4 Estação total Ruide RQS

**Pendências:** as mesmas da FOIF. Registrar precisão nominal angular e linear da ficha técnica para enquadrar na Tabela 2 da NBR.

Leitor previsto: `src/io/ruide_rqs.js`.

## 5.5 O que pedir nos arquivos de amostra

Para cada equipamento, idealmente:
1. Um nivelamento/levantamento **curto e conhecido** (ex.: o circuito da aula com a caderneta em papel correspondente) — permite conferir o leitor linha a linha.
2. O arquivo **bruto** (observações: ângulos, distâncias, leituras) e, se houver, o de **coordenadas** calculadas pelo equipamento.
3. Um levantamento com PD/PI (estações) e com intermediárias (nível).
4. Foto/print das configurações de unidade do equipamento.

## 5.6 Cadastro de instrumentos (`data/instrumentos.json`)

```json
[
  {"id": "sprinter150m", "tipo": "nivel", "fabricante": "Leica", "modelo": "Sprinter 150M",
   "sigma_km_mm": 1.5, "sigma_leitura_mm": 0.6, "dist_ref_m": 30, "classeNBR2021": 2},
  {"id": "foif_xxx", "tipo": "estacao_total", "fabricante": "FOIF", "modelo": "a definir",
   "sigma_ang_s": null, "sigma_lin_mm": null, "sigma_lin_ppm": null, "classeNBR2021": null},
  {"id": "ruide_rqs", "tipo": "estacao_total", "fabricante": "Ruide", "modelo": "RQS",
   "sigma_ang_s": null, "sigma_lin_mm": null, "sigma_lin_ppm": null, "classeNBR2021": null}
]
```
O usuário pode criar instrumentos próprios (guardados no navegador e exportáveis).

## 5.7 Exportação

- CSV (`;`, vírgula decimal) da caderneta calculada, com sufixo `_calc.csv`.
- Pontos `Nome;X;Y;H;σH` para CAD/SIG (sufixo `_pontos.csv`).
- Projeto completo em JSON (`.nivel.json`) para reabrir depois.
- Relatório para impressão/PDF (etapa 11).
- Nunca sobrescrever o arquivo importado (o navegador sempre baixa um novo arquivo).
