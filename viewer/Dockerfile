FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY scripts ./scripts
COPY templates ./templates
COPY public ./public
RUN node scripts/build.mjs

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/public ./public
COPY server.js ./
COPY package.json ./
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
