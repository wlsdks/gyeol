#!/bin/bash
# 더블클릭하면 결을 켜고 크롬(없으면 엣지)으로 엽니다. 이 PC 안에서만 열려요.
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js가 설치되어 있지 않아요. https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행해 주세요."
  read -r -p "창을 닫으려면 Enter를 누르세요."
  exit 1
fi

if [ ! -f dist/index.html ] || [ ! -f dist-node/serve.mjs ]; then
  if [ -d node_modules ]; then
    echo "처음 실행이라 화면 파일을 만들고 있어요..."
    npm run build || { read -r -p "만들지 못했어요. Enter를 누르면 닫혀요."; exit 1; }
  else
    echo "화면 파일(dist)이 없어요. 받은 결 폴더를 통째로 다시 풀어 주세요."
    read -r -p "창을 닫으려면 Enter를 누르세요."
    exit 1
  fi
fi

node dist-node/serve.mjs
