@echo off
rem 더블클릭하면 html-maker를 켜고 크롬(없으면 엣지)으로 엽니다. 이 PC 안에서만 열려요.
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js가 설치되어 있지 않아요. https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행해 주세요.
  pause
  exit /b 1
)

if not exist "dist-node\serve.mjs" (
  if exist "node_modules" (
    echo 처음 실행이라 화면 파일을 만들고 있어요...
    call npm run build || (pause & exit /b 1)
  ) else (
    echo 화면 파일^(dist^)이 없어요. 받은 html-maker 폴더를 통째로 다시 풀어 주세요.
    pause
    exit /b 1
  )
)

node dist-node\serve.mjs
pause
