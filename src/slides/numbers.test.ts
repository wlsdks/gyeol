import { describe, expect, it } from 'vitest'
import { colsOf, formatNumber, gradeOf, gradesOf, isNumericCell, parseDelta, parseNumber, spanIn, statusOf } from './numbers'

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
