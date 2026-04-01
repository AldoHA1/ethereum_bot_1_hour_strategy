import fs from 'fs';
import path from 'path';
import { BotStateData } from './bot-state';
import { logger } from '../utils/logger';

const STATE_DIR = path.resolve(process.cwd(), 'data');
const STATE_FILE = path.join(STATE_DIR, 'state.json');
const TEMP_FILE = path.join(STATE_DIR, 'state.tmp.json');

function ensureDir(): void {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
}

export function saveState(state: BotStateData): void {
  try {
    ensureDir();
    const json = JSON.stringify(state, null, 2);
    fs.writeFileSync(TEMP_FILE, json, 'utf-8');
    fs.renameSync(TEMP_FILE, STATE_FILE);
  } catch (err) {
    logger.error(`Failed to save state: ${err}`);
  }
}

export function loadState(): BotStateData | null {
  try {
    if (!fs.existsSync(STATE_FILE)) return null;
    const json = fs.readFileSync(STATE_FILE, 'utf-8');
    const state = JSON.parse(json) as BotStateData;
    logger.info('State loaded from disk');
    return state;
  } catch (err) {
    logger.error(`Failed to load state: ${err}`);
    return null;
  }
}
