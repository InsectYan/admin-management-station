FROM node:22-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

COPY backend/ .

ENV NODE_ENV=production
EXPOSE 5200

CMD ["npx", "egg-scripts", "start", "--title=menu-master-backend", "--workers=1"]
