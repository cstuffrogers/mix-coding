import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

function detectLogger(targetPath) {
  const pkgPath = join(targetPath, 'package.json');
  if (!existsSync(pkgPath)) return 'unknown';
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps.winston) return 'winston';
    if (deps.pino) return 'pino';
    if (deps.log4js) return 'log4js';
    if (deps.bunyan) return 'bunyan';
    return 'none';
  } catch { return 'unknown'; }
}

function generateWinstonConfig() {
  return `const winston = require('winston');
require('winston-daily-rotate-file');

const transport = new winston.transports.DailyRotateFile({
  filename: 'logs/%DATE%-app.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    process.env.NODE_ENV === 'production'
      ? winston.format.json()
      : winston.format.combine(winston.format.colorize(), winston.format.simple())
  ),
  transports: [
    new winston.transports.Console(),
    transport,
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
  ],
});

module.exports = logger;
`;
}

function generatePinoConfig() {
  return `const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

module.exports = logger;
`;
}

function generateLog4jsConfig() {
  return `const log4js = require('log4js');

log4js.configure({
  appenders: {
    console: { type: 'console' },
    file: { type: 'dateFile', filename: 'logs/app.log', pattern: 'yyyy-MM-dd', keepFileExt: true, daysToKeep: 14 },
    errorFile: { type: 'file', filename: 'logs/error.log' },
  },
  categories: {
    default: { appenders: ['console', 'file'], level: process.env.LOG_LEVEL || 'info' },
    error: { appenders: ['errorFile'], level: 'error' },
  },
});

module.exports = log4js.getLogger();
`;
}

function generateFilebeatConfig() {
  return `filebeat.inputs:
- type: log
  enabled: true
  paths:
    - logs/*.log
  json.keys_under_root: true
  json.add_error_key: true

output.elasticsearch:
  hosts: ["\${ELASTICSEARCH_URL:localhost:9200}"]
  index: "app-logs-%{+yyyy.MM.dd}"
`;
}

function detectELK(targetPath) {
  const indicators = [];
  const envPath = join(targetPath, '.env');
  if (existsSync(envPath)) {
    try {
      const env = readFileSync(envPath, 'utf-8');
      if (/ELASTICSEARCH_URL|LOGSTASH_HOST|FLUENTD_HOST/i.test(env)) indicators.push('.env');
    } catch { /* ignore */ }
  }
  if (existsSync(join(targetPath, 'filebeat.yml'))) indicators.push('filebeat.yml');
  if (existsSync(join(targetPath, 'logstash.conf'))) indicators.push('logstash.conf');
  return indicators;
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export function handleSetupLogging(_action, _params, targetPath, context) {

  const logger = detectLogger(targetPath);

  const configPath = join(targetPath, 'logging.config.js');
  let isLoggingConfigured = true;

  if (existsSync(configPath)) {
    /* config already exists — skip generation */
  } else {
    try {
      let configContent;
      if (logger === 'pino') configContent = generatePinoConfig();
      else if (logger === 'log4js') configContent = generateLog4jsConfig();
      else configContent = generateWinstonConfig();

      writeFileSync(configPath, configContent, 'utf-8');
    } catch {
      isLoggingConfigured = false;
    }
  }

  // ELK/Fluentd detection
  const elkIndicators = detectELK(targetPath);
  if (elkIndicators.length) {
    const fbPath = join(targetPath, 'filebeat.yml');
    if (!existsSync(fbPath)) {
      try {
        writeFileSync(fbPath, generateFilebeatConfig(), 'utf-8');
      } catch (e) {
        console.log(chalk.yellow(`  ⚠ filebeat.yml 生成失败: ${e.message}`));
      }
    }
  }

  if (logger === 'none') {
    console.log(chalk.yellow('  ⚠ 未检测到日志库，建议安装: npm install winston winston-daily-rotate-file'));
  }

  if (context) {
    context.loggingConfigured = isLoggingConfigured;
    context.loggingConfigPath = configPath;
    context.logFormat = 'json';
    if (!isLoggingConfigured) context.lastStepFailed = true;
  }

  return isLoggingConfigured
    ? '日志聚合配置完成：结构化日志 + 轮转（14天）配置已生成'
    : '日志配置部分完成（检查警告）';
}
