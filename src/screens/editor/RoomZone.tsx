import { useRef } from 'react'
import { PlusIcon } from '../ui'
import { useTrackRect } from './useTrackRect'

// 부품 장이 아닌 장의 아래쪽이 비었을 때 그 자리에 띄우는 '여기에 컴포넌트 넣기' (BlockEditor의 useBlockEditing이 띄운다)

/** 본문 상자(.s-body) 아래쪽에서 글이나 그림이 없는 높이 (캔버스 px)와 그 자리의 화면 위치 */
function freeBelow(slideEl: HTMLElement) {
  const body = slideEl.querySelector<HTMLElement>(':scope > .s-body')
  if (!body) return null
  const b = body.getBoundingClientRect()
  const k = slideEl.offsetWidth ? slideEl.getBoundingClientRect().width / slideEl.offsetWidth : 1
  let top = b.bottom
  let bottom = b.top
  for (const el of body.querySelectorAll<HTMLElement>('*')) {
    if (el.classList.contains('ed-halo')) continue
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) continue
    if (r.bottom > bottom) bottom = r.bottom
    if (r.top < top) top = r.top
  }
  // 가운데 맞춘 장(한 문장, 큰 숫자)의 위아래 빈자리는 일부러 비운 것이라 세지 않는다: 위가 붙어 있고 아래만 빈 장만
  const anchored = (top - b.top) / k < 60
  return { free: anchored ? (b.bottom - bottom) / k : 0, rect: new DOMRect(b.left, bottom, b.width, b.bottom - bottom), k }
}

/**
 * 장 아래가 넉넉히 비면 그 자리에 '여기에 부품 넣기'. 누르면 부품 고르기가 열리고, 고른 부품이 그 자리(맨 아래 새 줄)에 들어간다.
 * 끌어다 놓아도 된다. 장이 움직이거나 글이 늘어도 따라가게, 무대의 크기나 장 안이 바뀌거나 스크롤할 때 다시 잰다 (useTrackRect).
 * 이 단추는 body에 붙어 있어서, 여기서 고치는 단추의 style은 무대의 감시에 걸리지 않는다
 */
export function RoomZone({ fits, onOpen }: { fits(h: number): boolean; onOpen(): void }) {
  const ref = useRef<HTMLButtonElement>(null)
  const ok = useRef<{ h: number; fits: boolean; of: (h: number) => boolean } | null>(null)
  useTrackRect(
    () => document.querySelector<HTMLElement>('.ed-canvas'),
    () => {
      const el = ref.current
      const slideEl = document.querySelector<HTMLElement>('.ed-canvas .slide.m-edit')
      const f = slideEl ? freeBelow(slideEl) : null
      // 부품이 들어갈 만한지는 본문 높이가 바뀌거나 다시 그렸을 때(장이 바뀌었을 수 있다, fits가 새것)만 다시 본다
      const areaH = slideEl ? Math.round(slideEl.querySelector<HTMLElement>(':scope > .s-body')?.offsetHeight ?? 0) : 0
      if (f && (ok.current?.h !== areaH || ok.current.of !== fits)) ok.current = { h: areaH, fits: fits(areaH), of: fits }
      if (el && f && f.free >= 220 && ok.current?.fits) {
        const pad = 24 * f.k
        el.style.translate = `${Math.round(f.rect.left)}px ${Math.round(f.rect.top + pad)}px`
        el.style.width = `${Math.round(f.rect.width)}px`
        el.style.height = `${Math.round(f.rect.height - pad)}px`
        el.style.visibility = 'visible'
      } else if (el) el.style.visibility = 'hidden'
    },
  )
  return (
    <button ref={ref} type="button" className="ed-room" style={{ visibility: 'hidden' }} onClick={onOpen}>
      <span className="ed-room-t">
        <PlusIcon />
        여기에 컴포넌트 넣기
      </span>
      <span className="ed-room-s">숫자, 차트, 글을 이 아래에 더 놓을 수 있어요. 컴포넌트 고르기에서 끌어다 놓아도 돼요.</span>
    </button>
  )
}
