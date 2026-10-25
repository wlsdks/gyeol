import { BLOCK_GAP } from '../../deck/blocks'
import { FRAME } from '../../deck/frame'

/** 장 캔버스. 슬라이드는 늘 이 크기로 그리고 화면에 맞춰 줄인다 */
export const CANVAS = { w: 1920, h: 1080 } as const

/** 장 본문의 12칸 격자에서 한 칸 너비 (본문 너비는 캔버스에서 좌우 틀을 뺀 것) */
export const COL_W = (CANVAS.w - FRAME.x * 2 - 11 * BLOCK_GAP) / 12
