/**
 * RFC Task Telegram — Structured Logger with Secure Secret Redaction
 * Ensures zero passwords, OTPs, session cookies or bot tokens leak to console, logs or SSE.
 */

export function redactSecret(value: string | undefined | null): string {
  if (!value) return '[EMPTY]';
  const str = String(value);
  if (str.length <= 4) return '***';
  return str.substring(0, 2) + '***' + str.substring(str.length - 2);
}

export function sanitizePayload(payload: any): any {
  if (!payload || typeof payload !== 'object') return payload;
  const copy = Array.isArray(payload) ? [...payload] : { ...payload };

  for (const key of Object.keys(copy)) {
    const lower = key.toLowerCase();
    if (
      lower.includes('password') ||
      lower.includes('token') ||
      lower.includes('secret') ||
      lower.includes('cookie') ||
      lower.includes('otp') ||
      lower.includes('credential') ||
      lower.includes('session_key') ||
      lower.includes('authorization')
    ) {
      copy[key] = '[REDACTED]';
    } else if (typeof copy[key] === 'object') {
      copy[key] = sanitizePayload(copy[key]);
    }
  }
  return copy;
}

export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  module: string;
  event?: string;
  taskId?: string;
  workflowId?: string;
  stepId?: string;
  message: string;
}

export const logger = {
  info: (msg: string, meta?: { module?: string; event?: string; taskId?: string; workflowId?: string; data?: any }) => {
    const timestamp = new Date().toISOString();
    const mod = meta?.module ? `[${meta.module}]` : '[SYSTEM]';
    const sanitizedData = meta?.data ? sanitizePayload(meta.data) : undefined;
    console.log(`[INFO] ${timestamp} ${mod} ${msg}`, sanitizedData ? sanitizedData : '');
  },
  warn: (msg: string, meta?: { module?: string; event?: string; taskId?: string; workflowId?: string; data?: any }) => {
    const timestamp = new Date().toISOString();
    const mod = meta?.module ? `[${meta.module}]` : '[SYSTEM]';
    const sanitizedData = meta?.data ? sanitizePayload(meta.data) : undefined;
    console.warn(`[WARN] ${timestamp} ${mod} ${msg}`, sanitizedData ? sanitizedData : '');
  },
  error: (msg: string, error?: any, meta?: { module?: string; event?: string; taskId?: string; workflowId?: string }) => {
    const timestamp = new Date().toISOString();
    const mod = meta?.module ? `[${meta.module}]` : '[SYSTEM]';
    const errMessage = error instanceof Error ? error.message : typeof error === 'object' ? JSON.stringify(sanitizePayload(error)) : error;
    console.error(`[ERROR] ${timestamp} ${mod} ${msg}`, errMessage || '');
  },
  debug: (msg: string, meta?: { module?: string; data?: any }) => {
    if (process.env.DEBUG === 'true') {
      const timestamp = new Date().toISOString();
      const mod = meta?.module ? `[${meta.module}]` : '[DEBUG]';
      console.debug(`[DEBUG] ${timestamp} ${mod} ${msg}`, meta?.data ? sanitizePayload(meta.data) : '');
    }
  }
};
