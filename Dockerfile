# Built by .github/workflows/deploy.yml (context ., file Dockerfile) and pushed
# to Artifact Registry. Adapted from the fleet's node stack pack.
#
# Deviations from the pack, and why:
#   - `npm install` when no lockfile is committed; the pack assumes `npm ci`.
#   - adapter-node output is build/index.js; the pack's `npm start` script does
#     not exist in this template.
#
# BASE_PATH is NOT baked in: it is per-agent and only known at run time, so the
# image serves at the host root under k8s and the agent's /direct/<id>:<port>
# run supplies its own prefix.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
ARG BUILD_ID=""
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0 BUILD_ID=$BUILD_ID
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app ./
USER app
EXPOSE 3000
CMD ["node", "build/index.js"]
