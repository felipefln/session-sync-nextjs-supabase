'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fetchWithAuth, SessionExpiredError } from '@/lib/supabase/fetch-with-auth'
import { corruptSessionAccessTokenCookie } from '@/lib/supabase/demo-corrupt-session'

type LogEntry = { at: number; text: string; kind: 'info' | 'error' | 'success' }

export function ProtectedDemo() {
  const router = useRouter()
  const [log, setLog] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)

  function push(text: string, kind: LogEntry['kind'] = 'info') {
    setLog((prev) => [...prev.slice(-9), { at: Date.now(), text, kind }])
  }

  async function corruptSession() {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      push('Nenhuma sessão ativa para corromper.', 'error')
      return
    }

    const ok = corruptSessionAccessTokenCookie(session.access_token)
    push(
      ok
        ? 'Cookie corrompido: access_token inválido, refresh_token continua válido.'
        : 'Não encontrei o cookie da sessão pra corromper.',
      ok ? 'info' : 'error'
    )
  }

  async function callProtectedRoute() {
    setLoading(true)
    push('GET /api/protected ...')
    try {
      const response = await fetchWithAuth('/api/protected')
      const data = await response.json()
      push(`Sucesso (${response.status}): ${JSON.stringify(data)}`, 'success')
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        push('Sessão realmente expirada, indo para /login...', 'error')
        router.push('/login')
      } else {
        push(`Erro inesperado: ${String(error)}`, 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="panel">
      <h2>Recuperação de sessão em 401</h2>
      <p className="subtitle">
        &quot;Corromper cookie&quot; simula uma sessão SSR dessincronizada (access token
        inválido, refresh token OK). Ao chamar a rota protegida em seguida, o 401 é
        recuperado com um refresh coordenado antes de qualquer redirect.
      </p>
      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={corruptSession} disabled={loading}>
          Corromper cookie
        </button>
        <button type="button" className="btn btn-primary" onClick={callProtectedRoute} disabled={loading}>
          Chamar rota protegida
        </button>
      </div>
      {log.length > 0 && (
        <ul className="event-log" style={{ marginTop: '1rem' }}>
          {log.map((entry) => (
            <li key={entry.at}>
              [{new Date(entry.at).toLocaleTimeString()}] {entry.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
