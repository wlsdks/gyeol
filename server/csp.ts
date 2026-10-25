/** 화면이 이 PC 밖으로 연결하지 못하게 하는 규칙. 서버 응답 헤더와 빌드한 index.html에 같이 쓴다. */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self' data: blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ')

/** 빌드한 index.html의 meta에 넣는 CSP. frame-ancestors는 meta에서 무시되므로 뺀다(서버 헤더에는 있다) */
export const CSP_META = CSP.replace(/; frame-ancestors 'none'/, '')
