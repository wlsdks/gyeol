import { useEffect, useState } from 'react'

export type Route = { name: 'home' } | { name: 'new' } | { name: 'edit'; id: string }

function parse(hash: string): Route {
  const path = hash.replace(/^#/, '')
  const edit = /^\/edit\/([\w-]+)/.exec(path)
  if (edit) return { name: 'edit', id: edit[1] }
  if (path.startsWith('/new')) return { name: 'new' }
  return { name: 'home' }
}

export function go(route: Route) {
  location.hash = route.name === 'edit' ? `/edit/${route.id}` : route.name === 'new' ? '/new' : '/'
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parse(location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export function timeAgo(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return '방금'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}분 전`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}시간 전`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}일 전`
  return new Intl.DateTimeFormat('ko-KR').format(ts)
}
