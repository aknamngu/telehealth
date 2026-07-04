# DoAnTeleHealth

![CI](https://github.com/aknamngu/telehealth/actions/workflows/ci.yml/badge.svg?branch=main)
![Docker Compose](https://img.shields.io/badge/docker--compose-ready-0ea5e9)
![Stack](https://img.shields.io/badge/stack-NestJS%20%7C%20React%20%7C%20Prisma-111827)

Telehealth full-stack project với giao diện cao cấp, backend NestJS, frontend React + Vite, Prisma, Docker Compose và GitHub Actions.

## Structure

- `telehealth-backend`: API, Prisma, WebSocket, auth, appointments
- `telehealth-frontend`: landing page và phòng khám online

## Quick Start

### Local dev

```bash
cd telehealth-backend
npm install

cd ../telehealth-frontend
npm install
```

```bash
cd telehealth-backend
npm run start:dev
```

```bash
cd ../telehealth-frontend
npm run dev
```

### Docker profiles

```bash
docker compose --profile dev up --build
```

- Frontend dev: `http://localhost:5173`
- Backend dev: `http://localhost:3000`
- DB: `localhost:3306`

```bash
docker compose --profile prod up --build
```

- Frontend prod: `http://localhost:4173`
- Backend prod: `http://localhost:3000`
- DB: `localhost:3306`

## Environment

Copy these files before running:

- `telehealth-backend/.env.example` -> `telehealth-backend/.env`
- `telehealth-frontend/.env.example` -> `telehealth-frontend/.env`

## Build checks

```bash
cd telehealth-backend
npm run build

cd ../telehealth-frontend
npm run build
```

## CI

GitHub Actions is configured in [\.github/workflows/ci.yml](.github/workflows/ci.yml) to build both apps on push and pull request.

## GitHub workflow

```bash
git add .
git commit -m "Update telehealth project"
git push origin main
```

If your friend clones the repo:

```bash
git clone https://github.com/aknamngu/telehealth.git
```

Then install dependencies and run either the local dev commands or the Docker profile commands above.