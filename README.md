# izi-agentctl

A responsive agent dashboard for managing GitHub repos. Built with Next.js 14
(App Router), TypeScript, Tailwind CSS, and GitHub OAuth via NextAuth.js.

> Scaffold only — no dashboard UI yet.

## Tech stack

- [Next.js 14](https://nextjs.org/) — App Router
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/) (v3)
- [NextAuth.js](https://next-auth.js.org/) (v4) — GitHub OAuth

## Project structure

```
app/                              # App Router routes
  api/auth/[...nextauth]/route.ts # NextAuth.js route handler
  globals.css                     # Tailwind entrypoint
  layout.tsx                      # Root layout + session provider
  page.tsx                        # Landing page
components/                       # React components
  providers.tsx                   # Client-side SessionProvider wrapper
lib/                              # Shared logic
  auth.ts                         # NextAuth options (GitHub provider)
types/                            # TypeScript declarations
  next-auth.d.ts                  # Session/JWT type augmentation
```

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file and fill in the values:

```bash
cp .env.example .env.local
```

| Variable               | Description                                                        |
| ---------------------- | ------------------------------------------------------------------ |
| `GITHUB_CLIENT_ID`     | OAuth app client ID from GitHub                                    |
| `GITHUB_CLIENT_SECRET` | OAuth app client secret from GitHub                               |
| `NEXTAUTH_SECRET`      | Random secret — generate with `openssl rand -base64 32`            |
| `NEXTAUTH_URL`         | Base URL of the app (`http://localhost:3000` in development)       |
| `TELEGRAM_TOKEN`       | Telegram bot token from [@BotFather](https://t.me/BotFather)        |
| `TELEGRAM_CHAT_ID`     | Target chat ID for Telegram notifications                          |

### 3. Create a GitHub OAuth App

At <https://github.com/settings/developers> → **New OAuth App**:

- **Homepage URL:** `http://localhost:3000`
- **Authorization callback URL:** `http://localhost:3000/api/auth/callback/github`

Copy the generated client ID and secret into `.env.local`.

### 4. Run the dev server

```bash
npm run dev
```

Open <http://localhost:3000>.

## Scripts

| Command         | Description                       |
| --------------- | --------------------------------- |
| `npm run dev`   | Start the development server      |
| `npm run build` | Production build                  |
| `npm run start` | Run the production build          |
| `npm run lint`  | Run ESLint                        |
