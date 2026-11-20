<div align="center">

# 📅 Agenda Inteligente
### *Plataforma de Alta Performance & Gestão de Tempo no Padrão Apple*

[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Framer Motion](https://img.shields.io/badge/Framer_Motion-11.3-black?style=for-the-badge&logo=framer&logoColor=white)](https://www.framer.com/motion/)
[![Node.js](https://img.shields.io/badge/Node.js-20_LTS-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-5.18-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![JWT](https://img.shields.io/badge/JWT-Protected-black?style=for-the-badge&logo=jsonwebtokens&logoColor=white)](https://jwt.io/)
[![PWA](https://img.shields.io/badge/Apple_PWA-MacBook_%7C_iPhone_%7C_iPad-000000?style=for-the-badge&logo=apple&logoColor=white)](https://web.dev/progressive-web-apps/)
[![Deploy](https://img.shields.io/badge/Deploy-Railway_%7C_Coolify-7928CA?style=for-the-badge&logo=railway&logoColor=white)](https://railway.app/)

<p align="center">
  <b>Uma experiência executiva, fluida e sofisticada para planejar o dia, a semana, o mês e o ano.</b><br>
  Construída sob medida com base nas diretrizes de design da Apple (Human Interface Guidelines), combinando a elegância do Glassmorphism com uma robusta arquitetura Full-Stack TypeScript e inteligência de automação de pendências.
</p>

[Visão Geral](#-visão-geral) •
[Funcionalidades](#-principais-funcionalidades) •
[Tecnologias](#-tecnologias--arquitetura) •
[Deploy (Railway & Coolify)](#-deploy-em-produção) •
[Execução Local](#-como-executar-localmente) •
[Variáveis de Ambiente](#-variáveis-de-ambiente)

---

</div>

## 🌟 Visão Geral

A **Agenda Inteligente** foi concebida para atender à rotina dinâmica de liderança e gestão de compromissos do **Pastor Keidson**. Ela une o que há de mais moderno no ecossistema Web:
- **Design System Apple Autêntico:** Tipografia nobre (*Bricolage Grotesque* & *Figtree*), alternância instantânea entre **Modo Escuro (Dark)** e **Modo Claro (Light)**, feedback sonoro refinado e transições fluidas com Framer Motion.
- **Ecossistema Apple Dedicado:** Totalmente responsiva e otimizada para o fluxo de trabalho integrado no **MacBook**, **iPad** e **iPhone** via Progressive Web App (PWA).
- **Segurança & Resiliência:** Login protegido com JWT, persistência com PostgreSQL (Prisma ORM) e espelhamento local offline-first (PWA) garantindo que sua agenda nunca fique indisponível.

---

## ✨ Principais Funcionalidades

### 🗓️ Planejador Multivisualização
* **Semana (7 Dias):** Visualização panorâmica completa de domingo a sábado com grid horário (05:00 às 23:00) e indicador em tempo real da hora atual (*Now Line*).
* **Dia:** Foco absoluto nas atividades da jornada com detalhes de horário, categoria, local e checklist.
* **Mês & Ano:** Visão estratégica de longo prazo com densidade visual de compromissos e contadores.
* **Lista com Busca Instantânea:** Localize qualquer reunião, evento ou atendimento em milissegundos com filtro de status.

### ⚡ Automação e Gestão de Pendências
* **Detecção Inteligente:** Atividades de horários ou dias anteriores que não foram marcadas como concluídas são reunidas automaticamente na aba de **Pendências**.
* **Remarcação em 1 Clique:** Remarque para *Amanhã*, *Próxima Segunda* ou arraste diretamente no calendário com detecção e aviso visual de conflitos de horário.

### 🤖 Assistente de IA Integrado
* Diagnóstico inteligente do equilíbrio semanal de tempo (trabalho, estudos, saúde, pessoal, reuniões).
* Identificação de gargalos e sobreposição de horários.
* Propostas automáticas de reorganização da agenda com aprovação em um clique.

### 🎂 Aniversários & Datas Especiais
* Gestão dedicada de pessoas e contatos importantes da comunidade.
* Botão com link direto para conversa no **WhatsApp** com mensagem de felicitações pré-formatada.
* Notificações automáticas de aniversariantes do dia.

### ✈️ Gestão de Viagens & Deslocamentos
* Faixas contínuas de viagens que cruzam múltiplos dias no topo da grade semanal sem poluir os horários normais.

---

## 🛠️ Tecnologias & Arquitetura

O projeto é estruturado em padrão **Monorepo** moderno:

```
agenda-inteligente-keidson/
├── backend/                  # Servidor Node.js + Express + TypeScript + Prisma
│   ├── prisma/               # Schema do banco de dados PostgreSQL
│   ├── src/
│   │   ├── lib/              # Conexão de banco e espelhamento offline
│   │   ├── middleware/       # Autenticação JWT e guardas de rota
│   │   ├── routes/           # Rotas de Auth, Agenda, Assistente de IA e Arquivos
│   │   └── index.ts          # Inicialização do servidor Express
│   ├── .env.example          # Modelo de variáveis de ambiente do backend
│   └── tsconfig.json
├── frontend/                 # Aplicação React 18 + Vite + Tailwind CSS + PWA
│   ├── public/               # Favicons, foto do Pastor Keidson, Manifesto PWA
│   ├── src/
│   │   ├── components/       # Telas de Login Apple e componentes de interface
│   │   ├── engine/           # Motor de renderização, lógica de calendário e cache
│   │   ├── services/         # Cliente Axios e interceptor de token JWT
│   │   ├── types/            # Tipagens TypeScript completas da aplicação
│   │   ├── App.tsx           # Shell principal e controle de sessão
│   │   └── index.css         # Tokens de design Apple, temas Dark/Light e glassmorphism
│   ├── index.html            # Ponto de entrada PWA com meta-tags Apple
│   └── vite.config.ts        # Configuração do Vite e proxy reverso local
├── Dockerfile                # Build multi-stage para Coolify e Railway
├── docker-compose.yml        # Orquestração local de Backend + Frontend + PostgreSQL
├── .gitignore                # Proteção rigorosa de credenciais e dependências
└── README.md
```

### 💻 Stack Tecnológica

| Camada | Tecnologias Utilizadas |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Axios, Sonner, HTML5 Canvas |
| **PWA & Mobile** | Service Workers, Web App Manifest, Apple Mobile Web App Status Bar, Safe-Area insets |
| **Backend** | Node.js 20 LTS, Express.js, TypeScript, JWT (jsonwebtoken), bcryptjs, CORS |
| **Banco de Dados** | PostgreSQL 16 com Prisma ORM + fallback automático para espelhamento JSON offline |
| **Deploy & DevOps** | Docker (Multi-stage build alpine), Docker Compose, Coolify VPS, Railway Ready |

---

## 🚀 Como Executar Localmente

### Pré-requisitos
* **Node.js** (v18 ou v20 LTS recomendado)
* **npm** ou **yarn**
* *(Opcional)* **Docker** e **Docker Compose** caso queira rodar o PostgreSQL em container

### 1. Clonar o Repositório
```bash
git clone https://github.com/SEU_USUARIO/agenda-inteligente-keidson.git
cd agenda-inteligente-keidson
```

### 2. Instalar as Dependências
```bash
npm install
npm --prefix backend install
npm --prefix frontend install
```

### 3. Configurar as Variáveis de Ambiente
Copie os modelos de ambiente:
```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

### 4. Iniciar em Modo de Desenvolvimento
Você pode rodar os dois serviços simultaneamente:
```bash
# Terminal 1: Iniciar o Backend (Porta 3333)
npm --prefix backend run dev

# Terminal 2: Iniciar o Frontend Vite (Porta 5173)
npm --prefix frontend run dev
```

Acesse no navegador: **`http://localhost:5173`**

> **Credenciais Padrão de Acesso:**
> - **E-mail:** `keidson@agendainteligente.com`
> - **Senha:** `123456`
> - Ou clique no botão **`Desbloqueio Rápido Apple (Keidson)`**

---

## 🚢 Deploy em Produção

### 🟣 Opção 1: Deploy no Railway (Recomendado & Prático)

O projeto está 100% pronto para o **Railway**:

1. Acesse [railway.app](https://railway.app/) e clique em **New Project** → **Deploy from GitHub repo**.
2. Selecione o repositório `agenda-inteligente-keidson`.
3. Adicione um banco de dados no mesmo projeto: clique em **New** → **Database** → **Add PostgreSQL**.
4. No serviço da aplicação, vá na aba **Variables** e defina:
   - `PORT`: `3333`
   - `DATABASE_URL`: `${{Postgres.DATABASE_URL}}` (selecione a variável do banco PostgreSQL criado)
   - `JWT_SECRET`: uma chave secreta longa e segura
   - `JWT_EXPIRES_IN`: `30d`
   - `CORS_ORIGIN`: `*`
5. Na aba **Settings** do serviço, clique em **Generate Domain** na seção *Networking*.
6. O Railway executará o `Dockerfile` multi-stage automaticamente, subindo a aplicação completa pronta para uso!

---

### 🌐 Opção 2: Deploy no Coolify (Sua VPS Própria)

1. No painel do seu **Coolify**, crie uma nova aplicação a partir do repositório GitHub.
2. Selecione o tipo de build: **Dockerfile** (já presente na raiz).
3. Adicione um recurso de **PostgreSQL** interno no Coolify ou conecte ao seu banco existente.
4. Preencha as Variáveis de Ambiente no Coolify:
   ```env
   PORT=3333
   DATABASE_URL=postgresql://postgres:sua_senha@postgres:5432/agenda_inteligente?schema=public
   JWT_SECRET=sua_chave_jwt_super_segura
   JWT_EXPIRES_IN=30d
   CORS_ORIGIN=*
   ```
5. Configure seu domínio com SSL automático gerenciado pelo Traefik/Coolify.
6. Clique em **Deploy**.

---

## 🔐 Variáveis de Ambiente

Todas as variáveis sensíveis ficam isoladas e protegidas via `.gitignore`. Ao configurar seu servidor na Railway, Coolify ou VPS, utilize a tabela de referência abaixo:

| Variável | Descrição | Exemplo | Obrigatória |
| :--- | :--- | :--- | :---: |
| `PORT` | Porta HTTP em que a aplicação responde | `3333` | Sim |
| `DATABASE_URL` | String de conexão com o PostgreSQL | `postgresql://user:pass@host:5432/db?schema=public` | Sim |
| `JWT_SECRET` | Chave criptográfica para autenticação segura | `chave_secreta_jwt_longa_2026` | Sim |
| `JWT_EXPIRES_IN` | Validade da sessão do usuário | `30d` | Não (Padrão: `30d`) |
| `CORS_ORIGIN` | Domínios com permissão de acesso à API | `*` ou `https://agenda.seudominio.com` | Não (Padrão: `*`) |
| `GEMINI_API_KEY` | Chave de API Google Gemini para recursos da IA | `AIzaSy...` | Opcional |

---

## 📱 Instalação no iPhone, iPad e Mac (PWA)

A **Agenda Inteligente** funciona como um aplicativo nativo no ecossistema Apple:

1. **No iPhone ou iPad (Safari):**
   - Acesse o endereço da sua agenda no Safari.
   - Toque no botão **Compartilhar** (ícone de quadrado com seta para cima).
   - Selecione **"Adicionar à Tela de Início"**.
   - O ícone com a foto do Pastor Keidson aparecerá na sua tela inicial como um app nativo sem barras do navegador.

2. **No MacBook (Safari ou Chrome):**
   - No Safari: clique em **Arquivo** → **Adicionar ao Dock...**
   - No Chrome: clique no ícone de instalação no lado direito da barra de endereços (**"Instalar Agenda Inteligente"**).

---

## 👤 Autor & Propósito

Projeto desenvolvido exclusivamente para a organização, ministério e produtividade do **Pastor Keidson**.

---

<div align="center">
  <sub>Construído com excelência, segurança e design de ponta. 2026 © Agenda Inteligente.</sub>
</div>
