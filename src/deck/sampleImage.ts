/**
 * 이미지 컴포넌트의 예시 이미지: 지어낸 업무 화면(왼쪽 메뉴, 숫자 카드, 추이 선, 표). 부품 고르기 카드와 장 모음,
 * 갤러리에서만 쓴다(넣는 컴포넌트는 비어 있다). 회색 판만 두면 무엇을 넣는 칸인지 알아보기 어려웠다.
 * 바깥 주소 없이 글자로 만든 SVG라 이 PC 밖으로 나가는 것이 없다
 */
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000">
<rect width="1600" height="1000" fill="#f3f5f8"/>
<rect width="1600" height="72" fill="#fff"/><rect y="70" width="1600" height="2" fill="#e2e6ec"/>
<rect x="0" y="72" width="232" height="928" fill="#26303f"/>
<rect x="32" y="112" width="168" height="28" rx="6" fill="#3d4a5e"/>
<rect x="32" y="168" width="168" height="28" rx="6" fill="#4a72e8"/>
<rect x="32" y="224" width="168" height="28" rx="6" fill="#3d4a5e"/><rect x="32" y="280" width="168" height="28" rx="6" fill="#3d4a5e"/>
<g fill="#fff" stroke="#e2e6ec" stroke-width="2">
<rect x="272" y="104" width="300" height="140" rx="14"/><rect x="596" y="104" width="300" height="140" rx="14"/>
<rect x="920" y="104" width="300" height="140" rx="14"/><rect x="1244" y="104" width="316" height="140" rx="14"/>
<rect x="272" y="272" width="924" height="420" rx="14"/><rect x="1220" y="272" width="340" height="420" rx="14"/>
<rect x="272" y="720" width="1288" height="248" rx="14"/></g>
<g fill="#cfd5de"><rect x="300" y="132" width="110" height="16" rx="4"/><rect x="624" y="132" width="110" height="16" rx="4"/>
<rect x="948" y="132" width="110" height="16" rx="4"/><rect x="1272" y="132" width="110" height="16" rx="4"/></g>
<rect x="300" y="172" width="170" height="44" rx="6" fill="#4a72e8"/><g fill="#2b3442">
<rect x="624" y="172" width="150" height="44" rx="6"/><rect x="948" y="172" width="190" height="44" rx="6"/><rect x="1272" y="172" width="130" height="44" rx="6"/></g>
<g stroke="#eceff3" stroke-width="2"><path d="M312 380H1156M312 460H1156M312 540H1156M312 620H1156"/></g>
<path d="M320 610 400 560 480 575 560 500 640 515 720 450 800 470 880 410 960 425 1040 360 1120 372" fill="none" stroke="#4a72e8" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>
<g fill="#cfd5de"><rect x="1248" y="304" width="140" height="16" rx="4"/><rect x="1248" y="368" width="200" height="14" rx="4"/>
<rect x="1248" y="432" width="250" height="14" rx="4"/><rect x="1248" y="496" width="170" height="14" rx="4"/><rect x="1248" y="560" width="230" height="14" rx="4"/></g>
<g fill="#dfe3e9"><rect x="304" y="756" width="200" height="16" rx="4"/><rect x="560" y="756" width="160" height="16" rx="4"/><rect x="780" y="756" width="220" height="16" rx="4"/><rect x="1060" y="756" width="140" height="16" rx="4"/>
<rect x="304" y="820" width="240" height="14" rx="4"/><rect x="560" y="820" width="120" height="14" rx="4"/><rect x="780" y="820" width="180" height="14" rx="4"/><rect x="1060" y="820" width="200" height="14" rx="4"/>
<rect x="304" y="880" width="180" height="14" rx="4"/><rect x="560" y="880" width="150" height="14" rx="4"/><rect x="780" y="880" width="210" height="14" rx="4"/><rect x="1060" y="880" width="120" height="14" rx="4"/></g>
</svg>`

export const SAMPLE_IMAGE = `data:image/svg+xml,${encodeURIComponent(SVG.replace(/\n/g, ''))}`
