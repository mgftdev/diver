import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config.js';

/**
 * Append-only NDJSON store: one JSON object per line.
 *
 * It is deliberately the only module that knows how leads are persisted, so
 * moving to Postgres or SQLite means rewriting this file and nothing else —
 * keep the exported function signatures and the rest of the server is unaware.
 */

const file = config.paths.leads;

// Serialises writes so two concurrent submissions cannot interleave a line.
let writeQueue = Promise.resolve();

async function ensureStore() {
  await fs.mkdir(path.dirname(file), { recursive: true });
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, '', 'utf8');
  }
}

async function readAll() {
  await ensureStore();
  const raw = await fs.readFile(file, 'utf8');
  return raw
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch {
        return { id: `corrupt-${index}`, corrupt: true, raw: line };
      }
    });
}

export async function create(lead) {
  const record = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...lead,
  };

  writeQueue = writeQueue.then(async () => {
    await ensureStore();
    await fs.appendFile(file, `${JSON.stringify(record)}\n`, 'utf8');
  });
  await writeQueue;

  return record;
}

export async function list({ limit = 50, offset = 0 } = {}) {
  const rows = await readAll();
  rows.reverse(); // newest first
  return {
    total: rows.length,
    items: rows.slice(offset, offset + limit),
  };
}

export async function countSince(isoDate) {
  const rows = await readAll();
  return rows.filter((row) => !row.corrupt && row.createdAt >= isoDate).length;
}

export async function countBookedThisMonth() {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const rows = await readAll();
  return rows.filter((row) => !row.corrupt && row.createdAt >= monthStart && row.status === 'booked').length;
}
