import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';

function detectLanguage(targetPath) {
  if (existsSync(join(targetPath, 'package.json'))) return 'node';
  if (existsSync(join(targetPath, 'requirements.txt')) || existsSync(join(targetPath, 'pyproject.toml'))) return 'python';
  if (existsSync(join(targetPath, 'go.mod'))) return 'go';
  if (existsSync(join(targetPath, 'pom.xml')) || existsSync(join(targetPath, 'build.gradle'))) return 'java';
  return 'unknown';
}

function generateDockerfile(language, targetPath) {
  if (language === 'node') {
    let pkg;
    try {
      pkg = JSON.parse(readFileSync(join(targetPath, 'package.json'), 'utf-8'));
    } catch { pkg = {}; }
    const startCmd = pkg.scripts?.start ? 'CMD ["npm", "start"]' : 'CMD ["node", "index.js"]';
    return `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
${pkg.scripts?.build ? 'RUN npm run build' : '# No build step'}

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
${pkg.scripts?.build ? 'COPY --from=builder /app/dist ./dist' : '# No dist/ directory'}
COPY . .
${startCmd}
`;
  }
  if (language === 'python') {
    return `FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --user -r requirements.txt

FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /root/.local /root/.local
COPY . .
ENV PATH=/root/.local/bin:$PATH
CMD ["python", "main.py"]
`;
  }
  if (language === 'go') {
    return `FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o app .

FROM scratch
COPY --from=builder /app/app /app
EXPOSE 8080
CMD ["/app"]
`;
  }
  if (language === 'java') {
    return `FROM maven:3.9-eclipse-temurin-21-alpine AS builder
WORKDIR /app
COPY pom.xml ./
RUN mvn dependency:resolve
COPY src ./src
RUN mvn package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
`;
  }
  // fallback Node
  return `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
CMD ["npm", "start"]
`;
}

function generateDockerignore() {
  return `node_modules
.git
.gitignore
.env
.env.*
dist
build
coverage
*.log
.DS_Store
Thumbs.db
`;
}

function generateDockerCompose(targetPath) {
  let port = '3000';
  const envPath = join(targetPath, '.env');
  if (existsSync(envPath)) {
    try {
      const env = readFileSync(envPath, 'utf-8');
      const portMatch = env.match(/PORT\s*=\s*(\d{4,5})/i);
      if (portMatch) port = portMatch[1];
    } catch { /* ignore */ }
  }
  const pkgPath = join(targetPath, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      const devScript = pkg.scripts?.dev || '';
      const portMatch = devScript.match(/(?:--port[=\s]+|PORT=)(\d{4,5})/i);
      if (portMatch) port = portMatch[1];
    } catch { /* ignore */ }
  }
  return `version: '3.8'
services:
  dev:
    build: .
    ports:
      - "${port}:${port}"
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
    command: npm run dev

  prod:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "${port}:${port}"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${port}/health"]
      interval: 30s
      timeout: 5s
      retries: 3
`;
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export function handleSetupDocker(_action, _params, targetPath, context) {

  const language = detectLanguage(targetPath);

  let dockerConfigured = true;
  const dockerfilePath = join(targetPath, 'Dockerfile');
  const ignorePath = join(targetPath, '.dockerignore');
  const composePath = join(targetPath, 'docker-compose.yml');

  // Dockerfile
  if (!existsSync(dockerfilePath)) {
    try {
      writeFileSync(dockerfilePath, generateDockerfile(language, targetPath), 'utf-8');
    } catch {
      dockerConfigured = false;
    }
  }

  // .dockerignore
  if (existsSync(ignorePath)) {
    console.log(chalk.dim('  .dockerignore 已存在，跳过'));
  } else {
    try {
      writeFileSync(ignorePath, generateDockerignore(), 'utf-8');
    } catch (e) {
      console.log(chalk.yellow(`  ⚠ .dockerignore 生成失败: ${e.message}`));
    }
  }

  // docker-compose.yml
  if (existsSync(composePath)) {
    console.log(chalk.dim('  docker-compose.yml 已存在，跳过'));
  } else {
    try {
      writeFileSync(composePath, generateDockerCompose(targetPath), 'utf-8');
    } catch (e) {
      console.log(chalk.yellow(`  ⚠ docker-compose.yml 生成失败: ${e.message}`));
    }
  }

  // Docker validation
  try {
    safeExec('docker --version 2>&1', targetPath, { stdio: 'pipe' }).toString();
    try {
      safeExec('docker build --check . 2>&1', targetPath, { stdio: 'pipe' });
    } catch {
      console.log(chalk.yellow('  ⚠ Docker build --check 未通过（可能是首次构建缺少上下文）'));
    }
  } catch {
    console.log(chalk.dim('  ℹ Docker CLI 不可用，跳过语法验证'));
  }

  if (context) {
    context.dockerConfigured = dockerConfigured;
    context.dockerfilePath = dockerfilePath;
    context.composeGenerated = existsSync(composePath);
    if (!dockerConfigured) context.lastStepFailed = true;
  }

  return dockerConfigured
    ? 'Docker 容器化配置完成：Dockerfile + .dockerignore + docker-compose.yml 已生成'
    : 'Docker 配置部分完成（检查警告）';
}
