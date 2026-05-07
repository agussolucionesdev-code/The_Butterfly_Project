# The Butterfly Project

A mobile-first hypertrophy workflow engine built exclusively for Agustín Sosa.

## Stack

React 18, Vite, TypeScript, Zustand, Tailwind CSS, Lucide React, Fastify, Prisma and PostgreSQL.

## Local setup

```bash
npm install
cp .env.example .env
cp apps/web/.env.example apps/web/.env
npm run prisma:generate
npm run prisma:migrate
npm run build -w @butterfly/shared
npm run prisma:seed
npm run dev
```

## Environment

Root:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/butterfly"
CORS_ORIGIN="http://localhost:5173"
PORT=4000
```

Frontend:

```env
VITE_API_URL="http://localhost:4000"
```

Production:

- Vercel: `VITE_API_URL=https://<render-api-url>`
- Render: `DATABASE_URL`, `CORS_ORIGIN=https://<vercel-app-url>`, `NODE_ENV=production`

## Deployment

`render.yaml` provisions a Node web service and PostgreSQL database. `vercel.json` points Vercel to `apps/web/dist`.

## GitHub initialization

```bash
git init
git add .
git commit -m "feat: initialize butterfly project"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

Use conventional commits only. Do not add AI attribution.

## Product rules

- Cycle starts on February 26, 2026.
- Future days are locked.
- The workout shows one exercise and one set at a time.
- Saving a set starts the recovery timer unless rest is `0`.
- Completion reminds Agustín to consume 160g–175g protein to grow from 77.78 kg to 83.0 kg.


