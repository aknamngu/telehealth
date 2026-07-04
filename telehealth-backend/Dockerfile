FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY nest-cli.json tsconfig*.json ./
COPY src ./src
COPY test ./test

EXPOSE 3000

CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && npm run start:dev"]