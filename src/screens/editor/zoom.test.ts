import { describe, expect, it } from 'vitest'
import { zoomShift } from '../../slides/SlideCanvas'
import { typicalSize, viewStart, ZOOM, zoomFor } from './zoom'

// 1280×600 창의 편집기: 장 틀 664×374, 맞춘 배율 0.346
const BASE = 664 / 1920
const VIEW = { w: 664, h: 374 }

describe('쓸 때 크게 보기의 배율 (장마다 하나)', () => {
  // 편집기의 장 틀에 맞춘 배율: 1280×600 0.346, 1536×730 0.479, 1512×860 0.467, 1920×960 0.644
  it('작은 창: 장의 가장 작은 글자가 ZOOM.read px쯤 되게, ZOOM.min~ZOOM.max', () => {
    expect(zoomFor(26, BASE)).toBe(ZOOM.max)
    expect(zoomFor(30, 0.43) * 30 * 0.43).toBeCloseTo(ZOOM.read, 5)
    // 글자가 큰 장(가장 작은 글자 30, 36)도 같은 창이면 적어도 ZOOM.min: 장마다 커지고 안 커지고가 다르면 놀란다
    expect(zoomFor(30, 0.479)).toBe(ZOOM.min)
    expect(zoomFor(36, 0.467)).toBe(ZOOM.min)
  })

  it('많아도 장 너비의 70%는 보인다', () => {
    expect(1 / ZOOM.max).toBeGreaterThanOrEqual(0.7 - 1e-9)
  })

  it('대표 글자는 가장 많이 쓰인 크기, 같은 수면 작은 쪽', () => {
    expect(typicalSize([26, 36, 36, 36, 22, 26])).toBe(36)
    expect(typicalSize([30, 26, 30, 26])).toBe(26)
    expect(typicalSize([])).toBeNaN()
  })

  it('본문의 가장 작은 글자(26px)가 이미 읽기 좋은 큰 창(1920×960)에서는 키우지 않는다', () => {
    expect(zoomFor(26, 0.644)).toBe(1)
    expect(zoomFor(22, 0.644)).toBe(1)
  })

  it('잴 수 없으면: 창이 작으면 ZOOM.min, 장 틀이 없으면 1', () => {
    expect(zoomFor(Number.POSITIVE_INFINITY, BASE)).toBe(ZOOM.min)
    expect(zoomFor(26, 0)).toBe(1)
  })
})

describe('키운 장의 보이는 구간', () => {
  const v = 1200
  it('쓰는 칸은 늘 들고, 들 수 있으면 장 제목까지 함께', () => {
    // 제목은 120~200, 쓰는 칸은 600~700
    const x = viewStart([600, 700], [[120, 200]], v, 1080 * 2)
    expect(x).toBeLessThanOrEqual(120)
    expect(x + v).toBeGreaterThanOrEqual(700)
  })

  it('제목까지 넣을 수 없으면 쓰는 칸 가운데 가깝게', () => {
    const x = viewStart([1500, 1600], [[0, 100]], v, 1920)
    expect(x).toBeLessThanOrEqual(1500)
    expect(x + v).toBeGreaterThanOrEqual(1600)
  })

  it('항목이 제목보다 먼저: 둘 다 못 넣으면 항목을', () => {
    const x = viewStart([1000, 1100], [[900, 1700], [100, 200]], 900, 1920)
    expect(x).toBeLessThanOrEqual(900)
    expect(x + 900).toBeGreaterThanOrEqual(1700)
  })

  it('prefer(누른 점이 손 아래에 그대로 있을 자리)가 되는 만큼 그대로', () => {
    expect(viewStart([600, 700], [], v, 1920, 300)).toBe(300)
    // 칸이 들어오지 않는 자리면 들어올 만큼만 옮긴다
    expect(viewStart([600, 700], [], v, 1920, 650)).toBe(600)
  })

  it('장 밖은 보이지 않게, 칸이 구간보다 길면 칸의 앞쪽', () => {
    expect(viewStart([10, 50], [], v, 1920)).toBe(0)
    expect(viewStart([1800, 1910], [], v, 1920)).toBe(1920 - v)
    expect(viewStart([300, 1800], [], v, 1920)).toBe(300)
  })
})

describe('키운 장의 자리', () => {
  it('점을 틀 가운데에, 장 끝이 틀 안으로 들어오지 않게', () => {
    const S = BASE * 1.6
    const mid = zoomShift({ x: 960, y: 540 }, S, VIEW.w, VIEW.h)
    expect(mid.x).toBeCloseTo(VIEW.w / 2 - 960 * S)
    expect(zoomShift({ x: 10, y: 10 }, S, VIEW.w, VIEW.h)).toEqual({ x: 0, y: 0 })
    const end = zoomShift({ x: 1910, y: 1070 }, S, VIEW.w, VIEW.h)
    expect(end.x + 1920 * S).toBeCloseTo(VIEW.w)
    expect(end.y + 1080 * S).toBeCloseTo(VIEW.h)
  })
})
