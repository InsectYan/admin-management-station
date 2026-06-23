# 主 Dockerfile 已迁至 deploy/config/Dockerfile（本地 Docker 共用）
# 保留本文件仅为历史引用；新部署请使用 deploy/config/Dockerfile
FROM node:22-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

COPY backend/ .

ENV NODE_ENV=production
EXPOSE 7001

CMD ["npx", "egg-scripts", "start", "--title=menu-master-backend", "--workers=1"]
