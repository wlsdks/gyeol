import { createStore, get, set } from 'idb-keyval'

/*
 * 이 브라우저에 기억해 두는 설정. 보관 폴더 핸들(folder.ts)과 새 버전 알림 켜기가 같은 곳에 있다.
 * 이름(html-maker-settings)은 예전에 기억한 보관 폴더를 잃지 않게 그대로 둔다.
 * 주소(http://127.0.0.1:41580)마다 따로라서, 같은 포트로 켜는 새 버전도 이 설정을 그대로 읽는다.
 */
export const settings = createStore('html-maker-settings', 'settings')

const UPDATE_CHECK_KEY = 'updateCheck'

/** 새 버전 알림이 켜져 있는지. 처음에는 켜져 있다. 읽지 못하면(브라우저가 막으면) 확인하지 않는다 */
export async function updateCheckOn(): Promise<boolean> {
  try {
    return (await get<boolean>(UPDATE_CHECK_KEY, settings)) !== false
  } catch {
    return false
  }
}

export async function setUpdateCheck(on: boolean): Promise<void> {
  try {
    await set(UPDATE_CHECK_KEY, on, settings)
  } catch {
    // 기억하지 못해도 이번에 켠 동안은 화면의 값대로 한다
  }
}
