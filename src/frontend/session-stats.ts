/**
 * Session stats accumulation logic for tracking PII items protected.
 *
 * Uses sessionStorage when available (browser), falls back to an
 * in-memory store for Node.js / test environments.
 *
 * Validates: Requirements 8.1, 8.2, 8.3
 */

import type { SessionStats } from './types';

const SESSION_STATS_KEY = 'pii-session-stats';

/**
 * Minimal Storage interface matching the subset of Web Storage API we need.
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Simple in-memory storage fallback for non-browser environments.
 */
class InMemoryStorage implements StorageLike {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }
}

/**
 * Resolve the storage backend: sessionStorage in browser, in-memory otherwise.
 */
function getStorage(): StorageLike {
  if (typeof sessionStorage !== 'undefined') {
    return sessionStorage;
  }
  return defaultStorage;
}

const defaultStorage = new InMemoryStorage();

/**
 * Replace the storage backend (useful for testing).
 */
let storageOverride: StorageLike | null = null;

export function setStorage(storage: StorageLike | null): void {
  storageOverride = storage;
}

function resolveStorage(): StorageLike {
  return storageOverride ?? getStorage();
}

/**
 * Reads the current session stats from storage.
 * Returns `{ itemsProtected: 0 }` if no entry is found.
 *
 * Validates: Requirement 8.1
 */
export function getSessionStats(): SessionStats {
  const storage = resolveStorage();
  const raw = storage.getItem(SESSION_STATS_KEY);
  if (raw === null) {
    return { itemsProtected: 0 };
  }
  try {
    const parsed = JSON.parse(raw) as SessionStats;
    return { itemsProtected: parsed.itemsProtected ?? 0 };
  } catch {
    return { itemsProtected: 0 };
  }
}

/**
 * Increments the session stats by the given count, writes back to storage,
 * and returns the updated stats.
 *
 * Validates: Requirement 8.2
 */
export function incrementSessionStats(count: number): SessionStats {
  const storage = resolveStorage();
  const current = getSessionStats();
  const updated: SessionStats = {
    itemsProtected: current.itemsProtected + count,
  };
  storage.setItem(SESSION_STATS_KEY, JSON.stringify(updated));
  return updated;
}

/**
 * Clears the session stats entry from storage.
 *
 * Validates: Requirement 8.3
 */
export function resetSessionStats(): void {
  const storage = resolveStorage();
  storage.removeItem(SESSION_STATS_KEY);
}
