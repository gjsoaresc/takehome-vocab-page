FROM oven/bun:1.3-alpine AS build
WORKDIR /app
COPY . .
RUN bun install --ignore-scripts
RUN cd apps/web && bun run build

FROM nginx:alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
