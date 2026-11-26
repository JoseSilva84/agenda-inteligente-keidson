# Agenda Inteligente — Plano de Implementação (Padrão Apple PWA · Full-Stack TypeScript)

> Documento técnico e arquitetural adaptado fielmente ao modelo visual e funcional de [`agenda_inteligente.html`](agenda_inteligente.html). Versão 2.0 — Novembro/2026.

---

## 1. Visão Geral e Foco no Ecossistema Apple

Plataforma web progressiva (**PWA**) de planejamento pessoal e profissional, inspirada na precisão de uma grade horária em Excel (dias nas colunas, linhas de 15 em 15 minutos, blocos coloridos mescláveis), inteiramente customizada para o **ecossistema Apple (MacBook, iPhone e iPad)** e protegida por **tela de login JWT** antes do acesso à agenda.

### Destaques da Experiência (MacBook, iPhone e iPad)
- **Tela de Login & Permissão JWT**: Gate de autenticação com estética Apple (*glassmorphism* com `backdrop-filter: saturate(180%) blur(20px)`), suporte a login, criação de conta e desbloqueio rápido do proprietário.
- **Modelos Dark e Light Nativos**:
  - **Dark Mode (`data-theme="dark"`)**: `--bg: #0E1120`, `--surface: #161A2B`, `--ink: #E7EAF5`, `--muted: #99A1BB`, `--line: #272D45`, `--soft: #1C2240`, `--accent: #7F97FF`.
  - **Light Mode (`data-theme="light"`)**: `--bg: #F3F4F8`, `--surface: #FFFFFF`, `--ink: #141A2E`, `--muted: #5A627A`, `--line: #E1E4EE`, `--soft: #EDF0FA`, `--accent: #2A4CDB`.
  - Alternância instantânea em 1 clique no topo da agenda, na tela de login e na aba **Ajustes**, sincronizada com o perfil do usuário no PostgreSQL.
- **Grade Horária Interativa (Dia, Semana, Mês, Ano e Lista)**:
  - Criação rápida com duplo clique ou arraste direto nas linhas de 15 minutos (`.quick` / `.selbox`).
  - Edição inline do título com 1 clique; modal completo com clique direito (MacBook) ou toque com dois dedos (iPhone/iPad).
  - Mesclagem horizontal de dias consecutivos (`g-span`) arrastando a borda lateral direita (`.rzx`).
  - Subtarefas numeradas (`1/5`, `2/5`…) com data, hora e duração próprias renderizadas diretamente na grade.
  - **Meta de Repetições da Atividade (`goal`)**: Botão **Meta** posicionado entre **Subtarefas** e **Anotações** no editor de atividade. Ao ser acionado, exibe um seletor (`<select>`) com a quantidade de vezes que o usuário deseja cumprir aquela atividade até concluí-la (ex.: *"Estudar o livro de Jó"* por 7, 10, 21, 30, 100 vezes ou a opção **"Outro (digitar quantidade em número…)"**, que abre um campo numérico livre) e um painel contador em tempo real com **Já feitas**, **Faltam fazer**, **Progresso (`feitas/total` e `%`)**, barra de progresso visual, controles rápidos (`+1 vez feita`, `−1 feita`, `Zerar`) e incremento automático ao concluir a atividade.
  - **Exibição Limpa de Ícones na Grade**: Os cartões de atividades na grade exibem exclusivamente os ícones/selos de anexos e elementos vinculados (PDF, Imagem/Foto, Áudio, Vídeo, Word, Excel, Link, YouTube, Subtarefas e Meta), sem poluição visual do ícone de recado/anotação rápida.
  - Períodos de **Viagem** sombreados na agenda (`trip`), permitindo agendar compromissos por cima.
  - Atalhos nativos macOS/iPadOS: Desfazer/Refazer (`⌘+Z` / `⌘+Shift+Z`) e Copiar/Colar atividades (`⌘+C` / `⌘+V`).
- **Adaptação PWA Apple**:
  - Safe-area insets (`env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`) para Dynamic Island e barra inferior no iPhone/iPad.
  - Barra de navegação inferior translúcida (`.bottomnav`) em telas compactas (iPhone) e barra lateral retrátil com mini-calendário no MacBook/iPad.

---

## 2. Design System Preservado (`agenda_inteligente.html`)

| Token / Elemento | Modo Claro (Light) | Modo Escuro (Dark) | Aplicação |
|---|---|---|---|
| `--bg` | `#F3F4F8` | `#0E1120` | Plano de fundo geral da aplicação |
| `--surface` | `#FFFFFF` | `#161A2B` | Cartões, grade horária, barra lateral e modais |
| `--ink` | `#141A2E` | `#E7EAF5` | Tipografia principal e ícones |
| `--muted` | `#5A627A` | `#99A1BB` | Textos secundários, horários e legendas |
| `--line` | `#E1E4EE` | `#272D45` | Bordas e divisórias da grade de 15 minutos |
| `--soft` | `#EDF0FA` | `#1C2240` | Superfícies de destaque sutil, badges e hover |
| `--accent` | `#2A4CDB` | `#7F97FF` | Cor primária, botões, dia atual e seleção |
| `--ok` / `--warn` / `--bad` | `#0F8458` / `#A86500` / `#C3304A` | `#3DCB8F` / `#F0B04A` / `#FF6F86` | Status concluída, pendente e conflito/cancelada |
| Tipografia Display | `Bricolage Grotesque` (`-apple-system`, `SF Pro Display`) | `Bricolage Grotesque` | Títulos, cabeçalhos e números de KPI |
| Tipografia Corpo | `Figtree` (`font-weight: 300`, `tabular-nums`) | `Figtree` | Grade, formulários, listas e chat |

---

## 3. Funcionalidades e Módulos Implementados

| Módulo / Aba | Funcionalidades Entregues | Status / Fase |
|---|---|---|
| **Login & Permissão (JWT)** | Tela de bloqueio/permissão antes da agenda, login, registro, token JWT via Axios, toggle Dark/Light | Fase 1 (Entregue) |
| **1. Agenda (`#agenda`)** | Visualizações Dia, Semana, Mês, Ano (heatmap) e Lista; drag & drop; redimensionamento vertical e horizontal (multi-dias); subtarefas `1/N` na grade; **Meta de repetições (`feitas/total` e contador de quantas faltam)**; sombreamento de viagens; copiar/colar (`⌘+C`/`⌘+V`); desfazer/refazer (`⌘+Z`) | Fase 1 (Entregue) |
| **Anexos Multimídia** | Upload e visualização interna de PDF (PDF.js), imagens (com compressão automática), áudio/gravação de voz, vídeos (MP4/WebM/QuickTime com `playsinline`), Word, Excel, TXT e links (com detecção e player de YouTube); exibição exclusiva dos ícones de anexos no cartão da agenda (sem ícone de recado) | Fase 1 (Entregue) |
| **2. Pendências (`#pendencias`)** | Detecção automática de atividades não concluídas; sugestão inteligente de horário livre (`findSlot`) respeitando prioridade, prazo fixo, horário útil e viagens; remarcação individual ou em lote com preservação de histórico | Fase 1 (Entregue) |
| **3. Resumo (`#resumo`)** | KPIs semanais (Programadas, Concluídas, Pendentes, Canceladas, Taxa %); gráfico SVG de produtividade diária; barras de horas por categoria; exportação em PDF (`jsPDF`), cópia de texto e envio via WhatsApp | Fase 1 (Entregue) |
| **4. Assistente (`#assistente`)** | Chat conversacional integrado ao backend (`/api/assistant/chat`) que consulta atividades, busca horários livres, resume produtividade e gera cartões interativos de confirmação (`Confirmar` / `Descartar`) antes de alterar a agenda | Fase 1/2 (Entregue) |
| **5. Aniversários (`#datas`)** | Gestão de Aniversariantes e Dias Profissionais; importação em lote (`Nome; dia/mês; Profissão`); chips na linha `DATAS` do calendário; envio de felicitações em 1 clique para o WhatsApp | Fase 1 (Entregue) |
| **6. Ajustes (`#ajustes`)** | Alternância Dark/Light; configuração de horário útil e dias úteis; editor de categorias e cores; teste de lembrete (carrilhão Web Audio + vibração + notificação push); backup/restauração JSON e semana de exemplo | Fase 1 (Entregue) |

---

## 4. Arquitetura Técnica Full-Stack

Monólito modular em TypeScript preparado para deploy direto em **VPS com painel Coolify**.

| Camada | Tecnologia Implementada |
|---|---|
| **Frontend** | React 18 + TypeScript (Vite), Tailwind CSS (mapeado para as variáveis CSS do Design System), `framer-motion` (animações), `sonner` (biblioteca de notificações), `axios` (cliente HTTP com interceptador JWT), `jspdf` + `PDF.js` |
| **PWA & Apple** | `manifest.webmanifest`, Service Worker (`sw.js`), meta tags iOS/iPadOS/macOS (`apple-mobile-web-app-capable`, `black-translucent`, `viewport-fit=cover`), cache local + IndexedDB |
| **Backend** | Node.js + Express + TypeScript (`backend/src/index.ts`), API RESTful autenticada |
| **ORM & Banco de Dados** | Prisma ORM (`backend/prisma/schema.prisma`) + **PostgreSQL 16** (com espelhamento local automático para desenvolvimento offline) |
| **Autenticação** | JWT (`jsonwebtoken`) + hash de senhas com `bcryptjs` (`/api/auth/login`, `/api/auth/register`, `/api/auth/me`, `/api/auth/theme`) |
| **Deploy (Coolify / VPS)** | `Dockerfile` multi-stage unificado + `docker-compose.yml` com PostgreSQL 16, healthcheck `/api/health` e `prisma db push` automático |

### Modelo de Dados no Prisma (`schema.prisma`)
- `User`: `id`, `name`, `email`, `passwordHash`, `role`, `theme` (`dark` | `light` | `system`), `createdAt`, `updatedAt`.
- `UserSettings`: `userId`, `mode`, `workStart`, `workEnd`, `workDays`, `categories`, `specialCats`.
- `Activity`: `id`, `userId`, `title`, `date`, `start`, `end`, `status`, `category`, `priority`, `recur`, `reminder`, `fixed`, `deadline`, `autoResched`, `kept`, `span`, `notes`, `goal` (`{ enabled, target, done }`), `subtasks`, `links`, `files`, `history`, `overrides`, `origin`, `rescheduledCount`.
- `Travel`: `id`, `userId`, `title`, `date`, `start`, `endDate`, `end`, `notes`.
- `Person`: `id`, `userId`, `type` (`aniversario` | `profissional`), `name`, `day`, `month`, `whatsapp`, `role`.
- `Notification`: `id`, `userId`, `at`, `title`, `body`, `type`, `read`.
- `FileAsset`: `id`, `userId`, `name`, `mimeType`, `size`, `dataBase64`.
- `AuditLog`: `id`, `userId`, `action`, `details`, `createdAt`.

---

## 5. Guia de Deploy na VPS com Coolify

1. **No Painel do Coolify**:
   - Crie um novo recurso a partir do repositório Git (ou selecione **Docker Compose** / **Dockerfile**).
   - Caso utilize o `docker-compose.yml` da raiz, o Coolify subirá automaticamente o container `postgres` (PostgreSQL 16) e o container `agenda-app` (Backend Express + Frontend React PWA compilado).
2. **Variáveis de Ambiente no Coolify**:
   ```env
   PORT=3333
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=sua_senha_segura_postgres
   POSTGRES_DB=agenda_inteligente
   DATABASE_URL=postgresql://postgres:sua_senha_segura_postgres@postgres:5432/agenda_inteligente?schema=public
   JWT_SECRET=sua_chave_secreta_jwt_apple_2026
   JWT_EXPIRES_IN=30d
   ```
3. **Healthcheck**:
   - Endpoint configurado: `GET /api/health` na porta `3333`.
4. **Instalação como App nos Dispositivos Apple**:
   - **iPhone / iPad (Safari)**: Abra o domínio HTTPS configurado no Coolify → toque em **Compartilhar** → **Adicionar à Tela de Início**.
   - **MacBook (Safari / Chrome)**: Clique em **Arquivo → Adicionar ao Dock** (Safari macOS Sonoma+) ou no ícone **Instalar Agenda Inteligente** na barra de endereços.

---

## 6. Credenciais Padrão de Acesso (Proprietário)

- **E-mail**: `keidson@agendainteligente.com`
- **Senha**: `123456`
- *(Ou utilize o botão **"Desbloqueio Rápido Apple (Keidson)"** na tela de login, ou a aba **"Nova Conta"** para cadastrar novos usuários).*
