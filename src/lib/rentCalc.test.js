import { computeRentForPeriod, ratesOverlap } from './rentCalc';

const rate = (overrides) => ({
  id: Math.random().toString(36).slice(2),
  amount_cents: 80000,
  frequency: 'monthly',
  effective_from: '2026-01-01',
  effective_to: null,
  ...overrides,
});

describe('computeRentForPeriod', () => {
  test('PRD acceptance criteria: $800/mo to Jul 31, $880/mo from Aug 1, billed Jul 15-Aug 14 -> 17 days old rate + 14 days new rate, cents-exact', () => {
    const rates = [
      rate({ id: 'old', amount_cents: 80000, effective_from: '2026-01-01', effective_to: '2026-07-31' }),
      rate({ id: 'new', amount_cents: 88000, effective_from: '2026-08-01', effective_to: null }),
    ];

    const { totalCents, segments } = computeRentForPeriod(rates, '2026-07-15', '2026-08-14');

    expect(segments).toHaveLength(2);
    expect(segments[0].rateId).toBe('old');
    expect(segments[0].days).toBe(17); // Jul 15-31 inclusive
    expect(segments[1].rateId).toBe('new');
    expect(segments[1].days).toBe(14); // Aug 1-14 inclusive

    const julyDailyCents = 80000 / 31; // July has 31 days
    const augDailyCents = 88000 / 31; // August has 31 days
    const expectedTotal = Math.round(17 * julyDailyCents + 14 * augDailyCents);

    expect(totalCents).toBe(expectedTotal);
  });

  test('single rate covering the whole period charges exactly the daily rate times days', () => {
    const rates = [rate({ amount_cents: 70000, frequency: 'weekly', effective_from: '2026-01-01' })];
    const { totalCents, segments } = computeRentForPeriod(rates, '2026-02-01', '2026-02-07');
    expect(segments).toHaveLength(1);
    expect(segments[0].days).toBe(7);
    expect(totalCents).toBe(70000); // exactly one week at $700/week
  });

  test('days with no rate in force are skipped, not charged', () => {
    const rates = [rate({ effective_from: '2026-03-10', effective_to: null })];
    const { totalCents, segments } = computeRentForPeriod(rates, '2026-03-01', '2026-03-10');
    expect(segments).toHaveLength(1);
    expect(segments[0].days).toBe(1); // only Mar 10 is covered
    expect(totalCents).toBeGreaterThan(0);
  });

  test('no applicable rate at all returns zero with no segments', () => {
    const { totalCents, segments } = computeRentForPeriod([], '2026-01-01', '2026-01-31');
    expect(totalCents).toBe(0);
    expect(segments).toEqual([]);
  });
});

describe('ratesOverlap', () => {
  test('detects overlap with an open-ended existing rate', () => {
    const existing = [rate({ effective_from: '2026-01-01', effective_to: null })];
    expect(ratesOverlap(existing, '2026-06-01', null)).toBe(true);
  });

  test('no overlap when new rate starts the day after existing rate ends', () => {
    const existing = [rate({ effective_from: '2026-01-01', effective_to: '2026-05-31' })];
    expect(ratesOverlap(existing, '2026-06-01', null)).toBe(false);
  });

  test('detects overlap when new rate starts before existing rate ends', () => {
    const existing = [rate({ effective_from: '2026-01-01', effective_to: '2026-06-30' })];
    expect(ratesOverlap(existing, '2026-06-01', null)).toBe(true);
  });
});
