import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { browserTries, windowsBrowsers } from './browser'

const URL = 'http://127.0.0.1:41580/'

describe('브라우저로 열기', () => {
  it('윈도우는 찾은 크롬, 엣지를 앱 창으로 열고, 없으면 기본 브라우저의 탭으로', () => {
    const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    expect(browserTries(URL, 'win32', [chrome, edge])).toEqual([
      [chrome, [`--app=${URL}`]],
      [edge, [`--app=${URL}`]],
      ['explorer', [URL]],
    ])
    expect(browserTries(URL, 'win32', [])).toEqual([['explorer', [URL]]])
  })

  it('맥은 켜져 있는 크롬에도 앱 창을 띄우게 open -n으로, 마지막은 기본 브라우저', () => {
    const tries = browserTries(URL, 'darwin')
    expect(tries[0]).toEqual(['open', ['-n', '-a', 'Google Chrome', '--args', `--app=${URL}`]])
    expect(tries[1]).toEqual(['open', ['-n', '-a', 'Microsoft Edge', '--args', `--app=${URL}`]])
    expect(tries.at(-1)).toEqual(['open', [URL]])
  })

  it('브라우저 프로필은 바꾸지 않는다 (발표가 든 브라우저 저장소가 그대로 보이게)', () => {
    for (const platform of ['win32', 'darwin', 'linux'] as const) {
      for (const [, args] of browserTries(URL, platform, ['chrome.exe'])) {
        expect(args.some((a) => a.startsWith('--user-data-dir') || a.startsWith('--profile-directory'))).toBe(false)
      }
    }
  })

  it('윈도우에서 크롬을 엣지보다 먼저, 설치된 것만 고른다', () => {
    const env = { PROGRAMFILES: 'C:\\PF', 'PROGRAMFILES(X86)': 'C:\\PF86', LOCALAPPDATA: 'C:\\U\\AppData\\Local' }
    const edge = join('C:\\PF86', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    const chrome = join('C:\\U\\AppData\\Local', 'Google', 'Chrome', 'Application', 'chrome.exe')
    const installed = new Set([edge, chrome])
    expect(windowsBrowsers(env, (f) => installed.has(f))).toEqual([chrome, edge])
    expect(windowsBrowsers(env, () => false)).toEqual([])
  })
})
