export function nowUTC(): Date {
  return new Date();
}

export function utcHour(): number {
  return new Date().getUTCHours();
}

export function utcDay(): number {
  return new Date().getUTCDate();
}

export function formatTimestamp(ts: number): string {
  return new Date(ts).toISOString();
}

export function hoursSince(timestamp: number): number {
  return (Date.now() - timestamp) / (1000 * 60 * 60);
}
