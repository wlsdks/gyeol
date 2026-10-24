# 쓰는 오픈소스와 라이선스

조사한 날: 2026-10-23. `npm run licenses`로 `node_modules`의 패키지 56개를 모두 읽어 확인했습니다(인터넷 없이 각 패키지의 `package.json`과 라이선스 파일을 읽습니다).

## 결론

- **모두 오픈소스이고, 사내에서 써도 문제없는 라이선스입니다.** MIT, Apache-2.0, BSD, ISC, 0BSD, 글꼴은 SIL OFL 1.1입니다.
- 강한 카피레프트(GPL, LGPL, AGPL)나 사용 제한 라이선스(SSPL, BUSL, Elastic, 비상업 CC)는 **하나도 없습니다**.
- 약한 카피레프트인 MPL-2.0이 하나 있지만(lightningcss), **만들 때만 쓰는 도구**이고 나눠 주는 파일에는 들어가지 않습니다.
- 로컬 서버와 MCP 서버는 외부 패키지 없이 **Node.js 내장 기능만** 씁니다.
- 윈도우 배포본에는 Node.js(MIT) 공식 실행 파일을 같이 넣어서, 받는 사람이 아무것도 설치하지 않아도 됩니다.

## 나눠 주는 파일에 들어가는 것 (14개)

| 패키지 | 버전 | 라이선스 | 쓰는 곳 |
|---|---|---|---|
| react, react-dom | 19.3.1 | MIT | 화면 |
| scheduler | 0.28.0 | MIT | React 내부 |
| zustand | 5.0.16 | MIT | 편집 상태 |
| idb-keyval | 6.3.0 | Apache-2.0 | 브라우저 안 저장(IndexedDB) |
| @dnd-kit/core, sortable, utilities, accessibility | 6.3.1 외 | MIT | 장 순서 끌어 옮기기 |
| tslib | 2.8.1 | 0BSD | dnd-kit이 쓰는 도우미 |
| pretendard | 1.3.9 | OFL-1.1 | 본문 글꼴 |
| @fontsource-variable/hahmlet | 5.3.0 | OFL-1.1 | 세리프 테마 제목 글꼴 |
| @types/react, csstype | 19.3.0, 3.2.3 | MIT | 타입 정보만. 실행 파일에는 들어가지 않음 |

## 만들 때만 쓰는 것 (42개)

| 패키지 | 라이선스 | 비고 |
|---|---|---|
| vite 8, rolldown, @vitejs/plugin-react | MIT | 빌드 |
| typescript 7 | Apache-2.0 | 타입 검사 |
| vitest 5 | MIT | 테스트 |
| lightningcss 1.33 | MPL-2.0 | Vite가 CSS를 줄일 때 씀. lightningcss 파일 자체를 고쳐서 배포할 때만 그 파일을 공개할 의무가 생김. 고치지도, 배포하지도 않음 |
| @types/node 외 나머지 | MIT, ISC, BSD-3-Clause, Apache-2.0 | |

## 실행 환경과 연결하는 도구

| 이름 | 라이선스 | 비고 |
|---|---|---|
| Node.js 24 (`node\node.exe`) | MIT | 윈도우 배포본에 공식 배포 파일을 고치지 않고 넣음. Node.js에 들어 있는 OpenSSL(Apache-2.0), ICU, libuv 등의 라이선스는 함께 넣는 `node\LICENSE.txt`에 모두 있음. 맥에서는 설치된 Node.js를 씀 |
| 크롬, 엣지 | 각 회사 약관 | 사용자가 이미 쓰는 브라우저. 이 저장소가 나눠 주지 않음 |
| Codex CLI | Apache-2.0 (오픈소스) | MCP로 붙는 AI 도구. 이 저장소에 들어 있지 않음 |
| Claude Code | Anthropic 상용 약관 (오픈소스 아님) | MCP로 붙는 AI 도구. 이 저장소에 들어 있지 않음. 회사의 AI 도구 사용 정책을 따름 |

html-maker는 MCP를 공개된 규격(JSON-RPC)대로 직접 구현했고, AI 회사의 SDK나 패키지를 쓰지 않습니다.

## 참고한 공개 자료 (코드나 값을 옮기지 않음)

| 자료 | 라이선스 | 참고한 것 |
|---|---|---|
| [Radix Colors](https://www.radix-ui.com/colors/docs/palette-composition/composing-a-palette) | MIT | 강조색과 같은 계열의 회색을 짝짓는 원칙. 색 값은 우리가 따로 골랐음 |
| [Datawrapper 블로그: 색으로 강조하기](https://www.datawrapper.de/blog/emphasize-with-color-in-data-visualizations) | 공개 글 | 맥락은 회색, 말하려는 곳만 색 |

## 나눠 줄 때 지킬 것

- **MIT, BSD, ISC, 0BSD, Apache-2.0:** 저작권 표시와 라이선스 전문을 함께 둡니다. `npm run pack`이 `오픈소스 라이선스.txt`에 묶여 나가는 패키지의 라이선스 전문을 모아 넣고, Node.js의 `LICENSE`는 `node\LICENSE.txt`로 넣습니다. Apache-2.0 패키지(idb-keyval)에는 따로 둘 NOTICE 파일이 없습니다.
- **글꼴(OFL-1.1):** 글꼴만 따로 팔 수 없고, 문서에 넣는 것은 자유입니다. 내보낸 HTML에는 글꼴 원작자가 미리 나눠 둔 부분 파일(unicode-range 조각)을 **고치지 않고** 넣으므로 수정본이 아니며, 'Pretendard' 예약 글꼴 이름 조항에 걸리지 않습니다. 글꼴 파일 안의 저작권 정보도 그대로 남습니다.

## 새 패키지를 넣을 때

1. 꼭 필요한지 먼저 봅니다. 서버와 MCP 서버에는 넣지 않습니다(Node 내장만).
2. `npm run licenses`가 통과해야 합니다. `npm run pack`도 통과하지 않으면 멈춥니다.
   - 묶여 나가는 패키지: MIT, ISC, BSD-2/3-Clause, 0BSD, Apache-2.0, OFL-1.1, Zlib, CC0-1.0, BlueOak-1.0.0
   - 만들 때만 쓰는 도구: 위에 더해 MPL-2.0, CC-BY-4.0, Python-2.0, Unlicense
   - 그 밖(GPL, LGPL, AGPL, SSPL, BUSL, 비상업, 라이선스 없음)은 넣지 않습니다.
3. 화면에 들어가는 패키지는 바깥 주소로 연결하지 않아야 합니다(CSP가 막지만, 막히는 기능은 쓰지 않습니다).
4. 이 문서의 표를 고칩니다.
