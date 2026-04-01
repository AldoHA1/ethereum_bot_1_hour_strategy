import fs from 'fs';
import path from 'path';
import { Position } from '../position/types';
import { ExitReason } from '../strategy/types';

const JOURNAL_PATH = path.resolve(process.cwd(), 'logs', 'trades.csv');
const HEADER =
  'timestamp,side,entry_mode,entry_price,exit_price,qty,pnl_usd,pnl_pct,exit_reason,duration_hours,atr_at_entry,fees_est,equity_after\n';

function ensureFile(): void {
  const dir = path.dirname(JOURNAL_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(JOURNAL_PATH)) {
    fs.writeFileSync(JOURNAL_PATH, HEADER);
  }
}

export function recordTrade(params: {
  position: Position;
  exitPrice: number;
  exitQty: number;
  exitReason: ExitReason;
  feesEst: number;
  equityAfter: number;
}): void {
  ensureFile();

  const { position: pos, exitPrice, exitQty, exitReason, feesEst, equityAfter } = params;
  const isLong = pos.side === 'long';
  const pnlPerUnit = isLong
    ? exitPrice - pos.entryPrice
    : pos.entryPrice - exitPrice;
  const pnlUsd = pnlPerUnit * exitQty - feesEst;
  const pnlPct = (pnlPerUnit / pos.entryPrice) * 100;
  const durationH = (Date.now() - pos.entryTime) / (1000 * 60 * 60);

  const line =
    `${new Date().toISOString()},${pos.side},${pos.entryMode},` +
    `${pos.entryPrice.toFixed(2)},${exitPrice.toFixed(2)},${exitQty.toFixed(6)},` +
    `${pnlUsd.toFixed(2)},${pnlPct.toFixed(2)},${exitReason},` +
    `${durationH.toFixed(1)},${pos.atrAtEntry.toFixed(2)},` +
    `${feesEst.toFixed(4)},${equityAfter.toFixed(2)}\n`;

  fs.appendFileSync(JOURNAL_PATH, line);
}
