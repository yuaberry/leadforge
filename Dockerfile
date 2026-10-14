FROM oven/bun:1 AS base
WORKDIR /app

# Dependências (cacheável)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Build (funciona sem variáveis de ambiente — estados pendentes são honestos)
COPY . .
RUN bun run build

EXPOSE 3000
CMD ["bun", "run", "start"]
