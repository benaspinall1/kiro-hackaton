import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSessionStats,
  incrementSessionStats,
  resetSessionStats,
  setStorage,
  StorageLike,
} from '../src/frontend/session-stats';

/**
 * In-memory storage for test isolation.
 */
class TestStorage implements StorageLike {
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

describe('session-stats', () => {
  let storage: TestStorage;

  beforeEach(() => {
    storage = new TestStorage();
    setStorage(storage);
  });

  describe('getSessionStats', () => {
    it('returns { itemsProtected: 0 } when storage is empty', () => {
      expect(getSessionStats()).toEqual({ itemsProtected: 0 });
    });

    it('returns stored value when present', () => {
      storage.setItem('pii-session-stats', JSON.stringify({ itemsProtected: 5 }));
      expect(getSessionStats()).toEqual({ itemsProtected: 5 });
    });

    it('returns { itemsProtected: 0 } when stored value is invalid JSON', () => {
      storage.setItem('pii-session-stats', 'not-json');
      expect(getSessionStats()).toEqual({ itemsProtected: 0 });
    });
  });

  describe('incrementSessionStats', () => {
    it('increments from zero when no prior stats exist', () => {
      const result = incrementSessionStats(3);
      expect(result).toEqual({ itemsProtected: 3 });
    });

    it('accumulates across multiple increments', () => {
      incrementSessionStats(2);
      incrementSessionStats(5);
      const result = incrementSessionStats(1);
      expect(result).toEqual({ itemsProtected: 8 });
    });

    it('persists the updated value to storage', () => {
      incrementSessionStats(4);
      expect(getSessionStats()).toEqual({ itemsProtected: 4 });
    });
  });

  describe('resetSessionStats', () => {
    it('clears stats so getSessionStats returns zero', () => {
      incrementSessionStats(10);
      resetSessionStats();
      expect(getSessionStats()).toEqual({ itemsProtected: 0 });
    });
  });
});
