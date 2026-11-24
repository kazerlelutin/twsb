# syntax=docker/dockerfile:1
# Image de production (CapRover, Docker). Le développement utilise Dockerfile.dev.
FROM oven/bun:1.4 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM deps AS build
COPY . .
RUN bun run build

# Production : le seul état est /data (base SQLite, médias, sauvegardes, versions installées).
# Le lanceur démarre la version la plus récente (image ou mise à jour depuis l'admin)
# et revient en arrière si elle ne démarre pas.
FROM oven/bun:1.4 AS production
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data
COPY --from=build --chown=bun:bun /app/.output ./.output
COPY --from=build --chown=bun:bun /app/launcher ./launcher
RUN mkdir -p /data && chown bun:bun /data
USER bun
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/healthz').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["bun", "launcher/launcher.mjs"]
