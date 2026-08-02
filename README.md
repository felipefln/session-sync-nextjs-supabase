# Questionário:
### 1 - Next.js 15 (App Router): quando usar Server Components vs Client Components? Como isso afeta uma área autenticada (proteção de rotas, sessão SSR vs cliente)?
Server Components por padrão do App Router, deve-se ser usado para buscar dados, acessar banco, secrets, e quando não precisa de interatividade.
Client Components, o use client, deve-se ser usado quando precisa de useState/useEffect, eventos(onClick...), ou APIs de browser.
Server por fora, Client só nas partes interativas de tela visual
Em área autenticada, a sessão é sempre validada no server (cookie httpOnly), nunca apenas num useState no client. (Senão dá flash de conteúdo protegido e é fácil de burlar.)
Middleware: check rápido (tem cookie? redireciona).
Layout/Page Server Component: validação real (decodifica token, checa permissões).
Client Components: só recebem a sessão já pronta via Context, não revalidam sozinhos.

### 2 - Como você usa o TanStack Query para dados autenticados: cache, invalidação, refetch e optimistic updates? Quais armadilhas evita?
Uso query keys incluindo o ID do usuário, pra não misturar cache entre contas. Após mutations, invalido as queries afetadas pra buscar dado atualizado do servidor. Pra updates otimistas, atualizo o cache local antes da resposta do servidor, guardo o estado anterior, e faço rollback se der erro — sempre revalidando no final pra garantir consistência.

Erros de autenticação (401) eu trato à parte, sem ficar tentando de novo várias vezes, e redireciono pro login limpando o cache. E sempre limpo todo o cache no logout, senão dado de um usuário pode vazar pro próximo que logar no mesmo navegador.

### 3 - Quando usar Nanostores vs estado local (useState) vs cache de servidor (TanStack Query)? Dê exemplos.
Uso useState quando o estado é local a um componente e não precisa ser compartilhado, tipo um campo de formulário ou um toggle de menu aberto/fechado.

Uso Nanostores quando o estado é compartilhado entre partes desconectadas da árvore, especialmente entre micro frontends diferentes que não compartilham contexto React — como um carrinho de compras que precisa ser lido por múltiplos módulos independentes.

Uso TanStack Query quando o dado vem do servidor e precisa de cache, revalidação, loading/error state e sincronização entre componentes que consomem a mesma informação, como uma lista de pedidos ou o perfil do usuário.

Na prática: dado que existe no backend é Query; estado de UI efêmero é useState; estado compartilhado entre módulos independentes (sem vir do servidor, ou já derivado dele) é Nanostores.

### 4 - Como você lida com formulários grandes e complexos (validação, performance, UX) - por exemplo, com react-hook-form e zod?
Uso react-hook-form porque ele mantém o formulário majoritariamente não controlado, evitando re-render a cada tecla digitada — isso é essencial em formulários grandes, onde um estado controlado tradicional causaria uma renderização da árvore inteira a cada input.

A validação eu delego ao zod, definindo um schema único que descreve os tipos e regras dos campos, e conecto isso ao react-hook-form via resolver. Isso me dá validação tipada e reaproveitável, tanto no client quanto no server (o mesmo schema pode validar o payload numa Server Action ou API route).

Para performance em formulários grandes, evito assistir o formulário inteiro com watch indiscriminado, prefiro observar campos específicos quando preciso reagir a mudanças, e quebro o formulário em componentes menores usando Controller apenas onde realmente preciso de um componente controlado (como um select customizado ou date picker).

Na UX, valido no blur ou no submit em vez de a cada tecla, pra não incomodar o usuário com erros prematuros enquanto ele ainda está digitando. Uso mensagens de erro claras vindas direto do schema do zod, mostro estados de carregamento no submit pra evitar duplo envio, e para formulários muito longos costumo dividir em etapas (multi-step), guardando o estado intermediário e validando por etapa em vez de tudo de uma vez.

Uma armadilha comum que evito é duplicar a lógica de validação entre front e back — com zod, o mesmo schema serve pros dois lados, o que reduz inconsistência e retrabalho.

### 5 - Como diagnostica e melhora performance (LCP/INP) em um app Next pesado (player de vídeo, editor de questões)?
Primeiro eu meço antes de sair otimizando no escuro — uso Lighthouse pra ter uma base em lab, e dados reais de campo (web-vitals mandando pro analytics) porque isso reflete melhor o que o usuário sente. Pra INP, o Performance panel do Chrome já aponta as long tasks que travam a main thread durante o uso.

Pro LCP, geralmente o problema num app assim é o player de vídeo ou a thumbnail carregando tarde. Eu garanto que a imagem principal carregue com prioridade, adio o carregamento do player pra depois do LCP (import dinâmico sem SSR), uso Server Components pra entregar HTML pronto mais rápido, e cuido de fontes e preconnect pra CDN.

Pro INP, que é mais crítico num editor com bastante interação, o foco é achar re-renders desnecessários que travam a digitação ou o clique. Isolo cada item (tipo cada questão do editor) como componente próprio pra uma mudança não re-renderizar tudo, uso memoização só onde o profiler realmente apontou problema, dou debounce em coisas como autosave, e se tem lista grande, virtualizo. Em casos mais pesados, jogo processamento custoso pra um Web Worker, tirando isso da main thread.

### 6 - Como garante acessibilidade e consistência de UI com Tailwind e um design system (ex.: Radix)?
Uso Radix como base porque ele já resolve acessibilidade de verdade — foco, teclado, ARIA — e o Tailwind entra só pra estilização em cima disso. Pra consistência, centralizo cores, espaçamento e tipografia como tokens no tailwind.config, e encapsulo tudo em componentes reutilizáveis (Button, Modal, Input), pra ninguém remontar do zero e quebrar padrão.

Pra validar acessibilidade, não confio só no Radix: testo navegação por teclado, uso eslint-plugin-jsx-a11y e rodo axe/Lighthouse pra pegar contraste, labels e foco. E cuido pra não depender só de cor pra passar informação, tipo erro de campo ter ícone ou texto, não só borda vermelha.

# session-sync-nextjs-supabase

Investigação e correção do bug de deslogamento aleatório numa app Next.js (App Router) + Supabase (GoTrue), pela ótica do frontend. Este README documenta o raciocínio completo: o que encontrei ao abrir o projeto, como cheguei na causa raiz, e por que cada parte da solução existe.

## O problema

Usuários da plataforma eram deslogados aleatoriamente, sem padrão de tempo claro, principalmente ao trocar de aba/dispositivo ou depois de um período inativo. Autenticação via Supabase (GoTrue), JWT em cookie httpOnly (SSR, Next App Router), segredo de assinatura compartilhado entre API, Worker e Front.

A hipótese inicial a investigar era condição de corrida no refresh do token — refresh tokens de uso único sendo rotacionados entre requisições/abas simultâneas — e/ou dessincronização entre a sessão do servidor (cookie SSR) e a do cliente. O enunciado é explícito em pedir pra não assumir isso como certo e confirmar com dados antes de propor a correção, e foi assim que conduzi o trabalho.

## Ponto de partida

O projeto já tinha um scaffold inicial (Next 16 App Router, `feature/JIRA-01-session-ssr`) com `lib/supabase-browser.ts` e `lib/supabase-server.ts`. Antes de tentar reproduzir qualquer race condition, olhei esse código, porque a causa mais provável de uma sessão SSR dessincronizada geralmente está ali, não em algo exótico.

Os dois arquivos importavam de `@supabase/auth-helpers-nextjs`:

```ts
import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
```

Dois problemas imediatos:

1. **Esse pacote está descontinuado.** A própria Supabase recomenda migrar para `@supabase/ssr` porque o `auth-helpers-nextjs` não tem uma forma consistente de escrever cookies entre Server Components, Route Handlers e Middleware no App Router — cada um desses contextos tem regras diferentes sobre quando é permitido escrever cookie, e o pacote antigo não foi desenhado pensando nisso.
2. **Nem estava instalado.** `@supabase/auth-helpers-nextjs` não aparecia no `package.json` nem em `node_modules`. Ou seja, esse código quebraria no primeiro import — o app nunca tinha rodado de verdade com autenticação.
3. **Não existia `middleware.ts`.** Essa é a peça que, no padrão correto do `@supabase/ssr`, roda a cada request pra renovar o token e reescrever o cookie de forma consistente. Sem ela, qualquer renovação de sessão fica por conta de cada parte do app individualmente, sem um ponto central de verdade.

Isso já apontava a causa raiz mais provável: **a base de autenticação nunca foi implementada com o padrão que mantém servidor e cliente sincronizados.** O restante do trabalho foi (a) construir isso corretamente e (b) confirmar, já com a base certa, se ainda sobrava alguma condição de corrida real entre abas — porque só trocar o pacote não seria suficiente pra cobrir o cenário multi-aba descrito no enunciado.

## Causa raiz, pela ótica do frontend

Depois de reconstruir a base com `@supabase/ssr` (detalhes na seção JIRA-01), fui atrás de dados antes de sair implementando Web Locks/BroadcastChannel só porque "é o padrão recomendado". Duas descobertas mudaram o meu diagnóstico:

**1. As libs já instaladas fazem mais do que eu esperava.** Lendo o código-fonte do `@supabase/auth-js` (2.111.0, a versão instalada), vi que chamadas de refresh concorrentes **dentro da mesma aba** já são dedupadas — o client compartilha uma única promise em voo (`refreshingDeferred`) em vez de disparar duas requisições. E no `supabase/config.toml` do GoTrue local, `refresh_token_reuse_interval = 10` já existia — ou seja, o **servidor** já tolera reenviar o mesmo refresh token (já rotacionado) dentro de uma janela de 10 segundos, sem invalidar a sessão inteira. Essa é literalmente a mitigação server-side pra hipótese de "condição de corrida no refresh".

**2. O gap real está entre abas, e é estrutural, não um bug pontual.** `@supabase/ssr` guarda a sessão em **cookie**. Cookie não dispara nenhum evento de mudança entre abas — diferente do `localStorage`, que tem o evento `storage` (era exatamente esse evento que o `auth-helpers-nextjs` antigo usava pra manter abas sincronizadas). Isso significa que cada aba roda seu próprio `GoTrueClient`, com seu próprio estado em memória e seu próprio timer de auto-refresh, sem nenhuma forma nativa de saber que uma aba irmã acabou de rotacionar o refresh token.

Juntando os dois pontos: se duas abas tentam renovar a sessão dentro da janela de 10s uma da outra, o servidor absorve a race de graça. Mas se uma aba ficou inativa (por exemplo, em background, onde o browser posterga `setTimeout`/`setInterval`, incluindo o timer de auto-refresh do GoTrueClient) e só volta a fazer uma requisição depois que a outra aba já rotacionou o token *fora* dessa janela de 10s, essa aba usa um refresh token que o servidor já invalidou — e cai deslogada, mesmo existindo uma sessão válida no cookie (só desatualizada nessa aba específica). Isso bate exatamente com o sintoma relatado: "sem padrão de tempo claro" e "com frequência ao trocar de aba/dispositivo ou após um período de inatividade" — porque o gatilho não é tempo, é *quantas abas tentaram renovar de forma independente e o quão espaçadas essas tentativas ficaram*.

Resumindo a causa raiz pela ótica do frontend: **a ausência de um mecanismo de sincronização entre abas** (porque cookie não avisa ninguém quando muda) **somada a uma base de sessão SSR que nunca foi implementada com o padrão que evita dessincronização** (`@supabase/ssr` + middleware). Não era só uma race condition isolada — era a combinação de uma fundação errada com a falta de uma peça que o Supabase não resolve sozinho.

## A solução

Separei o trabalho em 4 branches/PRs, cada uma resolvendo uma camada do problema.

### JIRA-01 — Fluxo correto de sessão com `@supabase/ssr`

Substituí os dois arquivos antigos por três peças:

- **`lib/supabase/client.ts`** — `createBrowserClient`, usado nos Client Components. É um **singleton por aba**: cada `createBrowserClient()` novo instancia um `GoTrueClient` independente, com seu próprio timer de auto-refresh. Se várias partes do app chamassem `createClient()` sem reaproveitar a instância, teria concorrência de refresh *dentro da mesma aba*, antes mesmo de pensar em abas diferentes. Isso, sozinho, já é uma forma de "centralização do refresh" (uma das três abordagens que o enunciado sugere para a JIRA-02).
- **`lib/supabase/server.ts`** — `createServerClient`, usado em Server Components e Route Handlers, lendo cookies via `next/headers`. O `setAll` está em `try/catch` porque Server Components não têm permissão de escrever cookie (só ler) — quem efetivamente escreve é o middleware, chamado antes, em toda request.
- **`proxy.ts`** (o Next 16 renomeou a convenção `middleware.ts` para `proxy.ts`) **+ `lib/supabase/middleware.ts`** — a peça central. A função `updateSession` chama `supabase.auth.getUser()` a cada request. É essa chamada que efetivamente dispara o refresh quando o access token expirou, e o retorno dela é reescrito nos cookies **nas duas pontas**: no `request` (pra Server Components dessa mesma passagem já lerem o cookie atualizado) e na `response` (pra o browser receber o `Set-Cookie`). Escrever só numa das duas pontas é, na minha experiência, a causa mais comum de sessão SSR dessincronizada — e é exatamente o tipo de bug sutil que o código herdado corria o risco de ter, dado que usava um pacote que não resolve isso de forma explícita.

Também montei um ambiente Supabase local via CLI + Docker (`supabase/config.toml`) em vez de depender de um projeto cloud, pra o repositório ficar autocontido — qualquer revisor consegue rodar `npx supabase start` e testar com o mesmo backend GoTrue de produção, sem precisar de credenciais externas.

Dois bugs que só apareceram testando o fluxo completo, não no código isolado:
- O middleware só redirecionava quem **não** estava logado pra `/login`. Faltava o caminho inverso — usuário autenticado tentando acessar `/login` continua vendo o formulário. Isso ficou mais evidente ao implementar a JIRA-02, então corrigi lá.
- O botão de logout inicialmente fazia um POST direto pra uma Route Handler server-side. Funcionava (limpava o cookie), mas não passava pelo cliente de browser — então não tinha como propagar o logout pra outras abas depois. Também corrigido na JIRA-02.

### JIRA-02 — Coordenação de refresh entre abas

Com a causa raiz confirmada (cookie não emite evento cross-tab), a solução é justamente criar esse aviso manualmente. Implementei em `lib/supabase/session-sync.ts`:

- **`BroadcastChannel`** — toda aba assina `onAuthStateChange` do client singleton. Quando o evento é `TOKEN_REFRESHED` ou `SIGNED_IN`, a aba publica a nova sessão (access + refresh token) num canal `sb-session-sync`. As outras abas recebem essa mensagem e aplicam a sessão via `supabase.auth.setSession()`, em vez de cada uma tentar descobrir sozinha (e arriscar cair fora da janela de reuse do servidor).
- **Web Locks (`navigator.locks`)** — `refreshSessionCoordinated()` só chama `refreshSession()` depois de adquirir um lock exclusivo (`sb-refresh-lock`). Se várias abas decidirem renovar ao mesmo tempo, só uma de fato bate no Supabase; as outras esperam a vez.
- **Fallback sem Web Locks** — se `navigator.locks` não existir (browser mais antigo), o código simplesmente chama o refresh direto, confiando no dedupe in-tab do `auth-js` e no `refresh_token_reuse_interval` do servidor como rede de segurança.

Um bug real de concorrência apareceu já na primeira versão: usei um flag booleano (`applyingRemoteSession`) pra evitar que a aba que *recebeu* um broadcast reenviasse esse mesmo evento de volta. Só que `setSession()` dispara `onAuthStateChange` de forma assíncrona, e o flag já tinha sido resetado quando o evento realmente chegava — as duas abas entraram num ping-pong infinito de broadcasts (dava pra ver o contador de eventos do DevTools subindo sem parar). Troquei a estratégia: em vez de um flag de timing, guardo o último `access_token` já processado e só propago quando ele muda de verdade. Isso é uma dedução por estado, não por timing, e não tem essa classe de bug.

Foi testando essa parte com duas abas reais que achei os dois bugs que mencionei na JIRA-01: o middleware sem o redirect reverso (aba recebia a sessão certa via broadcast mas ficava presa em `/login` porque a página não checava nada), e o botão de logout que não passava pelo client de browser (então nunca disparava o `SIGNED_OUT` que o `session-sync` depende pra propagar). Os dois foram corrigidos como parte dessa mesma branch, porque só apareceram no teste de ponta a ponta.

### JIRA-03 — UX resiliente a 401

Este é o requisito de "não deslogar na primeira falha": ao receber 401, tentar recuperar a sessão antes de mandar o usuário pro login.

- **`lib/supabase/fetch-with-auth.ts`** — `fetchWithAuth()` faz a requisição normalmente; se vier 401, chama `refreshSessionCoordinated()` (a mesma função da JIRA-02, então o refresh continua coordenado mesmo nesse caminho) e repete a requisição uma única vez. Só desiste (lança `SessionExpiredError`) se o refresh falhar ou o retry também vier 401.
- Pra isso funcionar, precisei ajustar o middleware: ele não pode responder com um redirect HTML (307 pro `/login`) quando quem chamou foi um `fetch()` de API — isso quebraria silenciosamente o tratamento de erro no client (o `fetch` seguiria o redirect e voltaria com o HTML da tela de login, status 200, em vez de um 401 que o código consegue interpretar). Rotas `/api/*` agora passam direto: a autorização vira responsabilidade da própria rota (`app/api/protected/route.ts`, que devolve 401 JSON quando não há usuário).
- Pra demonstrar isso sem depender de esperar o token expirar de verdade (1h por padrão), criei `lib/supabase/demo-corrupt-session.ts`: pega o cookie da sessão atual e corrompe só a assinatura do `access_token` (últimos caracteres do terceiro segmento do JWT), mantendo `expires_at` no futuro e o `refresh_token` intacto. Isso reproduz, de forma determinística, o efeito prático de uma sessão SSR dessincronizada — o cookie parece válido (não expirou pela metadata), mas o servidor rejeita a assinatura. É o mesmo cenário raiz do desafio, só que provocado sob controle em vez de esperar acontecer.

Também aproveitei essa etapa pra dar um acabamento visual nas telas (login e home ainda estavam em HTML cru da JIRA-01) e adicionar validação de campo no formulário de login — email e senha validados no client antes de qualquer round-trip ao Supabase, com mensagem de erro por campo.

### JIRA-04 — Demonstração multi-aba

Consolidei a demonstração numa página dedicada, `/demo`:

- Mostra o id da aba (gerado por aba, na montagem do componente), o email do usuário e um **countdown** até o access token expirar, atualizado a cada segundo.
- Botão "Forçar refresh coordenado" — dispara `refreshSessionCoordinated()` manualmente. Clicando nesse botão em duas abas quase ao mesmo tempo, dá pra ver no log qual aba realmente adquiriu o lock e chamou o Supabase, e a outra recebendo a sessão pronta via broadcast.
- Log de eventos ao vivo, reaproveitando o mesmo barramento (`subscribeToSessionSync`) que a JIRA-02 já expunha: `lock-queued`/`lock-acquired`, `refresh-start`/`refresh-success`/`refresh-error`, `broadcast-sent`/`broadcast-received`, e os eventos brutos de `onAuthStateChange`.
- O painel de recuperação de 401 da JIRA-03 também vive aqui.

Pra essa demonstração ser visível sem esperar 1 hora, baixei o `jwt_expiry` do ambiente Supabase local pra 90 segundos (`supabase/config.toml`, comentado no próprio arquivo — é uma configuração só de dev, não afeta nada em produção).

**Roteiro pra reproduzir o cenário multi-aba:**

1. `npx supabase start && npm install && npm run dev`
2. Logar em `http://localhost:3000/login`
3. Abrir `/demo` em duas abas (a segunda já abre autenticada — prova, por si só, que a sessão está sincronizada entre abas desde o login)
4. Clicar em "Forçar refresh coordenado" nas duas abas em sequência rápida — o log de uma mostra o lock sendo adquirido e o refresh de verdade acontecendo; o log da outra mostra o broadcast chegando, sem uma segunda chamada ao Supabase
5. Deslogar numa aba — a outra desloga sozinha, sem interação
6. No painel de 401: "Corromper cookie" seguido de "Chamar rota protegida" mostra o 401 sendo recuperado antes de qualquer redirect

### Testes automatizados

Adicionei Vitest com escopo propositalmente enxuto — testar o que eu de fato escrevi de lógica custom, não a biblioteca do Supabase em si:

- `lib/supabase/fetch-with-auth.test.ts` — os 4 caminhos do retry em 401 (sucesso direto sem refresh, recupera e reusa a resposta, falha no refresh, falha no retry mesmo após refresh bem-sucedido).
- `lib/supabase/demo-corrupt-session.test.ts` — round-trip da codificação base64url e a função que adultera a assinatura do JWT.

Deixei de fora testes de `middleware.ts` e `session-sync.ts`: estão fortemente acoplados a globals de browser (cookies do Next, `BroadcastChannel`, `navigator.locks`) que exigiriam mockar bastante coisa pra um retorno de garantia relativamente baixo — esses dois já foram validados na prática, testando com abas reais durante as JIRA-02 e JIRA-03.

```bash
npm test
```

## Design

As cores usadas no login e na home (`app/globals.css`) foram extraídas do material oficial da Plataforma Assaad — a cor primária `#0021E1` vem diretamente do SVG da logo (`logo-pa-azul.svg`), não de uma aproximação visual.

## Como rodar

```bash
npx supabase start   # sobe Postgres + GoTrue local via Docker
npm install
cp .env.local.example .env.local   # os valores já são os padrões fixos do Supabase CLI local
npm run dev
npm test
```

Supabase Studio (útil pra inspecionar `auth.users` durante os testes): `http://127.0.0.1:54323`.

## Estrutura relevante

```
app/
  login/                   form de login/signup com validação
  demo/                    demonstração multi-aba (JIRA-04)
  api/protected/           rota de exemplo protegida (JIRA-03)
  page.tsx                 home autenticada
  session-sync-provider.tsx  ativa a coordenação entre abas globalmente
  sign-out-button.tsx      logout client-side (precisa ser client pra disparar o broadcast)
lib/supabase/
  client.ts                cliente de browser (singleton por aba)
  server.ts                cliente de servidor (Server Components / Route Handlers)
  middleware.ts             updateSession: renovação de token + escrita de cookie
  session-sync.ts           BroadcastChannel + Web Locks (JIRA-02)
  fetch-with-auth.ts        fetch com recuperação de sessão em 401 (JIRA-03)
  demo-corrupt-session.ts   utilitário só de demo, simula sessão dessincronizada
proxy.ts                    middleware do Next (convenção renomeada na v16)
supabase/config.toml        ambiente Supabase local (Docker)
```

## Trade-offs conscientes

- O `matcher` do `proxy.ts` cobre todas as rotas exceto assets estáticos. Numa app maior, valeria a pena ter uma lista explícita de rotas públicas em vez de só `/login`.
- `jwt_expiry = 90` e `enable_confirmations = false` são específicos do ambiente local, pra tornar a demo e o teste manual viáveis — não são recomendações pra produção, e estão comentados no `config.toml` explicando isso.
- Não implementei limpeza de sessões órfãs em storage (ex: PKCE code verifiers de fluxos abandonados) — fora do escopo do problema relatado.
