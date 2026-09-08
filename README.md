# VacineKids Web

Frontend público e desacoplado do VacineKids. Esta versão apresenta o catálogo de vacinas e pacotes fornecido pela API REST `vacinekids-api-demo`, páginas de detalhes e um carrinho demonstrativo persistido no navegador.

## Estado atual

Implementado:

- Home responsiva;
- catálogo de vacinas e pacotes;
- busca, faixas etárias e paginação;
- detalhes, composição dos pacotes e FAQs;
- carrinho com quantidade, remoção, limpeza, subtotal e `localStorage`;
- estados de carregamento, erro, API offline, lista vazia e retry;
- integração REST real.
- Fase 1B: cadastro, login, sessão server-side, logout e rota administrativa demonstrativa;
- Fase 2B: Minha Conta com perfil do responsável e dependentes para CUSTOMER.

Ainda não implementado:

- checkout e pedidos;
- pagamentos;
- agendamento;
- área administrativa funcional.

## Stack

- React 19 e TypeScript;
- Vite;
- React Router;
- Fetch API;
- CSS modularizado por área, sem Tailwind;
- Vitest, Testing Library e MSW.

O Fetch foi escolhido por já estar disponível no navegador sem adicionar outra abstração. O módulo `src/api/httpClient.ts` centraliza URL, timeout, GET/POST/PUT/PATCH/DELETE, envelope de resposta e erros amigáveis. `apiGet` mantém seu contrato anterior.

## Arquitetura

```text
PostgreSQL → Prisma → Express REST → vacinekids-web → Catálogo → Detalhes → Carrinho
```

As responsabilidades principais são separadas em:

- `api/`: transporte HTTP e normalização de erros;
- `services/`: operações de catálogo, autenticação, perfil e dependentes;
- `types/`: contratos REST públicos, usuário, conta e modelo mínimo do carrinho;
- `contexts/`: sessão em memória e persistência independente do carrinho;
- `components/`: layout, estados e elementos reutilizáveis;
- `pages/`: composição de cada rota;
- `test/`: servidor MSW, fixtures e utilitários de teste.

Os objetos completos da API não são salvos no carrinho. Cada item mantém apenas `type`, `id`, `name`, `price` e `quantity`.

## Como executar

Pré-requisitos: Node.js 22+, npm e o backend `vacinekids-api-demo` configurado com PostgreSQL.

1. Disponibilize o backend já configurado em `http://localhost:3001`, com `NODE_ENV=development`, `FRONTEND_URL=http://localhost:5173` e conexão exclusivamente ao PostgreSQL local. Não sobrescreva um `.env` vinculado ao Neon. Esta fase não exige migration nem seed.

2. Neste projeto, crie o ambiente e inicie o frontend:

   ```bash
   cp .env.example .env
   npm install
   npm run dev
   ```

3. Acesse `http://localhost:5173/vacinekids-web/`.

Para testar sem editar arquivos de ambiente, no PowerShell defina `$env:VITE_API_URL='http://localhost:3001'` antes de `npm run dev -- --host localhost --port 5173 --strictPort`. Não altere a variável de produção.

No Windows PowerShell, use `Copy-Item .env.example .env` no lugar de `cp`.

### Variável de ambiente

```dotenv
VITE_API_URL=http://localhost:3001
```

Informe a origem da API sem segredo. O cliente acrescenta `/api/v1`. Ele também aceita uma URL que já termine em `/api/v1`.

## Rotas

| Rota | Conteúdo |
| --- | --- |
| `/` | Home |
| `/produtos` | Catálogo completo |
| `/vacinas/:id` | Detalhes de uma vacina |
| `/pacotes/:id` | Detalhes de um pacote |
| `/carrinho` | Seleção persistida |
| `/cadastro` | Cadastro sem login automático |
| `/login` | Entrada e retorno a destino interno permitido |
| `/minha-conta` | Acesso e, para CUSTOMER, perfil do responsável e dependentes; exige sessão |
| `/admin` | Placeholder; exige ADMIN |

As rotas continuam usando HashRouter, por exemplo `http://localhost:5173/vacinekids-web/#/login`.

## Autenticação — Fase 1B

`authService` consome POST `/api/v1/auth/register`, `/login`, `/logout` e GET `/me`. Requisições auth usam `credentials: "include"`; escritas usam JSON e `X-VacineKids-CSRF: 1`. GETs não enviam esse header. Logout aceita 204 sem tentar ler JSON. Consultas públicas do catálogo continuam sem cookies.

`AuthProvider`, dentro do router, reconstrói a sessão por `/me` ao iniciar. 401 é visitante sem erro; rede/5xx produzem erro recuperável e não apagam um usuário previamente confirmado. Logout só limpa o usuário após confirmação; uma falha oferece nova tentativa da revogação, sem fingir saída. Um contador de geração invalida respostas antigas de `/me` após login/logout. A atualização após logout acompanha a prioridade de transição do router para retornar à Home sem disputa com os guards.

`ProtectedRoute` aguarda a sessão, oferece retry em falhas e preserva o destino antes de enviar visitantes ao login. `AdminRoute` mostra 403 para CUSTOMER e permite ADMIN; a segurança real permanece no backend. Somente rotas internas explicitamente permitidas são aceitas como destino pós-login.

Cadastro valida email, senha de 15–128 caracteres Unicode após NFC e confirmação equivalente. Espaços são preservados, inclusive no início/fim; não há regras de composição nem bloqueio de colagem. Login usa a mensagem genérica “Email ou senha inválidos.” em 401. Mensagens internas do backend nunca são apresentadas. Formulários têm labels, autocomplete, feedback com foco e bloqueio durante envio.

Não há JWT, leitura de cookie pelo código da aplicação, armazenamento de usuário/credenciais em Web Storage ou autenticação junto ao carrinho. O único estado persistido pela aplicação continua sendo `vacinekids-cart-v1`. O cookie HttpOnly é responsabilidade do navegador. O Header diferencia visitante/CUSTOMER/ADMIN e mantém menu recolhido em telas de até 1040 px.

Na Fase 1C-A, a publicação no GitHub Pages usa temporariamente a sessão cross-site do Render para medir compatibilidade real antes da decisão sobre domínio próprio. O backend mantém `SameSite=Lax` localmente e usa `SameSite=None; Secure` somente em produção. O dashboard administrativo continua fora desta etapa.

## Minha Conta — Fase 2B

`/minha-conta` mantém os dados de acesso disponíveis enquanto perfil e dependentes carregam em paralelo. CUSTOMER pode criar ou editar o `CustomerProfile` e listar, adicionar, editar e remover dependentes em formulários inline. ADMIN vê somente email, papel e logout: o frontend não chama as APIs exclusivas de CUSTOMER para esse papel.

O telefone aceita apresentação brasileira amigável e é normalizado para E.164 antes do `PUT /profile`; ao exibir um número brasileiro conhecido, a máscara é reaplicada. `birthDate` trafega como data civil `YYYY-MM-DD`, entra diretamente no `input type=date` e é montada como `DD/MM/YYYY` sem conversão por timezone.

Profile e dependentes permanecem somente no estado da página. Eles não são colocados no `AuthProvider`, `localStorage`, `sessionStorage` ou IndexedDB. O carrinho continua sendo o único estado persistido pela aplicação e mantém sua chave independente.

## Integração com a API

O frontend consome:

- `GET /api/v1/vaccines` e `GET /api/v1/vaccines/:id`;
- `GET /api/v1/packages` e `GET /api/v1/packages/:id`;
- `GET /api/v1/age-ranges`;
- `GET` e `PUT /api/v1/profile`;
- `GET` e `POST /api/v1/dependents`;
- `GET`, `PATCH` e `DELETE /api/v1/dependents/:id`.

A busca e o filtro `ageRange` por slug são enviados para a API tanto em vacinas quanto em pacotes. A compatibilidade de um pacote com a faixa etária é definida exclusivamente pelo backend, e sua paginação usa `page`, `pageSize` e a metadata retornada pela API.

## Testes e qualidade

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit
```

Os testes cobrem catálogo, loading, falha da API, filtro, detalhes, inclusão de vacina e pacote, alteração e remoção, persistência e recuperação segura do `localStorage`.

A suíte ampliada também cobre authService/HTTP, AuthProvider, corrida com `/me`, StrictMode, cadastro, login/logout, retorno interno, guards, Header, CustomerProfile, dependentes, normalização de telefone/data e independência do carrinho. `npm test` usa MSW/serviços simulados: não exige banco e não chama produção.

Em 2026-09-08: 135 testes aprovados, lint/typecheck/build aprovados e `npm audit` com zero vulnerabilidades. Não houve atualização de dependências.

### Smoke test opcional em Chrome real

`scripts/auth-local-smoke.mjs` não faz parte de `npm test`. Com API e Vite locais rodando e um Playwright já instalado externamente, defina `PLAYWRIGHT_MODULE` para seu `index.mjs` e `CHROME_EXECUTABLE` para o executável do Chrome. Após conferir explicitamente que o backend aponta ao PostgreSQL loopback, defina `CONFIRM_LOCAL_POSTGRES=yes` e execute:

```bash
node scripts/auth-local-smoke.mjs
```

O script cria uma conta fictícia CUSTOMER via HTTP **local**, valida cookie HttpOnly (incluindo invisibilidade a document.cookie apenas no diagnóstico), reload, 403, falha/recuperação de logout e carrinho. A conta fica no banco local; a sessão criada é revogada. Não promove ADMIN, não altera schema nem executa seed. Bloqueia URLs HTTP externas no contexto do navegador. Não imprime senhas/cookies e não salva storageState. Capturas desktop/mobile ficam em `test-results/`, ignorado pelo Git.

Validação em 2026-09-04: fluxo real aprovado em Chrome, incluindo ausência de restauração após logout. ADMIN foi validado em testes simulados; nenhum ADMIN foi criado.

## GitHub Pages

Foi escolhido `HashRouter`, pois a parte após `#` permanece no navegador e evita erros 404 ao atualizar uma rota diretamente no GitHub Pages. O `vite.config.ts` usa a base `/vacinekids-web/`.

O workflow `.github/workflows/deploy-pages.yml` publica o repositório `vacinekids-web`. A configuração necessária é:

1. backend em uma URL HTTPS pública;
2. variável do repositório `VITE_API_URL` com a origem `https://vacinekids-api-demo.onrender.com`;
3. CORS do backend com a origem exata `https://danielmartinez2.github.io` e credentials habilitadas;
4. **Settings → Pages** usando **GitHub Actions** como fonte.

## Arquitetura original

A primeira versão usava AWS Amplify Gen 1, Cognito, AppSync/GraphQL, DynamoDB, S3 e Lambda, além de uma integração antiga com Mercado Pago. Esta reconstrução de portfólio remove o acoplamento funcional à AWS e separa frontend e backend em aplicações independentes. Nenhuma configuração, endpoint ou segredo do legado foi transportado.

## Identidade visual

A marca pública é **VacineKids**. A logo original combina um V aberto de proteção e acolhimento com um ponto que representa a pessoa cuidada, usando o azul e o verde já presentes na interface.

- `src/assets/branding/vacinekids-logo.svg`: símbolo e nome em curvas vetoriais, usados no Header e na Home;
- `src/assets/branding/vacinekids-mark.svg`: símbolo isolado, usado no Footer e como favicon.

Os SVGs têm fundo transparente, `viewBox` e não dependem de fontes externas. O link da marca no Header mantém um único nome acessível: “VacineKids — página inicial”.

## Observação de saúde

Este é um projeto demonstrativo. Informações de vacinação não substituem avaliação e orientação de um profissional de saúde.
