'use client'

import { useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type FieldErrors = {
  email?: string
  password?: string
}

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {}

  if (!email.trim()) {
    errors.email = 'Informe seu email.'
  } else if (!EMAIL_PATTERN.test(email.trim())) {
    errors.email = 'Email em formato inválido.'
  }

  if (!password) {
    errors.password = 'Informe sua senha.'
  } else if (password.length < 6) {
    errors.password = 'A senha precisa ter pelo menos 6 caracteres.'
  }

  return errors
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent, mode: 'signIn' | 'signUp') {
    e.preventDefault()
    setFormError(null)

    const errors = validate(email, password)
    setFieldErrors(errors)
    if (errors.email || errors.password) return

    setLoading(true)
    const supabase = createClient()
    const { error } =
      mode === 'signIn'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password })
    setLoading(false)

    if (error) {
      setFormError(error.message)
      return
    }

    router.push(redirectTo)
    router.refresh()
  }

  return (
    <form onSubmit={(e) => handleSubmit(e, 'signIn')} noValidate>
      {formError && <p className="alert alert-danger">{formError}</p>}

      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setFieldErrors((prev) => ({ ...prev, ...validate(email, password) }))}
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? 'email-error' : undefined}
        />
        {fieldErrors.email && (
          <p className="field-error" id="email-error">
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="password">Senha</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setFieldErrors((prev) => ({ ...prev, ...validate(email, password) }))}
          aria-invalid={Boolean(fieldErrors.password)}
          aria-describedby={fieldErrors.password ? 'password-error' : undefined}
        />
        {fieldErrors.password && (
          <p className="field-error" id="password-error">
            {fieldErrors.password}
          </p>
        )}
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={loading}
          onClick={(e) => handleSubmit(e, 'signUp')}
        >
          Criar conta
        </button>
      </div>
    </form>
  )
}
