import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
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

describe('Feature: chat-frontend-pii-panel, Property 4: Session Stats Accumulation', () => {
  let storage: TestStorage;

  beforeEach(() => {
    storage = new TestStorage();
    setStorage(storage);
    resetSessionStats();
  });

  /**
   * **Validates: Requirements 8.1, 8.2, 8.3**
   *
   * For any sequence of non-negative integer redaction counts, the cumulative
   * session stats counter SHALL equal the sum of all counts in the sequence
   * after processing each one, starting from zero.
   */
  it('cumulative session stats equals sum of all increments', () => {
    fc.assert(
      fc.property(
        fc.array(fc.nat(), { minLength: 1, maxLength: 50 }),
        (counts: number[]) => {
          // Reset before each property run
          resetSessionStats();

          let expectedTotal = 0;

          for (const count of counts) {
            expectedTotal += count;
            const result = incrementSessionStats(count);
            expect(result.itemsProtected).toBe(expectedTotal);
          }

          // Final read should also match
          const finalStats = getSessionStats();
          expect(finalStats.itemsProtected).toBe(expectedTotal);
        },
      ),
      { numRuns: 100 },
    );
  });
});
