// '만드는 순서'의 고르는 판. 발표 종류, 듣는 사람, 발표 시간을 고르면 Framo가 만들 장을 그대로 보여 준다.
// 장 목록과 고르는 규칙은 앱의 구성(src/deck/blueprints.ts, generate.ts의 planRecipes)에서 뽑아 왔고,
// 그림(images/decks/<종류>-<구성 안 차례>.webp)은 앱이 마법사 미리보기처럼 예시 글을 진하게 그린 장이다.
// plans의 글자 하나가 장 하나: a는 구성의 첫 장, b는 둘째 장. 스크립트가 없으면 HTML에 적힌 기본 구성 그대로 둔다.
const DECKS = {
  business: { name: "사업 제안", note: "새 사업이나 프로젝트를 승인받아요", slides: ["표지", "한 장 요약", "목차", null, "추진 배경", "기회의 크기", "시장 구성", null, "제안 내용", "바뀌는 모습", "추진 방안 비교", null, "기대 효과", "매출 전망", "필요한 자원", null, "추진 일정", "위험과 대응", "결정 요청"], plans: {"exec-5":"abeims","exec-10":"abefims","exec-20":"abefgijkmns","exec-30":"abefgijkmnors","practitioner-5":"abeims","practitioner-10":"abefims","practitioner-20":"abefijkmoqs","practitioner-30":"abcefijkmoqrs","peers-5":"abeims","peers-10":"abeijms","peers-20":"abeijkmoqrs","peers-30":"abceijkmoqrs","partners-5":"abeims","partners-10":"abefims","partners-20":"abefijkmoqs","partners-30":"abcefijkmoqrs","mixed-5":"abeims","mixed-10":"abefims","mixed-20":"abefijkmoqs","mixed-30":"abcefijkmoqrs"} },
  improve: { name: "개선 제안", note: "일하는 방식이나 제도, 도구를 바꾸자고 해요", slides: ["표지", "한 장 요약", "섹션: 문제", "지금의 문제", "문제의 크기", "원인", "섹션: 개선안", "과제 우선순위", "바뀌는 모습", "바뀌는 절차", "방안 비교", "기대 효과", "섹션: 실행", "실행 계획", "할 일과 담당", null, "결정 요청"], plans: {"exec-5":"abdilq","exec-10":"abdeilq","exec-20":"abcdegilmnq","exec-30":"abcdefghijklmnq","practitioner-5":"abdilq","practitioner-10":"abdeilq","practitioner-20":"abdehijlnoq","practitioner-30":"abcdefghijlmnoq","peers-5":"abdilq","peers-10":"abdhilq","peers-20":"abdhijlnoq","peers-30":"abcdefghijlmnoq","partners-5":"abdilq","partners-10":"abdeilq","partners-20":"abdefijlnq","partners-30":"abcdefghijklmnq","mixed-5":"abdilq","mixed-10":"abdeilq","mixed-20":"abdeijlnq","mixed-30":"abcdefghijklmnq"} },
  decide: { name: "검토 보고", note: "여러 안을 비교해 하나를 결정받아요", slides: ["표지", "한 장 요약", "검토 배경", "지금의 불편", "검토 기준", "안 비교", "기준별 평가", "도입 일정", "위험과 대응", "결정 요청"], plans: {"exec-5":"abcfj","exec-10":"abcdefj","exec-20":"abcdefghij","exec-30":"abcdefghij","practitioner-5":"abcfj","practitioner-10":"abcefgj","practitioner-20":"abcdefghij","practitioner-30":"abcdefghij","peers-5":"abcfj","peers-10":"abcefgj","peers-20":"abcdefghij","peers-30":"abcdefghij","partners-5":"abcfj","partners-10":"abcefgj","partners-20":"abcdefghij","partners-30":"abcdefghij","mixed-5":"abcfj","mixed-10":"abcefgj","mixed-20":"abcdefghij","mixed-30":"abcdefghij"} },
  deal: { name: "고객 제안 계획", note: "고객에게 낼 제안과 가격을 승인받아요", slides: ["표지", "한 장 요약", "목차", "섹션: 사업 기회", "사업 기회", "사업 규모", "경쟁 상황", "섹션: 제안 전략", "제안 내용", "가격 안", "제안할 솔루션", "비슷한 수주 사례", "섹션: 실행 계획", "수주 일정", "위험과 대응", "결정 요청"], plans: {"exec-5":"abefijp","exec-10":"abefijp","exec-20":"abefgijop","exec-30":"abdefghijlmnop","practitioner-5":"abefijp","practitioner-10":"abefijp","practitioner-20":"abefgijknop","practitioner-30":"abcdefghijkmnop","peers-5":"abefijp","peers-10":"abefijp","peers-20":"abefgijknop","peers-30":"abcdefghijkmnop","partners-5":"abefijp","partners-10":"abefijp","partners-20":"abcefgijnop","partners-30":"abcdefghijkmnop","mixed-5":"abefijp","mixed-10":"abefijp","mixed-20":"abcefgijnop","mixed-30":"abcdefghijkmnop"} },
  plan: { name: "연간·반기 계획", note: "목표와 중점 과제, 예산을 정해요", slides: ["표지", "한 장 요약", "목차", "섹션: 돌아보기", "올해 돌아보기", "올해 배운 점", "섹션: 목표", "내년 목표", "올해와 내년", "섹션: 과제", "중점 과제", "과제 우선순위", "섹션: 실행", "분기별 일정", "필요한 예산과 인력", null, "결정 요청"], plans: {"exec-5":"abehkq","exec-10":"abehikq","exec-20":"abehikoq","exec-30":"abdefghijklmnoq","practitioner-5":"abehkq","practitioner-10":"abehklq","practitioner-20":"abcehklnoq","practitioner-30":"abcdefghjklmnoq","peers-5":"abehkq","peers-10":"abehklq","peers-20":"abcehklnoq","peers-30":"abcdefghjklmnoq","partners-5":"abehkq","partners-10":"abefhkq","partners-20":"abcefhknoq","partners-30":"abcdefghijkmnoq","mixed-5":"abehkq","mixed-10":"abehknq","mixed-20":"abcehknoq","mixed-30":"abcdefghijkmnoq"} },
  weekly: { name: "주간·월간 업무 보고", note: "한 일과 할 일, 이슈를 알려요", slides: ["표지", "한 장 요약", "진행 현황", "주요 숫자", "주별 추이", "이슈와 대응", "다음 할 일", "요청 사항"], plans: {"exec-5":"abcfg","exec-10":"abcdefg","exec-20":"abcdefgh","exec-30":"abcdefgh","practitioner-5":"abcfg","practitioner-10":"abcdfgh","practitioner-20":"abcdefgh","practitioner-30":"abcdefgh","peers-5":"abcfg","peers-10":"abcdfgh","peers-20":"abcdefgh","peers-30":"abcdefgh","partners-5":"abcfg","partners-10":"abcdfgh","partners-20":"abcdefgh","partners-30":"abcdefgh","mixed-5":"abcfg","mixed-10":"abcdfgh","mixed-20":"abcdefgh","mixed-30":"abcdefgh"} },
  report: { name: "실적 보고", note: "목표 대비 실적과 원인, 대책을 알려요", slides: ["표지", "핵심 실적", "목차", "목표 대비 실적", "증감 요인", "기간별 실적", "작년 대비", "과제 진행 현황", "영업 단계별 현황", "잘된 점", "문제와 대책", "다음 계획", "요청 사항"], plans: {"exec-5":"abdklm","exec-10":"abdeklm","exec-20":"abdefghjklm","exec-30":"abdefghijklm","practitioner-5":"abdklm","practitioner-10":"abdeklm","practitioner-20":"abdefhijklm","practitioner-30":"abcdefghijklm","peers-5":"abdklm","peers-10":"abdhklm","peers-20":"abcdehijklm","peers-30":"abcdefghijklm","partners-5":"abdklm","partners-10":"abdeklm","partners-20":"abcdefhjklm","partners-30":"abcdefghijklm","mixed-5":"abdklm","mixed-10":"abdeklm","mixed-20":"abcdefhjklm","mixed-30":"abcdefghijklm"} },
  result: { name: "결과 보고", note: "끝난 일의 성과와 배운 점을 정리해요", slides: ["표지", "한 장 요약", "섹션: 결과", "목표 대비 결과", "핵심 성과", "섹션: 과정", "진행 과정", "잘된 점", "섹션: 배운 점", "배운 점", "후속 과제", "요청 사항"], plans: {"exec-5":"abdjk","exec-10":"abdehjk","exec-20":"abcdefhijkl","exec-30":"abcdefghijkl","practitioner-5":"abdjk","practitioner-10":"abdegjk","practitioner-20":"abdeghjkl","practitioner-30":"abcdefghijkl","peers-5":"abdjk","peers-10":"abdghjk","peers-20":"abcdfghijkl","peers-30":"abcdefghijkl","partners-5":"abdjk","partners-10":"abdehjk","partners-20":"abcdefhijkl","partners-30":"abcdefghijkl","mixed-5":"abdjk","mixed-10":"abdehjk","mixed-20":"abcdefhijkl","mixed-30":"abcdefghijkl"} },
  issue: { name: "문제·장애 보고", note: "무슨 일인지, 원인과 대책을 알려요", slides: ["표지", "한 장 요약", "영향", "경과", "원인", "재발 방지 대책", "요청 사항"], plans: {"exec-5":"abcef","exec-10":"abcdefg","exec-20":"abcdefg","exec-30":"abcdefg","practitioner-5":"abcef","practitioner-10":"abcdefg","practitioner-20":"abcdefg","practitioner-30":"abcdefg","peers-5":"abcef","peers-10":"abcdefg","peers-20":"abcdefg","peers-30":"abcdefg","partners-5":"abcef","partners-10":"abcdefg","partners-20":"abcdefg","partners-30":"abcdefg","mixed-5":"abcef","mixed-10":"abcdefg","mixed-20":"abcdefg","mixed-30":"abcdefg"} },
  kickoff: { name: "프로젝트 착수", note: "목표, 범위, 일정, 역할을 맞춰요", slides: ["표지", "한 장 요약", "목차", "추진 배경", "목표", "하는 일과 하지 않는 일", "일정", "역할과 담당", "일하는 방식", "위험과 대응", "함께 정할 것"], plans: {"exec-5":"abefgk","exec-10":"abdefgk","exec-20":"abdefghijk","exec-30":"abdefghijk","practitioner-5":"abefgk","practitioner-10":"abdefgk","practitioner-20":"abcdefghijk","practitioner-30":"abcdefghijk","peers-5":"abefgk","peers-10":"abdefgk","peers-20":"abcdefghijk","peers-30":"abcdefghijk","partners-5":"abefgk","partners-10":"abdefgk","partners-20":"abcdefghijk","partners-30":"abcdefghijk","mixed-5":"abefgk","mixed-10":"abdefgk","mixed-20":"abcdefghijk","mixed-30":"abcdefghijk"} },
  research: { name: "조사·분석 보고", note: "시장, 경쟁사, 고객을 조사한 결과를 알려요", slides: ["표지", "한 장 요약", "조사 방법", "섹션: 시장", "시장 추이", "시장 구성", "섹션: 경쟁", "경쟁사 위치", "경쟁사 비교", "섹션: 시사점", "시사점", "다음에 할 일"], plans: {"exec-5":"abehk","exec-10":"abefhkl","exec-20":"abcdefghjkl","exec-30":"abcdefghijkl","practitioner-5":"abehk","practitioner-10":"abefhik","practitioner-20":"abcefhikl","practitioner-30":"abcdefghijkl","peers-5":"abehk","peers-10":"abehikl","peers-20":"abcdeghijkl","peers-30":"abcdefghijkl","partners-5":"abehk","partners-10":"abcefhk","partners-20":"abcdefghjkl","partners-30":"abcdefghijkl","mixed-5":"abehk","mixed-10":"abefhkl","mixed-20":"abcdefghjkl","mixed-30":"abcdefghijkl"} },
  study: { name: "지식 공유·교육", note: "배운 것과 일하는 요령을 나눠요", slides: ["표지", "오늘의 한 줄", "목차", "핵심 내용", "전과 후", "따라 하는 순서", "화면으로 보기", "해 본 사례", "정리"], plans: {"exec-5":"abdfi","exec-10":"abdefgi","exec-20":"abdefghi","exec-30":"abdefghi","practitioner-5":"abdfi","practitioner-10":"abdefgi","practitioner-20":"abcdefghi","practitioner-30":"abcdefghi","peers-5":"abdfi","peers-10":"abdefgi","peers-20":"abcdefghi","peers-30":"abcdefghi","partners-5":"abdfi","partners-10":"abdefgi","partners-20":"abcdefghi","partners-30":"abcdefghi","mixed-5":"abdfi","mixed-10":"abdefgi","mixed-20":"abcdefghi","mixed-30":"abcdefghi"} },
  intro: { name: "팀·업무 소개", note: "팀이 하는 일과 함께 일하는 법을 알려요", slides: ["표지", "한 줄 소개", "숫자로 보는 팀", "하는 일", "일이 오가는 길", "맡은 사람", "올해 계획", "이럴 때 찾아 주세요"], plans: {"exec-5":"abcdh","exec-10":"abcdefh","exec-20":"abcdefgh","exec-30":"abcdefgh","practitioner-5":"abcdh","practitioner-10":"abcdefh","practitioner-20":"abcdefgh","practitioner-30":"abcdefgh","peers-5":"abdeh","peers-10":"abcdefh","peers-20":"abcdefgh","peers-30":"abcdefgh","partners-5":"abcdh","partners-10":"abcdefh","partners-20":"abcdefgh","partners-30":"abcdefgh","mixed-5":"abcdh","mixed-10":"abcdefh","mixed-20":"abcdefgh","mixed-30":"abcdefgh"} },
}

;(() => {
  const sim = document.querySelector('[data-sim]')
  if (!sim) return
  const list = sim.querySelector('[data-deck]')
  const count = sim.querySelector('[data-count]')
  const typeName = sim.querySelector('[data-type-name]')
  const typeNote = sim.querySelector('[data-type-note]')

  function value(name) {
    return sim.querySelector(`input[name="${name}"]:checked`)?.value
  }

  function render() {
    const type = value('type')
    const deck = DECKS[type]
    const key = `${type}-${value('audience')}-${value('minutes')}`
    if (!deck || list.dataset.key === key) return
    list.dataset.key = key
    const plan = deck.plans[key.slice(type.length + 1)] ?? ''
    const items = [...plan].map((ch) => {
      const i = ch.charCodeAt(0) - 97
      const li = document.createElement('li')
      const img = document.createElement('img')
      img.src = `images/decks/${type}-${i}.webp`
      img.width = 512
      img.height = 288
      img.alt = ''
      img.decoding = 'async'
      const name = document.createElement('span')
      name.textContent = deck.slides[i]
      li.append(img, name)
      return li
    })
    list.replaceChildren(...items)
    typeName.textContent = deck.name
    typeNote.textContent = deck.note
    count.textContent = `${items.length}장으로 만들어요`
  }

  sim.addEventListener('change', render)
  sim.querySelectorAll('[data-pick]').forEach((el) => (el.hidden = false))
  sim.querySelector('[data-fallback]').hidden = true
  sim.querySelector('[data-live-note]').hidden = false
  // 뒤로 가기로 돌아오면 브라우저가 고른 단추를 되살린다. HTML에 적힌 기본 구성과 다를 때만 다시 그린다
  render()
})()

// 다운로드: 보고 있는 컴퓨터의 단추를 먼저 보인다. 맨 위에서는 그 단추를 앞에 짙게 두고, 다운로드 구역에서는
// 그 쪽에 '지금 쓰는 컴퓨터'를 붙이고 다른 쪽 단추를 테두리만 둔다. 알 수 없으면(휴대폰, 태블릿, 다른 운영체제) HTML 그대로 둔다
;(() => {
  const platform = navigator.userAgentData?.platform || navigator.platform || ''
  // 아이패드는 platform이 MacIntel이라 손가락 터치로 가른다
  const mine = /^mac/i.test(platform) && navigator.maxTouchPoints < 2 ? 'mac' : /^win/i.test(platform) ? 'win' : null
  if (!mine) return

  const cta = document.querySelector('.cta')
  const first = cta?.querySelector(`a[data-os="${mine}"]`)
  if (cta && first) {
    cta.prepend(first)
    for (const a of cta.querySelectorAll('a[data-os]')) {
      a.classList.toggle('btn-dark', a === first)
      a.classList.toggle('btn-line', a !== first)
    }
  }

  for (const col of document.querySelectorAll('.os-col[data-os]')) {
    const yours = col.dataset.os === mine
    const label = col.querySelector('.os-mine')
    if (label) label.hidden = !yours
    const btn = col.querySelector('.btn')
    btn?.classList.toggle('btn-light', yours)
    btn?.classList.toggle('btn-ghost', !yours)
  }
})()
