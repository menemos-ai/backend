FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# ── deps stage: install all workspace dependencies ──────────────────────────
FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/sdk/package.json packages/sdk/
COPY apps/api/package.json apps/api/
COPY apps/reference-agent/package.json apps/reference-agent/
RUN pnpm install --frozen-lockfile

# ── builder stage: compile SDK then API ─────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/packages/sdk/node_modules packages/sdk/node_modules
COPY --from=deps /app/apps/api/node_modules apps/api/node_modules
COPY --from=deps /app/apps/reference-agent/node_modules apps/reference-agent/node_modules
COPY . .
RUN pnpm build
# Create a self-contained production bundle for the API only
RUN pnpm --filter @mnemos/api deploy --prod /app/api-standalone

# ── runner stage: minimal production image ───────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/api-standalone .
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/main"]
