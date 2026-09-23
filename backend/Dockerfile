FROM node:22-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@11.17.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN DIRECT_URL=postgresql://cmq_demo:cmq_demo@localhost:5432/cmq_demo pnpm exec prisma generate \
  && pnpm run build:api \
  && pnpm run build:worker

ENV NODE_ENV=production

CMD ["node", "dist/apps/api/main.js"]
