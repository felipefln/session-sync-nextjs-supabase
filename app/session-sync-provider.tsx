'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { initSessionSync, subscribeToSessionSync } from '@/lib/supabase/session-sync'

export function SessionSyncProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    initSessionSync()

    // Quando esta aba adota uma sessão que veio de outra (login/refresh/logout),
    // força os Server Components a relerem o cookie já atualizado — sem isso o
    // usuário só veria a mudança num reload manual.
    const unsubscribe = subscribeToSessionSync((event) => {
      if (event.type === 'broadcast-received') router.refresh()
    })
    return () => {
      unsubscribe()
    }
  }, [router])

  return children
}
