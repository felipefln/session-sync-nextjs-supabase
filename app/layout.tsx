import type { Metadata } from 'next'
import './globals.css'
import { SessionSyncProvider } from './session-sync-provider'

export const metadata: Metadata = {
  title: 'Session Sync Next.js Supabase',
  description: 'Demo de sessão SSR com Supabase e sincronização entre abas',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <SessionSyncProvider>{children}</SessionSyncProvider>
      </body>
    </html>
  )
}
