'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  subscribeToSessionSync,
  refreshSessionCoordinated,
  type SessionSyncEvent,
  type SessionSyncLogEntry,
} from '@/lib/supabase/session-sync'
import { ProtectedDemo } from '../protected-demo'

function formatEvent(event: SessionSyncEvent): string {
  switch (event.type) {
    case 'auth-event':
      return `evento de auth: ${event.event}`
    case 'broadcast-sent':
      return `broadcast enviado para outras abas: ${event.message}`
    case 'broadcast-received':
      return `broadcast recebido de outra aba: ${event.message}`
    case 'lock-queued':
      return 'aguardando o lock de refresh...'
    case 'lock-acquired':
      return 'lock de refresh adquirido, chamando o Supabase'
    case 'refresh-start':
      return 'refresh iniciado'
    case 'refresh-success':
      return 'refresh concluído com sucesso'
    case 'refresh-error':
      return `refresh falhou: ${event.error}`
  }
}

export default function DemoPage() {
  const [tabId] = useState(() => Math.random().toString(36).slice(2, 8))
  const [email, setEmail] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [log, setLog] = useState<SessionSyncLogEntry[]>([])

  useEffect(() => {
    const supabase = createClient()

    async function refreshDisplay() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setEmail(session?.user.email ?? null)
      setExpiresAt(session?.expires_at ? session.expires_at * 1000 : null)
    }
    refreshDisplay()

    const unsubscribe = subscribeToSessionSync((event) => {
      setLog((prev) => [...prev.slice(-29), event])
      if (event.type === 'auth-event' || event.type === 'broadcast-received') refreshDisplay()
    })

    const tick = setInterval(() => setNow(Date.now()), 1000)

    return () => {
      unsubscribe()
      clearInterval(tick)
    }
  }, [])

  const secondsLeft = expiresAt ? Math.max(0, Math.round((expiresAt - now) / 1000)) : null

  return (
    <main className="page-shell">
      <div className="top-bar">
        <div>
          <h1>Demo multi-aba</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            Aba <strong>{tabId}</strong> · {email}
          </p>
        </div>
        <Link href="/" className="btn btn-secondary">
          Voltar
        </Link>
      </div>

      <section className="panel">
        <h2>Sessão nesta aba</h2>
        <p className="subtitle">
          Access token expira em{' '}
          <strong>{secondsLeft === null ? '—' : `${secondsLeft}s`}</strong>. Abra esta página em
          outra aba e clique em &quot;Forçar refresh coordenado&quot; nas duas quase ao mesmo
          tempo: pelo log dá pra ver que só uma aba de fato adquire o lock e chama o Supabase — a
          outra recebe a sessão já pronta via broadcast.
        </p>
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              refreshSessionCoordinated().catch(() => {})
            }}
          >
            Forçar refresh coordenado
          </button>
        </div>
      </section>

      <ProtectedDemo />

      <section className="panel">
        <h2>Log de coordenação ({log.length})</h2>
        {log.length === 0 ? (
          <p className="subtitle">Nenhum evento ainda nesta aba.</p>
        ) : (
          <ul className="event-log">
            {log.map((entry, index) => (
              <li key={`${entry.at}-${index}`}>
                [{new Date(entry.at).toLocaleTimeString()}] {formatEvent(entry)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
