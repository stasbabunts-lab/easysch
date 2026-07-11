# EasySch — scheduling & client management for private tutors

**Live: [easy-sch.com](https://easy-sch.com)**

A SaaS workspace for independent teachers and specialists: manage students, schedule lessons, track payments, and keep clients informed — with a Telegram bot handling reminders and notifications automatically.

## Features

- **Lesson scheduling** — availability slots, individual and group lessons, a public booking board
- **Student management** — profiles, lesson history, per-student notes
- **Payments** — payment tracking, payment requests, bank account details, subscription billing
- **Telegram bot** — lesson reminders and notifications delivered straight to students (built with grammY)
- **Automated reminders** — cron-driven notification pipeline with delivery logging
- **Admin panel** — platform-level settings and campaign management

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) + React 19, TypeScript |
| Database | Prisma 7 ORM (SQLite / libSQL) |
| Auth | NextAuth v5 (Auth.js) |
| Bot | grammY (Telegram Bot API) |
| Push / messaging | Firebase + firebase-admin |
| UI | Tailwind CSS, Base UI, shadcn, lucide icons |

## Running locally

```bash
npm install
cp .env.example .env        # fill in your values
npx prisma migrate dev
npm run db:seed
npm run dev                 # http://localhost:3000
```

## About

Built solo, end-to-end — product design, backend, frontend, bot, and deployment — using AI-assisted development (Claude Code).
