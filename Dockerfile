# Hosted edward: the server in hosted mode, its data folder the /data volume. Node runs the TypeScript sources, so the
# image keeps them and builds only the web app. Usage: see the README's "Hosted" section.
FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build
# The data folder is $XDG_DATA_HOME/claude-workflow-dashboard (platformDefaults), so /data/claude-workflow-dashboard.
ENV XDG_DATA_HOME=/data
RUN mkdir /data && chown node:node /data
VOLUME /data
EXPOSE 4317
USER node
CMD ["node", "packages/server/src/main.ts"]
