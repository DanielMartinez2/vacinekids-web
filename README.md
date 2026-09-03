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

Ainda não implementado:

- autenticação e dependentes;
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

O Fetch foi escolhido por já estar disponível no navegador e atender a este cliente somente de leitura sem adicionar outra abstração. O módulo `src/api/httpClient.ts` centraliza URL, timeout, envelope de resposta e erros amigáveis.

## Arquitetura

```text
PostgreSQL → Prisma → Express REST → vacinekids-web → Catálogo → Detalhes → Carrinho
```

As responsabilidades principais são separadas em:

- `api/`: transporte HTTP e normalização de erros;
- `services/`: operações do domínio de catálogo;
- `types/`: contrato REST e modelo mínimo do carrinho;
- `contexts/`: estado global e persistência do carrinho;
- `components/`: layout, estados e elementos reutilizáveis;
- `pages/`: composição de cada rota;
- `test/`: servidor MSW, fixtures e utilitários de teste.

Os objetos completos da API não são salvos no carrinho. Cada item mantém apenas `type`, `id`, `name`, `price` e `quantity`.

## Como executar

Pré-requisitos: Node.js 22+, npm e o backend `vacinekids-api-demo` configurado com PostgreSQL.

1. No repositório do backend, copie `.env.example` para `.env`, inicie o PostgreSQL e execute:

   ```bash
   npm install
   npm run prisma:migrate
   npm run db:seed
   npm run dev
   ```

2. Neste projeto, crie o ambiente e inicie o frontend:

   ```bash
   cp .env.example .env
   npm install
   npm run dev
   ```

3. Acesse `http://localhost:5173/vacinekids-web/`.

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

## Integração com a API

O frontend consome:

- `GET /api/v1/vaccines` e `GET /api/v1/vaccines/:id`;
- `GET /api/v1/packages` e `GET /api/v1/packages/:id`;
- `GET /api/v1/age-ranges`.

A busca e o filtro `ageRange` por slug são enviados para a API tanto em vacinas quanto em pacotes. A compatibilidade de um pacote com a faixa etária é definida exclusivamente pelo backend, e sua paginação usa `page`, `pageSize` e a metadata retornada pela API.

## Testes e qualidade

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Os testes cobrem catálogo, loading, falha da API, filtro, detalhes, inclusão de vacina e pacote, alteração e remoção, persistência e recuperação segura do `localStorage`.

## GitHub Pages

Foi escolhido `HashRouter`, pois a parte após `#` permanece no navegador e evita erros 404 ao atualizar uma rota diretamente no GitHub Pages. O `vite.config.ts` usa a base `/vacinekids-web/`.

O workflow `.github/workflows/deploy-pages.yml` está preparado para o repositório `vacinekids-web`. Antes de publicar:

1. hospede o backend em uma URL HTTPS pública;
2. configure no repositório a variável `VITE_API_URL` com essa origem;
3. permita no CORS do backend a origem do GitHub Pages;
4. em **Settings → Pages**, selecione **GitHub Actions** como fonte.

O workflow é apenas uma preparação e não publica nada por conta própria até que o repositório exista e o gatilho seja executado.

## Arquitetura original

A primeira versão usava AWS Amplify Gen 1, Cognito, AppSync/GraphQL, DynamoDB, S3 e Lambda, além de uma integração antiga com Mercado Pago. Esta reconstrução de portfólio remove o acoplamento funcional à AWS e separa frontend e backend em aplicações independentes. Nenhuma configuração, endpoint ou segredo do legado foi transportado.

## Observação de saúde

Este é um projeto demonstrativo. Informações de vacinação não substituem avaliação e orientação de um profissional de saúde.
