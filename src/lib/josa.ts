// 한국어 조사를 앞 낱말의 받침에 맞춰 고른다. 화면 문구에 사람이 붙인 이름(발표, 버전, 레이아웃의 항목 이름)이 들어갈 때
// '을(를)'처럼 둘 다 쓰지 않고 읽히는 대로 쓰려고.

/** 받침이 있으면 앞의 조사, 없으면 뒤의 조사 ('표는', '막대 비교는') */
export function josa(word: string, withFinal: string, without: string): string {
  return word + particle(word, withFinal, without)
}

/**
 * 조사만 ('‘시장 규모’는'처럼 따옴표 뒤에 붙일 때). 끝의 따옴표와 괄호는 넘기고 그 앞 글자로 본다.
 * 숫자는 읽는 소리로: 0(영), 1(일), 3(삼), 6(육), 7(칠), 8(팔)은 받침이 있다.
 * '으로/로'는 ㄹ 받침 뒤에도 '로'다 ('서울로', '1로')
 */
export function particle(word: string, withFinal: string, without: string): string {
  const w = word.trim().replace(/[\s'"’”)\]」』>]+$/u, '')
  const c = w.charCodeAt(w.length - 1) - 0xac00
  const ro = withFinal === '으로'
  if (c >= 0 && c < 11172) {
    const final = c % 28
    return final === 0 || (ro && final === 8) ? without : withFinal
  }
  return (ro ? /[036]$/ : /[013678]$/).test(w) ? withFinal : without
}
