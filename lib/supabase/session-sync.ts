'use client'

import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { createClient } from './client'

const CHANNEL_NAME = 'sb-session-sync'
const REFRESH_LOCK_NAME = 'sb-refresh-lock'

type BroadcastMessage =
  | { type: 'SESSION_UPDATED'; accessToken: string; refreshToken: string }
  | { type: 'SIGNED_OUT' }

export type SessionSyncEvent =
  | { type: 'auth-event'; event: string }
  | { type: 'broadcast-sent'; message: BroadcastMessage['type'] }
  | { type: 'broadcast-received'; message: BroadcastMessage['type'] }
  | { type: 'lock-queued' }
  | { type: 'lock-acquired' }
  | { type: 'refresh-start' }
  | { type: 'refresh-success' }
  | { type: 'refresh-error'; error: string }

type Listener = (event: SessionSyncEvent & { at: number }) => void

const listeners = new Set<Listener>()

function emit(event: SessionSyncEvent) {
  const withTime = { ...event, at: Date.now() }
  listeners.forEach((listener) => listener(withTime))
}

export function subscribeToSessionSync(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

let channel: BroadcastChannel | null = null
let initialized = false

// Último access_token que esta aba já processou (recebido por broadcast ou
// gerado localmente). Usado pra deduplicar em vez de um flag de timing: como
// `setSession()` dispara `onAuthStateChange` de forma assíncrona, um flag do
// tipo "estou aplicando agora" pode já ter sido resetado quando o evento
// realmente chega, causando ping-pong infinito entre as abas.
let lastKnownAccessToken: string | null = null

function getChannel() {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME)
  return channel
}

/**
 * Propaga login/refresh/logout entre abas via BroadcastChannel. Necessário
 * porque @supabase/ssr guarda a sessão em cookie, e cookie não dispara um
 * evento de mudança entre abas como o `storage` do localStorage — sem isso,
 * cada aba só percebe que a sessão mudou na próxima vez que ela mesma tentar
 * usar (ou renovar) um token já ultrapassado.
 */
export function initSessionSync() {
  if (initialized) return
  initialized = true

  if (process.env.NODE_ENV !== 'production') {
    subscribeToSessionSync((event) => console.debug('[session-sync]', event))
  }

  const supabase = createClient()
  const bc = getChannel()

  supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
    emit({ type: 'auth-event', event })

    if (!bc) return

    if (event === 'SIGNED_OUT') {
      if (lastKnownAccessToken === null) return // já propagado, evita eco
      lastKnownAccessToken = null
      bc.postMessage({ type: 'SIGNED_OUT' } satisfies BroadcastMessage)
      emit({ type: 'broadcast-sent', message: 'SIGNED_OUT' })
      return
    }

    if ((event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') && session) {
      if (session.access_token === lastKnownAccessToken) return // já propagado, evita eco
      lastKnownAccessToken = session.access_token
      bc.postMessage({
        type: 'SESSION_UPDATED',
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
      } satisfies BroadcastMessage)
      emit({ type: 'broadcast-sent', message: 'SESSION_UPDATED' })
    }
  })

  if (bc) {
    bc.onmessage = async (event: MessageEvent<BroadcastMessage>) => {
      const message = event.data
      emit({ type: 'broadcast-received', message: message.type })

      if (message.type === 'SIGNED_OUT') {
        lastKnownAccessToken = null
        await supabase.auth.signOut({ scope: 'local' })
      } else {
        lastKnownAccessToken = message.accessToken
        await supabase.auth.setSession({
          access_token: message.accessToken,
          refresh_token: message.refreshToken,
        })
      }
    }
  }
}

/**
 * Renovação de sessão coordenada por Web Locks: se várias abas decidirem
 * renovar ao mesmo tempo, só uma de fato chama o Supabase por vez — as
 * demais esperam a vez e, quando chega, reaproveitam a sessão já renovada
 * (o auth-js dedupa chamadas repetidas dentro da mesma instância/aba).
 * Sem Web Locks (browser sem suporte), cai no dedupe in-tab do auth-js e no
 * `refresh_token_reuse_interval` do GoTrue como rede de segurança.
 */
export async function refreshSessionCoordinated() {
  const supabase = createClient()

  const run = async () => {
    emit({ type: 'refresh-start' })
    const { data, error } = await supabase.auth.refreshSession()
    if (error) {
      emit({ type: 'refresh-error', error: error.message })
      throw error
    }
    emit({ type: 'refresh-success' })
    return data
  }

  if (typeof navigator === 'undefined' || !navigator.locks) {
    return run()
  }

  emit({ type: 'lock-queued' })
  return navigator.locks.request(REFRESH_LOCK_NAME, async () => {
    emit({ type: 'lock-acquired' })
    return run()
  })
}
