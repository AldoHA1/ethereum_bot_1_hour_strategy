import dotenv from 'dotenv';
dotenv.config();

export { STRATEGY } from './strategy';
export { KRAKEN } from './kraken';

export interface EnvConfig {
  apiKey: string;
  secretKey: string;
  logLevel: string;
  dryRun: boolean;
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export const ENV: EnvConfig = {
  apiKey: requireEnv('KRAKEN_API_KEY'),
  secretKey: requireEnv('KRAKEN_SECRET_KEY'),
  logLevel: process.env.LOG_LEVEL || 'info',
  dryRun: process.env.DRY_RUN === 'true',
};
