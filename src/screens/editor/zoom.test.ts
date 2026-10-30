import { describe, expect, it } from 'vitest'
import { zoomShift } from '../../slides/SlideCanvas'
import { ZOOM, zoomFor } from './zoom'

// 1280×600 창의 편집기: 장 틀 664×374, 맞춘 배율 0.346
const BASE = 664 / 1920
const VIEW = { w: 664, h: 374 }

describe('쓸 때 크게 보기의 배율', () => {
  it('본문 글자가 화면에서 ZOOM.read px쯤 되게 키운다', () => {
    const z = zoomFor(36, { w: 300, h: 50 }, BASE, VIEW)
    expect(36 * BASE * z).toBeCloseTo(ZOOM.read, 5)
  })

  it('이미 충분히 큰 글자(제목)와 큰 창에서는 키우지 않는다', () => {
    expect(zoomFor(62, { w: 900, h: 80 }, BASE, VIEW)).toBe(1)
    // 1920×1080 창: 장 틀 1304×734, 덧붙임 글자(26px)가 이미 17.7px
    expect(zoomFor(26, { w: 300, h: 40 }, 1304 / 1920, { w: 1304, h: 734 })).toBe(1)
  })

  it('칸의 너비가 장 틀을 넘지 않게: 장 너비를 거의 다 쓰는 칸은 덜 키우거나 키우지 않는다', () => {
    const z = zoomFor(26, { w: 1000, h: 40 }, BASE, VIEW)
    expect(1000 * BASE * z).toBeLessThanOrEqual(VIEW.w - ZOOM.margin * 2 + 0.001)
    expect(zoomFor(26, { w: 1700, h: 40 }, BASE, VIEW)).toBe(1)
  })

  it('높이는 세 줄까지만 본다: 긴 글 칸도 키우고 쓰는 줄을 따라간다', () => {
    expect(zoomFor(30, { w: 400, h: 900 }, BASE, VIEW, 42)).toBeGreaterThan(1)
  })

  it('가장 크게는 ZOOM.max', () => {
    expect(zoomFor(10, { w: 50, h: 14 }, BASE, VIEW)).toBe(ZOOM.max)
  })

  it('다른 칸으로 옮겨도 읽기 좋은 크기면 배율을 그대로 둔다', () => {
    const z = zoomFor(36, { w: 300, h: 50 }, BASE, VIEW)
    // 같은 줄의 진행률(36px)은 그대로, 덧붙임(26px)은 지금 배율로 13px이라 다시 정한다
    expect(zoomFor(36, { w: 200, h: 50 }, BASE, VIEW, 50, z)).toBe(z)
    expect(zoomFor(26, { w: 300, h: 40 }, BASE, VIEW, 36, z)).not.toBe(z)
  })
})

describe('키운 장의 자리', () => {
  it('칸을 틀 가운데에, 장 끝이 틀 안으로 들어오지 않게', () => {
    const S = BASE * 2
    const mid = zoomShift({ x: 960, y: 540 }, S, VIEW.w, VIEW.h)
    expect(mid.x).toBeCloseTo(VIEW.w / 2 - 960 * S)
    // 왼쪽 위 끝의 칸: 장의 왼쪽 위 끝이 틀 왼쪽 위에
    expect(zoomShift({ x: 10, y: 10 }, S, VIEW.w, VIEW.h)).toEqual({ x: 0, y: 0 })
    // 오른쪽 아래 끝의 칸: 장의 오른쪽 아래 끝이 틀 오른쪽 아래에
    const end = zoomShift({ x: 1910, y: 1070 }, S, VIEW.w, VIEW.h)
    expect(end.x + 1920 * S).toBeCloseTo(VIEW.w)
    expect(end.y + 1080 * S).toBeCloseTo(VIEW.h)
  })
})
