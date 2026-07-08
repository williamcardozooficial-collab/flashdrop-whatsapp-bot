FROM node:18-slim

# Instalar dependencias do Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libxshmfence1 \
    wget \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Puppeteer usa seu proprio Chrome (baixado no npm install) em vez do chromium
# do sistema, pois a versao do Debian (150.x) trava (Trace/breakpoint trap /
# crashpad ptrace EPERM) no ambiente do Railway.

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

EXPOSE 3000
CMD ["node", "src/server.js"]
