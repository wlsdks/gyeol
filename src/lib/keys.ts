// 단축키 표기. 쓰는 사람 대부분은 윈도우라 Ctrl이 기본이고, 맥에서만 ⌘로 보인다.

const platform =
  (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? ''

export const isMac = /mac/i.test(platform)

/** 'mod+Z', 'mod+shift+Z', 'F5' 같은 표기를 이 PC에 맞게 바꾼다 */
export function keys(combo: string): string {
  const parts = combo.split('+')
  if (isMac) {
    return parts.map((p) => ({ mod: '⌘', shift: '⇧', alt: '⌥' })[p.toLowerCase()] ?? p).join('')
  }
  return parts.map((p) => ({ mod: 'Ctrl', shift: 'Shift', alt: 'Alt' })[p.toLowerCase()] ?? p).join('+')
}
