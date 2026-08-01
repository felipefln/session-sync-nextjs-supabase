'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(mode: 'signIn' | 'signUp') {
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } =
      mode === 'signIn'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    // Client já escreveu os cookies via @supabase/ssr; router.refresh()
    // força os Server Components a relerem a sessão nesta mesma navegação.
    router.push(redirectTo)
    router.refresh()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        handleSubmit('signIn')
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
    >
      <input
        type="email"
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="senha"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={6}
      />
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="submit" disabled={loading}>
          Entrar
        </button>
        <button type="button" disabled={loading} onClick={() => handleSubmit('signUp')}>
          Criar conta
        </button>
      </div>
    </form>
  )
}
