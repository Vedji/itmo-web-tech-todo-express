FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY app.js index.js ./
COPY public/ ./public/
USER node
EXPOSE 3000
CMD ["npm", "start"]
