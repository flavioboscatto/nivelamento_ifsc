#!/bin/bash
# publicar_github.sh — primeiro envio (e envios seguintes) ao GitHub.
# Uso:  bash ~/Documents/00_Nivelamento/publicar_github.sh
set -e
cd "$(dirname "$0")"
REMOTO="https://github.com/flavioboscatto/nivelamento_ifsc.git"

# 1. Inicializa o repositório só na primeira vez
if [ ! -d .git ]; then
  git init -b main
  git remote add origin "$REMOTO"
fi

# 2. Garante que PDFs (norma/apostilas) e a pasta _to_delete não sejam enviados
if git ls-files --others --exclude-standard | grep -qi '\.pdf$'; then
  echo "ATENÇÃO: há PDF fora do .gitignore. Abortando."; exit 1
fi

# 3. Commit de tudo o que mudou
git add -A
if ! git diff --cached --quiet; then
  git commit -m "Plano, documentação, núcleo de cálculo (etapa 1) e página inicial (etapa 2)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CBnvzMjgBS6oQ6UwBvH1Cf"
fi

# 4. Se o repositório no GitHub já tiver algum arquivo (ex.: README criado pelo site), junta as histórias
if git ls-remote --exit-code --heads origin main >/dev/null 2>&1; then
  git pull origin main --allow-unrelated-histories --no-rebase --no-edit -X ours
fi

# 5. Envia
git push -u origin main
echo
echo "Pronto: https://github.com/flavioboscatto/nivelamento_ifsc"
