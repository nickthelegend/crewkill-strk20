# Keeper: the phase clock, the house agents, and the read API.
FROM node:24-slim AS base
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-workspace.yaml .npmrc ./
COPY packages/protocol/package.json packages/protocol/
COPY apps/keeper/package.json apps/keeper/
RUN pnpm install --frozen-lockfile=false

COPY packages/protocol packages/protocol
COPY apps/keeper apps/keeper
# Contract artefacts and the deployment manifest are read at runtime, not bundled.
COPY cairo/target/dev cairo/target/dev
COPY deployments deployments

RUN pnpm --filter @crewkill/keeper prisma:generate

EXPOSE 8080
CMD ["sh", "-c", "pnpm --filter @crewkill/keeper prisma:migrate && pnpm --filter @crewkill/keeper start"]
