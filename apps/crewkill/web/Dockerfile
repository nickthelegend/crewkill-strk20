FROM node:24-slim AS build
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-workspace.yaml .npmrc ./
COPY packages/protocol/package.json packages/protocol/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile=false

COPY packages/protocol packages/protocol
COPY apps/web apps/web
RUN pnpm --filter @crewkill/web build

EXPOSE 3100
CMD ["pnpm", "--filter", "@crewkill/web", "start"]
