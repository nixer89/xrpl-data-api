export const BITHOMP_TOKEN = process.env.BITHOMP_API_TOKEN;
export const DATA_PATH = process.env.DATA_PATH || '/home/api-data/';
export const REDIS_IP = process.env.REDIS_IP || '127.0.0.1';
const _redisPortEnv = Number(process.env.REDIS_PORT);
export const REDIS_PORT = Number.isFinite(_redisPortEnv) && _redisPortEnv > 0 ? _redisPortEnv : 6379;
export const WHITELIST_IP = process.env.WHITELIST_IP;