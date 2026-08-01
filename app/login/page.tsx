import { Suspense } from 'react'
import { LoginForm } from './login-form'

export default function LoginPage() {
  return (
    <main style={{ maxWidth: 360, margin: '4rem auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Entrar</h1>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  )
}
