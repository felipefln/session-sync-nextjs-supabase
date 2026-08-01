import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/auth']

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Precisa ser escrito nas duas pontas: no `request` (para que Server
          // Components desta mesma passada já leiam o cookie atualizado) e na
          // `response` (para que o browser receba o Set-Cookie). Escrever só
          // numa das duas é a causa raiz mais comum de sessão SSR dessincronizada.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Não executar nenhuma lógica entre createServerClient e getUser(): getUser()
  // é o que efetivamente dispara o refresh do token quando o access token
  // expirou, e é o retorno dele (via setAll acima) que mantém o cookie válido.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isPublicPath = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path))

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  // Sessão chegou via broadcast de outra aba enquanto esta ficou parada em
  // /login: manda pra rota autenticada em vez de deixar o form parado ali.
  if (user && request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = request.nextUrl.searchParams.get('redirectTo') ?? '/'
    url.searchParams.delete('redirectTo')
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
