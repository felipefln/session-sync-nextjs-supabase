import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Session Sync Next.js Supabase',
  description: 'Demo de sessão SSR com Supabase e sincronização entre abas',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
