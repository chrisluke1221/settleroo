import { earliestGenerationMonthForProperty, buildGenerationPeriods } from './rentGeneration';

// Fixed "today" used across all tests so assertions don't drift with calendar.
// 2026-07-23 — the date this test suite was written.
const NOW = new Date(2026, 6, 23); // month is 0-indexed: 6 = July

const tenant = (id) => ({ id });
const rate = (tenantId, effectiveFrom) => ({ tenant_id: tenantId, effective_from: effectiveFrom });

// ─── earliestGenerationMonthForProperty ──────────────────────────────────────

describe('earliestGenerationMonthForProperty', () => {
  test('returns the 12-month floor when there are no rates', () => {
    const result = earliestGenerationMonthForProperty([tenant('t1')], [], NOW);
    // 12 months before July 2026 = July 2025
    expect(result).toEqual(new Date(2025, 6, 1));
  });

  test('returns the 12-month floor when there are no tenants', () => {
    const result = earliestGenerationMonthForProperty([], [rate('t1', '2026-01-01')], NOW);
    // No tenants → no matching rates → floor
    expect(result).toEqual(new Date(2025, 6, 1));
  });

  test('returns the data anchor when the earliest rate is within 12 months', () => {
    // Tenant moved in 4 months ago: March 2026
    const result = earliestGenerationMonthForProperty(
      [tenant('t1')],
      [rate('t1', '2026-03-15')],
      NOW
    );
    // Snapped to first of March 2026
    expect(result).toEqual(new Date(2026, 2, 1));
  });

  test('snaps the data anchor to the first of the month, not the exact rate date', () => {
    const result = earliestGenerationMonthForProperty(
      [tenant('t1')],
      [rate('t1', '2026-05-17')],
      NOW
    );
    expect(result).toEqual(new Date(2026, 4, 1)); // May 1
  });

  test('returns the 12-month floor when the earliest rate is older than 12 months', () => {
    // Rate from 2 years ago — should be capped at the 12-month floor
    const result = earliestGenerationMonthForProperty(
      [tenant('t1')],
      [rate('t1', '2024-01-01')],
      NOW
    );
    expect(result).toEqual(new Date(2025, 6, 1)); // July 2025
  });

  test('uses the earliest rate across multiple tenants', () => {
    // t1 has a rate from June 2026, t2 from February 2026 — should anchor to Feb
    const result = earliestGenerationMonthForProperty(
      [tenant('t1'), tenant('t2')],
      [rate('t1', '2026-06-01'), rate('t2', '2026-02-10')],
      NOW
    );
    expect(result).toEqual(new Date(2026, 1, 1)); // February 2026
  });

  test('ignores rates for tenants not in the property list', () => {
    // Only t1 is in this property; t2's older rate should not affect the result
    const result = earliestGenerationMonthForProperty(
      [tenant('t1')],
      [rate('t1', '2026-06-01'), rate('t2', '2025-01-01')],
      NOW
    );
    expect(result).toEqual(new Date(2026, 5, 1)); // June 2026
  });

  test('a rate starting exactly 12 months ago is included (boundary: not capped)', () => {
    // July 2025 is exactly at the floor — the data anchor equals the floor,
    // so the floor is returned (both are the same date).
    const result = earliestGenerationMonthForProperty(
      [tenant('t1')],
      [rate('t1', '2025-07-01')],
      NOW
    );
    expect(result).toEqual(new Date(2025, 6, 1)); // July 2025
  });

  test('a rate starting 13 months ago is capped at the 12-month floor', () => {
    const result = earliestGenerationMonthForProperty(
      [tenant('t1')],
      [rate('t1', '2025-06-01')],
      NOW
    );
    expect(result).toEqual(new Date(2025, 6, 1)); // capped at July 2025
  });
});

// ─── buildGenerationPeriods ───────────────────────────────────────────────────

describe('buildGenerationPeriods', () => {
  test('returns a single period when start equals current month', () => {
    const start = new Date(2026, 6, 1); // July 2026
    const current = new Date(2026, 6, 1);
    const periods = buildGenerationPeriods(start, current);
    expect(periods).toHaveLength(1);
    expect(periods[0]).toEqual({ start: '2026-07-01', end: '2026-07-31' });
  });

  test('returns correct periods from March to July (5 months)', () => {
    const start = new Date(2026, 2, 1); // March
    const current = new Date(2026, 6, 1); // July
    const periods = buildGenerationPeriods(start, current);
    expect(periods).toHaveLength(5);
    expect(periods[0]).toEqual({ start: '2026-03-01', end: '2026-03-31' });
    expect(periods[1]).toEqual({ start: '2026-04-01', end: '2026-04-30' });
    expect(periods[2]).toEqual({ start: '2026-05-01', end: '2026-05-31' });
    expect(periods[3]).toEqual({ start: '2026-06-01', end: '2026-06-30' });
    expect(periods[4]).toEqual({ start: '2026-07-01', end: '2026-07-31' });
  });

  test('handles month-end correctly for February in a non-leap year', () => {
    const start = new Date(2026, 1, 1); // Feb 2026 (non-leap)
    const current = new Date(2026, 1, 1);
    const periods = buildGenerationPeriods(start, current);
    expect(periods).toHaveLength(1);
    expect(periods[0]).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });

  test('handles month-end correctly for February in a leap year', () => {
    const start = new Date(2028, 1, 1); // Feb 2028 (leap year)
    const current = new Date(2028, 1, 1);
    const periods = buildGenerationPeriods(start, current);
    expect(periods).toHaveLength(1);
    expect(periods[0]).toEqual({ start: '2028-02-01', end: '2028-02-29' });
  });

  test('periods are in chronological order (oldest first)', () => {
    const start = new Date(2026, 4, 1); // May
    const current = new Date(2026, 6, 1); // July
    const periods = buildGenerationPeriods(start, current);
    expect(periods[0].start < periods[1].start).toBe(true);
    expect(periods[1].start < periods[2].start).toBe(true);
  });

  test('spans a year boundary correctly (Dec 2025 to Jan 2026)', () => {
    const start = new Date(2025, 11, 1); // December 2025
    const current = new Date(2026, 0, 1); // January 2026
    const periods = buildGenerationPeriods(start, current);
    expect(periods).toHaveLength(2);
    expect(periods[0]).toEqual({ start: '2025-12-01', end: '2025-12-31' });
    expect(periods[1]).toEqual({ start: '2026-01-01', end: '2026-01-31' });
  });
});
