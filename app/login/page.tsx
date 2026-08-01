import { Suspense } from 'react'
import { LoginForm } from './login-form'

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <div className="card">
        <div className="brand-mark">SS</div>
        <h1>Entrar</h1>
        <p className="subtitle">Acesse sua conta para continuar.</p>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  )
}
