'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    // signOut() precisa rodar no cliente de browser (não numa Route Handler)
    // pra disparar o SIGNED_OUT local que o session-sync propaga pra outras
    // abas via BroadcastChannel.
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button type="button" onClick={handleSignOut}>
      Sair
    </button>
  )
}
