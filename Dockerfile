FROM node:20-slim

# Install Chromium and necessary dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-freefont-ttf \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Set environment variable for Chromium path
ENV CHROME_PATH=/usr/bin/chromium

EXPOSE 3000

CMD ["node", "index.js"]
