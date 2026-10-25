// 받은 값의 꼴을 확인하는 작은 도구들. 모양 파일(share.ts), 제안(ops.ts), 로컬 서버와 MCP 서버가 같이 쓴다.
// 파일마다 따로 적어 두면 한쪽만 느슨해질 수 있어서 한곳에 둔다. 다른 파일을 가져오지 않는다.

/** 배열이 아닌 객체 */
export const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** 키가 모두 allowed 안에 있는지. 모르는 키가 하나라도 있으면 false */
export const onlyKeys = (v: Record<string, unknown>, allowed: readonly string[]) => Object.keys(v).every((k) => allowed.includes(k))

/** min 이상 max 이하의 정수 */
export const isInt = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max

/** 카탈로그 목록({ id })에 있는 id */
export const isOneOf = <T extends string>(list: readonly { id: T }[], v: unknown): v is T => list.some((x) => x.id === v)

/** 객체 자신의 키인지. `in`은 constructor 같은 Object.prototype의 키도 참이라 표(LAYOUTS 등)를 찾을 때 쓰지 않는다 */
export const hasKey = <T extends object>(table: T, key: unknown): key is keyof T => typeof key === 'string' && Object.hasOwn(table, key)

/** #rrggbb 색 코드 */
export const HEX = /^#[0-9a-f]{6}$/i
