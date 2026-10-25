import { describe, expect, it } from 'vitest'
import { changeOf, colsOf, formatNumber, gradeOf, gradesOf, isNumericCell, lowerIsBetter, parseDelta, parseNumber, readAmount, readNumber, spanIn, statusOf } from './numbers'

describe('숫자 읽기', () => {
  it('단위와 쉼표가 붙은 값에서 숫자만 읽는다', () => {
    expect(parseNumber('131억 원')).toBe(131)
    expect(parseNumber('1,200억 원')).toBe(1200)
    expect(parseNumber('15.2억 원')).toBe(15.2)
    expect(parseNumber('93%')).toBe(93)
    expect(parseNumber('')).toBe(0)
    expect(parseNumber('미정')).toBe(0)
  })

  it('증감은 보고서에서 쓰는 더하기, 빼기 표기를 모두 받는다', () => {
    expect(parseDelta('+9')).toBe(9)
    expect(parseDelta('9')).toBe(9)
    expect(parseDelta('▲9')).toBe(9)
    expect(parseDelta('-2')).toBe(-2)
    expect(parseDelta('−2')).toBe(-2)
    expect(parseDelta('△2')).toBe(-2)
    expect(parseDelta('▼ 1.5억 원')).toBe(-1.5)
    expect(parseDelta('(-3)')).toBe(-3)
  })

  it('단위까지 읽어 무리의 기준 값으로 바꾼다', () => {
    const read = (t: string, unit?: string) => {
      const a = readAmount(t, unit)
      return a && { base: a.base, kind: a.kind }
    }
    expect(read('6분')).toEqual({ base: 360, kind: 'time' })
    expect(read('40초')).toEqual({ base: 40, kind: 'time' })
    expect(read('1시간 30분')).toEqual({ base: 5400, kind: 'time' })
    expect(read('2년 6개월')?.base).toBeCloseTo(2.5 * 365 * 86400)
    expect(read('3일 이내')).toEqual({ base: 3 * 86400, kind: 'time' })
    expect(read('1.2억 원')).toEqual({ base: 120_000_000, kind: '원' })
    expect(read('8,000만 원')).toEqual({ base: 80_000_000, kind: '원' })
    expect(read('8,000만원')).toEqual({ base: 80_000_000, kind: '원' })
    expect(read('1억 2,000만 원')).toEqual({ base: 120_000_000, kind: '원' })
    expect(read('3억5천만원')).toEqual({ base: 350_000_000, kind: '원' })
    expect(read('3천만 원')).toEqual({ base: 30_000_000, kind: '원' })
    expect(read('1조')).toEqual({ base: 1e12, kind: '' })
    expect(read('93%')).toEqual({ base: 93, kind: '%' })
    expect(read('+3%p')).toEqual({ base: 3, kind: '%' })
    expect(read('120건 이상')).toEqual({ base: 120, kind: '건' })
    expect(read('$1,200')).toEqual({ base: 1200, kind: '달러' })
    expect(read('▼ 1.5억 원')).toEqual({ base: -150_000_000, kind: '원' })
    // 단위 칸이 따로 있으면 숫자만 적은 값은 그 단위로, 자리만 적은 값은 그 단위 무리로
    expect(read('7.2', '억 원')).toEqual({ base: 720_000_000, kind: '원' })
    expect(read('8,000만', '억 원')).toEqual({ base: 80_000_000, kind: '원' })
    expect(read('40초', '분')).toEqual({ base: 40, kind: 'time' })
  })

  it("'분기', '년도', '주차'처럼 몇째인지 적은 말은 기간의 길이로 읽지 않는다", () => {
    expect(readAmount('3분기')?.kind).toBe('분기')
    expect(readAmount('2025년도')?.kind).toBe('년도')
    expect(readAmount('2주차')?.kind).toBe('주차')
  })

  it('어느 숫자인지 모르면 읽지 않는다', () => {
    for (const t of ['', '미정', '3~5일', '2024년 120억', '120건(전년 100건)', '2억 5,000']) expect(readAmount(t), t).toBe(null)
    // 붙임표가 낱말 안에 있으면 빼기가 아니다
    expect(readNumber('A-3')).toBe(3)
  })

  it('적은 숫자 그대로 읽기', () => {
    expect(readNumber('131억 원')).toBe(131)
    expect(readNumber('1,200억 원')).toBe(1200)
    expect(readNumber('93%')).toBe(93)
    expect(readNumber('▼ 1.5억 원')).toBe(-1.5)
    expect(readNumber('△2')).toBe(-2)
    expect(readNumber('(-3)')).toBe(-3)
    expect(readNumber('미정')).toBe(null)
  })

  it('전과 후의 증감은 단위를 같은 기준으로 바꿔 센다', () => {
    const pct = (a: string, b: string) => {
      const c = changeOf(a, b)
      return c && { value: Math.round(c.value * 10) / 10, pp: c.pp }
    }
    expect(pct('6분', '40초')).toEqual({ value: -88.9, pp: false })
    expect(pct('1.2억 원', '8,000만 원')).toEqual({ value: -33.3, pp: false })
    expect(pct('1.2억', '8,000만 원')).toEqual({ value: -33.3, pp: false })
    expect(pct('1시간 30분', '45분')).toEqual({ value: -50, pp: false })
    expect(pct('18개월', '1년')).toEqual({ value: -33.3, pp: false })
    expect(pct('3.2%', '1.1%')).toEqual({ value: -2.1, pp: true })
    expect(pct('120', '150건')).toEqual({ value: 25, pp: false })
    expect(pct('120', '150')).toEqual({ value: 25, pp: false })
  })

  it('견줄 수 없는 단위끼리는 증감을 말하지 않는다', () => {
    for (const [a, b] of [
      ['3건', '40%'],
      ['2명', '5대'],
      ['6분', '40'],
      ['1.2억', '8,000'],
      ['5일', '3건'],
      ['0', '5'],
    ])
      expect(changeOf(a, b), `${a} → ${b}`).toBe(null)
  })

  it('계산한 값은 천 단위 쉼표와 소수 둘째 자리까지', () => {
    expect(formatNumber(131)).toBe('131')
    expect(formatNumber(1234.567)).toBe('1,234.57')
  })

  it('표에서 오른쪽에 맞출 숫자 칸은 금액, 비율, 건수만', () => {
    for (const v of ['4.8억 원', '1,200', '22%', '+3%p', '15곳', '2배', '120건', '3,000만 원', '▲9']) expect(isNumericCell(v), v).toBe(true)
    for (const v of ['11월', '3분기', '12월 1주', '영업기획팀', '약 3억', '']) expect(isNumericCell(v), v).toBe(false)
  })

  it('과제 상태는 적은 글을 먼저 읽고, 비었으면 진행률로 짐작해요', () => {
    expect(statusOf('완료', 60)).toBe('done')
    expect(statusOf('2주 지연', 40)).toBe('late')
    expect(statusOf('진행 중', 40)).toBe('doing')
    expect(statusOf('시작 전', null)).toBe('todo')
    expect(statusOf('검토 중', 50)).toBe(null)
    expect(statusOf('', 100)).toBe('done')
    expect(statusOf('', 0)).toBe('todo')
    expect(statusOf('', 35)).toBe('doing')
    expect(statusOf('', null)).toBe(null)
  })
})

describe('추진 일정의 기간', () => {
  const cols = colsOf('11월 12월 1월 2월 3월')

  it('기간 칸은 띄어 쓰기나 쉼표로 나눈다', () => {
    expect(cols).toEqual(['11월', '12월', '1월', '2월', '3월'])
    expect(colsOf('1분기, 2분기,3분기')).toEqual(['1분기', '2분기', '3분기'])
    expect(colsOf('')).toEqual([])
  })

  it('적은 기간의 처음 칸과 끝 칸을 찾는다', () => {
    expect(spanIn('12월~2월', cols)).toEqual([1, 3])
    expect(spanIn('11월부터 1월까지', cols)).toEqual([0, 2])
    expect(spanIn('3월', cols)).toEqual([4, 4])
    expect(spanIn('12월 2주 ~ 2월 1주', cols)).toEqual([1, 3])
  })

  it("'1월'을 '11월'이나 '12월' 안에서 잡지 않는다", () => {
    expect(spanIn('11월', cols)).toEqual([0, 0])
    expect(spanIn('12월', cols)).toEqual([1, 1])
    expect(spanIn('1', colsOf('1 2 12'))).toEqual([0, 0])
  })

  it('칸 이름이 없으면 막대를 그리지 않는다', () => {
    expect(spanIn('내년 상반기', cols)).toBe(null)
    expect(spanIn('', cols)).toBe(null)
    expect(spanIn('11월', [])).toBe(null)
  })
})

describe('평가표 읽기', () => {
  it('좋음 보통 나쁨과 기호를 읽고, 모르는 글은 그대로 둔다', () => {
    expect(gradesOf('좋음 보통, 나쁨').map(gradeOf)).toEqual(['good', 'mid', 'bad'])
    expect(gradesOf('○ △ ×').map(gradeOf)).toEqual(['good', 'mid', 'bad'])
    expect(gradesOf('상 중 하').map(gradeOf)).toEqual(['good', 'mid', 'bad'])
    expect(gradeOf('1.9억')).toBeNull()
    expect(gradesOf('')).toEqual([])
  })
})

describe('낮을수록 좋은 목표', () => {
  it('이하, 이내, 미만, ≤로 적은 목표를 알아본다', () => {
    for (const t of ['7분 이하', '3일 이내', '불량률 0.5% 미만', '≤ 2건', '<10%']) expect(lowerIsBetter(t), t).toBe(true)
    for (const t of ['117억 원', '90%', '5곳 이상']) expect(lowerIsBetter(t), t).toBe(false)
  })
})
