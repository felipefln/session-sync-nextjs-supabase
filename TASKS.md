# Tasks — desafio session-sync-nextjs-supabase

Quebra do desafio em tasks no estilo JIRA, uma branch por task (`feature/JIRA-XX-slug`).
Cada task só é dada como concluída com build passando e teste manual no browser quando aplicável.

## JIRA-01 — Fluxo correto de sessão com @supabase/ssr
**Branch atual:** `feature/JIRA-01-session-ssr`
Requisito (1) do desafio: middleware + cliente de servidor + cliente de browser consistentes.

**Ponto de partida (commit `870c987`, já na branch):** estrutura inicial `app/`, `layout.tsx`, `page.tsx`.
Débito herdado a corrigir nesta task: `lib/supabase-browser.ts` e `lib/supabase-server.ts` usam
`@supabase/auth-helpers-nextjs` (pacote descontinuado pela Supabase, nem está instalado — import quebrado).

- [ ] Ambiente Supabase local (CLI + Docker) para testar sem depender de credenciais externas
- [ ] Remover `@supabase/auth-helpers-nextjs`; instalar `@supabase/ssr` + `@supabase/supabase-js`
- [ ] `lib/supabase/client.ts` — `createBrowserClient` (browser)
- [ ] `lib/supabase/server.ts` — `createServerClient` (Server Components / Route Handlers, cookies via `next/headers`)
- [ ] `middleware.ts` — `updateSession`: chama `getUser()` a cada request, reescreve cookies na `NextResponse` (request e response), único ponto que decide redirect para rota protegida
- [ ] Página de login (email/senha) e rota protegida simples para validar o fluxo ponta a ponta
- [ ] Teste manual: login, refresh da página, cookie SSR e sessão client batendo

## JIRA-02 — Coordenação de refresh entre abas/requisições simultâneas
Requisito (2): evitar renovações concorrentes (refresh token de uso único).
- [ ] Escolher mecanismo: Web Locks API (`navigator.locks.request`) como mutex de refresh + `BroadcastChannel` para notificar as outras abas que a sessão mudou (evita que cada aba dispare seu próprio refresh)
- [ ] Centralizar o disparo de refresh em um único módulo client-side (nenhuma aba chama `refreshSession` diretamente sem passar pelo lock)
- [ ] Fallback para browsers sem Web Locks (ex.: só BroadcastChannel + flag em memória)

## JIRA-03 — UX resiliente a 401
Requisito (3): ao receber 401, tentar recuperar sessão antes de redirecionar pro login.
- [ ] Wrapper de fetch/client (ex.: `fetchWithAuth`) que, ao ver 401, tenta `refreshSession` (via o mesmo mecanismo coordenado da JIRA-02) e repete a request uma vez
- [ ] Só redireciona para `/login` se o refresh também falhar
- [ ] Rota de API de exemplo que retorna 401 propositalmente para testar o fluxo

## JIRA-04 — Demonstração do cenário multi-aba
Requisito (4): demo reproduzível com múltiplas abas abertas.
- [ ] Página `/demo` com: id da aba, timestamp de expiração do access token, log de eventos (refresh iniciado/concluído, lock adquirido/negado, broadcast recebido)
- [ ] Roteiro reproduzível: abrir N abas, forçar expiração/refresh quase simultâneo, mostrar que só uma aba de fato chama o Supabase e as demais reaproveitam via broadcast
- [ ] (Opcional) script ou instruções para simular a condição de corrida original (sem a correção) e comparar com o comportamento corrigido

## JIRA-05 — README (causa raiz + solução)
- [ ] Causa raiz pela ótica do front, com dados/evidência do que foi observado no código herdado (uso de pacote descontinuado, ausência de middleware, refresh não coordenado)
- [ ] Como cada parte da solução (JIRA-01 a JIRA-04) resolve a causa raiz
- [ ] Passo a passo para rodar a demo multi-aba localmente

---
Vamos trabalhar uma task por vez, começando pela JIRA-01.
