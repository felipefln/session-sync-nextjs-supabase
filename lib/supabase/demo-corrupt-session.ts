'use client'

// Utilitário só de demonstração (JIRA-03): corrompe a assinatura do
// access_token guardado no cookie da sessão, mantendo `expires_at` no futuro
// e o refresh_token intacto. O cliente em memória não percebe nada (não
// passa pelo GoTrueClient), mas a próxima chamada ao servidor falha com 401
// porque a assinatura não bate — o mesmo efeito prático de uma sessão SSR
// dessincronizada, sem precisar esperar o token expirar de verdade.

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  return atob(padded)
}

function toBase64Url(value: string) {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function tamperSignature(accessToken: string) {
  const parts = accessToken.split('.')
  if (parts.length !== 3) return accessToken
  const signature = parts[2]
  const lastChar = signature[signature.length - 1]
  const replacement = lastChar === 'A' ? 'B' : 'A'
  return `${parts[0]}.${parts[1]}.${signature.slice(0, -1)}${replacement}`
}

export function corruptSessionAccessTokenCookie(currentAccessToken: string): boolean {
  for (const entry of document.cookie.split('; ')) {
    const separator = entry.indexOf('=')
    if (separator === -1) continue

    const name = entry.slice(0, separator)
    const rawValue = entry.slice(separator + 1)
    if (!rawValue.startsWith('base64-')) continue

    try {
      const session = JSON.parse(fromBase64Url(rawValue.slice('base64-'.length)))
      if (session?.access_token !== currentAccessToken) continue

      const tampered = { ...session, access_token: tamperSignature(session.access_token) }
      const encoded = 'base64-' + toBase64Url(JSON.stringify(tampered))
      document.cookie = `${name}=${encoded}; path=/; max-age=3600; samesite=lax`
      return true
    } catch {
      continue
    }
  }
  return false
}
