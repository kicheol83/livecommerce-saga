FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_LIVE_SOCKET_URL
ARG NEXT_PUBLIC_ORDER_SOCKET_URL
ENV NEXT_PUBLIC_LIVE_SOCKET_URL=$NEXT_PUBLIC_LIVE_SOCKET_URL \
    NEXT_PUBLIC_ORDER_SOCKET_URL=$NEXT_PUBLIC_ORDER_SOCKET_URL \
    GATEWAY_URL=http://api-gateway:8080 \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/next.config.mjs ./
COPY --from=build /app/.next ./.next
USER node
EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "-p", "3000"]
