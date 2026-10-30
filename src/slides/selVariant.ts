/**
 * 쓰는 칸 표시(.ed-halo)의 시안을 바꿔 보는 개발용 스위치. 사용자가 시안을 고르면 이 파일과 edit.css의 [data-sel] 규칙을 걷고
 * 고른 것을 기본으로 굳힌다. 화면에는 나오지 않는다.
 * 고르는 법: 주소 뒤에 ?sel=a (해시 안의 ?sel=a도), 또는 localStorage 'html-maker:sel-variant'에 a|b|c|d. 'base'나 빈 값이면 지금 모습.
 *  a 글에 맞춘 테   b 글 밑줄   c 칸 자리 면   d 글에 맞춘 테 + 상태 위계(올리면 점선, 고른 줄 면은 쓰는 동안 걷기)
 */
export type SelVariant = '' | 'a' | 'b' | 'c' | 'd'

const KEY = 'html-maker:sel-variant'

function read(): SelVariant {
  if (typeof window === 'undefined') return ''
  const pick = (v: string | null | undefined): SelVariant | undefined => (v === 'a' || v === 'b' || v === 'c' || v === 'd' ? v : v === 'base' ? '' : undefined)
  const hashQuery = window.location.hash.split('?')[1]
  const fromUrl = pick(new URLSearchParams(window.location.search).get('sel')) ?? pick(new URLSearchParams(hashQuery ?? '').get('sel'))
  try {
    if (fromUrl !== undefined) localStorage.setItem(KEY, fromUrl || 'base')
    return fromUrl ?? pick(localStorage.getItem(KEY)) ?? ''
  } catch {
    return fromUrl ?? ''
  }
}

export const selVariant: SelVariant = read()

if (typeof document !== 'undefined' && selVariant) document.documentElement.dataset.sel = selVariant

/** 글 둘레를 재야 하는 시안인지 (a, b, d: 테를 칸 상자가 아니라 그려진 글에 맞춘다) */
export const fitsText = selVariant === 'a' || selVariant === 'b' || selVariant === 'd'
