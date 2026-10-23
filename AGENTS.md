# AGENTS.md

이 저장소에서 일하는 AI 에이전트(Codex, Claude Code 등)를 위한 안내입니다. 사람에게도 같은 규칙입니다.

## 무엇을 만드나

팀장, 본부장께 하는 사내 보고(사업 제안, 고객 제안 계획, 개선 제안, 진행·실적 보고)를 PPT 대신 HTML로 만드는 도구입니다.

- 쓰는 사람은 대부분 **비개발자**입니다. 설명 없이 쓸 수 있어야 합니다.
- 보고 종류와 듣는 분, 시간을 고르면 구성(장 순서, 레이아웃, 칸마다 안내)이 잡히고, 사람은 내용만 채웁니다.
- **개인 PC에서 `127.0.0.1`로만** 띄웁니다. 크롬과 엣지만 지원합니다.
- 쓰는 사람 대부분은 **윈도우**입니다. 개발과 기능 테스트는 맥에서 하므로, 맥에서 볼 때도 윈도우 조건을 떠올립니다(아래 ‘윈도우’).
- 설계는 [docs/DESIGN.md](docs/DESIGN.md), 라이선스는 [docs/OPEN-SOURCE.md](docs/OPEN-SOURCE.md)에 있습니다.

## 꼭 지킬 것

보안 자료를 다루는 도구입니다. 아래를 어기는 변경은 기능이 좋아 보여도 하지 않습니다.

1. **발표 내용은 이 PC 밖으로 나가지 않는다.**
   - 바깥 주소로 연결하는 코드를 넣지 않습니다: 외부 API, CDN의 글꼴·스크립트, 분석·오류 수집 도구, 업데이트 확인.
   - CSP(`server/csp.ts`, `src/export/exportHtml.tsx`의 `exportCsp`)를 느슨하게 바꾸지 않습니다.
   - 서버(`server/serve.ts`)는 `127.0.0.1`에만 묶고 Host 검사를 유지합니다.
2. **AI(MCP)에게는 모양만 보인다.**
   - `src/ai/share.ts`의 `toShape`는 빼는 방식이 아니라 **고르는 방식**입니다. 새 값을 넣을 때는 enum, 숫자, 불리언, 해시 id, 카탈로그에 있는 말만 넣습니다. 사람이 적은 글, 제목, 이름, 이미지, 노트, 원래 id는 절대 넣지 않습니다.
   - 모양을 바꾸면 `checkShape`(꼴 확인)와 MCP 서버의 `PROTOCOL_WORDS`도 같이 고칩니다.
   - `src/ai/share.test.ts`의 비밀 심기 테스트와 `mcp/server.test.ts`가 통과해야 합니다.
3. **AI의 제안은 사람이 적은 글을 쓰거나 지우지 못한다.**
   - `src/ai/ops.ts`에 칸의 글(fields, items)을 쓰는 op를 만들지 않습니다.
   - 지우는 op는 빈 장, 빈 항목만 지웁니다. 제안은 사람이 미리 보고 적용하며, 적용 전 상태는 버전으로 남깁니다.
4. **MCP 서버는 'AI 공유' 폴더만 다룬다.**
   - `mcp/server.ts`의 Node 권한 모델 실행(`--permission`, `--allow-fs-*`)을 빼지 않습니다.
   - 권한 모델은 심볼릭 링크를 따라가므로, 링크와 하드 링크를 거르는 `readJson`을 유지합니다.
   - 오류 메시지에 받은 값이나 경로를 넣지 않습니다. 정해진 문구(`MESSAGES`)만 씁니다. stdout에 로그를 쓰지 않습니다.
5. **실제 업무 자료를 저장소에 넣지 않는다.** 테스트, 예시, 스크린샷, 이슈, 커밋 메시지 모두 해당합니다. 예시 덱(`src/deck/sample.ts`)의 회사, 사람, 숫자는 지어낸 것입니다.
6. **의존성은 사내에서 써도 되는 오픈소스만.**
   - 넣기 전에 `npm run licenses`를 돌리고 [docs/OPEN-SOURCE.md](docs/OPEN-SOURCE.md)를 고칩니다.
   - 서버와 MCP 서버는 Node 내장 기능만 씁니다. 화면도 의존성을 늘리지 않는 쪽을 먼저 찾습니다.

## 명령

```bash
npm install
npm run dev          # 개발 서버. AI 공유 창구도 같이 열린다
npm run typecheck
npm test             # 구성 규칙, 저장, 버전, 로컬 서버, 모양/제안, MCP 서버(빌드 후 실제로 띄움)
npm run build        # dist/(화면) + dist-node/(로컬 서버, MCP 서버)
npm start            # http://127.0.0.1:41580
npm run mcp          # MCP 서버를 직접 띄우기 (보통은 Claude Code, Codex가 띄움)
npm run licenses     # 라이선스 확인
npm run pack         # 나눠 줄 폴더와 zip (release/)
```

슬라이드 디자인은 개발용 갤러리에서 한 번에 봅니다.

```
#/gallery?theme=white|navy|serif&mode=edit|preview|final&set=sample|blank&type=business|deal|improve|report
```

## 구조

| 위치 | 내용 |
|---|---|
| `src/deck/` | 데이터 모델(`types.ts`), 보고 종류별 구성(`blueprints.ts`), 레이아웃 정의(`layouts.ts`), 구성 만들기(`generate.ts`), 예시(`sample.ts`) |
| `src/slides/` | 슬라이드 그리기(`layouts.tsx`), 슬라이드 디자인(`slides.css`) |
| `src/screens/` | 홈, 마법사, 편집기(`editor/`), 발표 화면 |
| `src/store/` | 편집 상태(zustand), 저장(IndexedDB + 보관 폴더), 버전 |
| `src/export/` | HTML 내보내기와 뷰어 |
| `src/ai/` | 모양(`share.ts`), 제안(`ops.ts`), 로컬 서버와 이야기하는 곳(`client.ts`, `useAiShare.ts`) |
| `server/` | 로컬 서버, AI 공유 창구, CSP |
| `mcp/` | MCP 서버 |
| `scripts/`, `launch/` | 묶기, 라이선스 확인, 더블클릭 실행 파일 |

## 디자인

- 슬라이드는 1920×1080 고정 캔버스입니다. 사용자는 글상자를 옮기지 않고, 레이아웃을 고르고 칸을 채웁니다. 새 시각 요소는 레이아웃 안에 넣어 시스템이 배치하게 합니다.
- 색은 테마 변수(`--accent`, `--ink`, `--bold-bg` 등)만 씁니다. 세 테마(화이트, 네이비, 세리프)에서 모두 보기 좋아야 합니다.
- 슬라이드를 고쳤으면 갤러리에서 세 테마를 직접 보고 확인합니다. 화면을 고쳤으면 편집기를 직접 띄워 봅니다.
- 보고용입니다. 결론부터(표지의 결정 요청, 한 장 요약), 숫자는 크게, 장식은 적게.
- 발표할 때의 움직임은 `src/motion/engine.ts` 하나로 앱과 내보낸 HTML이 같이 씁니다. 새 레이아웃은 연출표에 넣습니다. 다른 사이트나 라이브러리의 모션 코드를 옮기지 않습니다([docs/MOTION.md](docs/MOTION.md)).
- 발표자 화면은 창 두 개(발표 화면, 발표자 화면)를 BroadcastChannel로 잇습니다(`src/present/link.ts`). 어느 창에서 넘겨도 같이 움직여야 합니다.

## 윈도우

- 단축키 표기는 `src/lib/keys.ts`의 `keys('mod+Z')`로 씁니다. 윈도우에서는 Ctrl+Z, 맥에서는 ⌘Z로 보입니다. ⌘를 직접 쓰지 않습니다. 윈도우 사용자에게 익숙한 키(Ctrl+Y 다시 하기, F5 발표)도 받습니다.
- 화면 크기: 1920×1080을 150%로 키운 노트북은 브라우저 안이 **1280×600** 남짓입니다. 이 크기에서 잘리거나 가로 스크롤이 생기면 안 됩니다. 1366×650, 1536×730도 봅니다.
- 스크롤바가 자리를 차지합니다. 맥에서 볼 때는 스크롤바를 항상 보이게 흉내 내서 봅니다. 스크롤되는 상자는 `minmax(0, 1fr)`, `overflow-x: hidden`, `scrollbar-gutter`로 가로로 넘치지 않게 합니다.
- 파일 이름은 `safeFileName`으로 만듭니다(금지 문자, CON 같은 예약어, 끝의 점, 긴 경로, NFC).
- 배포본: `.bat`은 CRLF(.gitattributes), 안내 `.txt`는 BOM이 있는 UTF-8, zip은 `scripts/zip.mjs`(UTF-8 이름 표시). 윈도우용 node.exe가 들어갑니다.
- 서버 오류는 창이 바로 닫히지 않게 `fail()`로 보여 줍니다(윈도우에서는 서버 창이 작게 내려가 있다).

## 화면 문구

- 해요체, 쉬운 말, 쓰는 사람 입장으로 씁니다. 버튼은 하는 일을 그대로(“적용하기”, “거절하기”).
- 화면에서는 “발표”, “장”, “칸”이라고 씁니다. 덱, 필드, 렌더, 슬롯 같은 개발 용어는 쓰지 않습니다.
- 듣는 사람은 “고객”이 아니라 보고 받는 분(팀장, 본부장)입니다.
- 오류 문구는 무엇이 안 됐고 어떻게 하면 되는지 말합니다. 사과하지 않습니다.

## 코드

- TypeScript strict, React 함수 컴포넌트. 주변 코드의 이름 짓기와 주석 밀도를 따릅니다. 주석은 한국어로, 무엇보다 왜를 씁니다.
- 저장 형식(`.deck`, 모양 파일, 제안 파일, 결과 파일)을 바꾸면 `version`과 예전 파일 읽기를 챙깁니다.
- 커밋 메시지는 한국어로, 첫 줄에 무엇을 했는지 씁니다.

## 끝내기 전에

- `npm run typecheck && npm test`가 통과해야 합니다.
- 보안에 닿는 변경(저장, 내보내기, 서버, AI 공유, MCP)은 위 “꼭 지킬 것”을 다시 확인합니다.
- 화면을 바꿨으면 스크린샷으로 직접 봅니다.
