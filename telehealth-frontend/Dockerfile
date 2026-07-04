FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY index.html ./
COPY vite.config.* ./
COPY tsconfig*.json ./
COPY eslint.config.* ./
COPY postcss.config.* ./
COPY tailwind.config.* ./
COPY public ./public
COPY src ./src

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]