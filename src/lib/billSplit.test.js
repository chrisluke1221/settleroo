import { computeSplits, computeFlatSplitByHeadcount, usesFlatSplit, FLAT_SPLIT_BILL_TYPES } from './billSplit';

const tenant = (overrides) => ({
  id: Math.random().toString(36).slice(2),
  name: 'Tenant',
  room: 'Room 1',
  number_of_occupants: 1,
  move_in_date: '2026-01-01',
  move_out_date: null,
  ...overrides,
});

// ─── computeSplits (occupancy-day weighted) ───────────────────────────────────

describe('computeSplits', () => {
  test('splits always sum exactly to the bill total, across randomized inputs', () => {
    for (let i = 0; i < 200; i++) {
      const tenantCount = 1 + Math.floor(Math.random() * 5);
      const tenants = Array.from({ length: tenantCount }, () =>
        tenant({
          number_of_occupants: 1 + Math.floor(Math.random() * 3),
          move_in_date: `2026-01-${String(1 + Math.floor(Math.random() * 10)).padStart(2, '0')}`,
        })
      );
      const totalAmount = Math.round((1 + Math.random() * 999) * 100) / 100;

      const splits = computeSplits(tenants, '2026-01-01', '2026-01-31', totalAmount);
      const sum = splits.reduce((s, x) => s + Math.round(x.owed_amount * 100), 0);

      expect(sum).toBe(Math.round(totalAmount * 100));
    }
  });

  test('$100.00 over 3 equal tenants sums to exactly $100.00 (the classic 33.33 x3 failure)', () => {
    const tenants = [tenant({ name: 'A' }), tenant({ name: 'B' }), tenant({ name: 'C' })];
    const splits = computeSplits(tenants, '2026-01-01', '2026-01-31', 100);
    const sum = splits.reduce((s, x) => s + x.owed_amount, 0);
    expect(Math.round(sum * 100)).toBe(10000);
  });

  test('single tenant gets 100% and the full amount', () => {
    const splits = computeSplits([tenant()], '2026-01-01', '2026-01-31', 350);
    expect(splits).toHaveLength(1);
    expect(splits[0].percentage).toBe(100);
    expect(splits[0].owed_amount).toBe(350);
  });

  test('tenant with a move-out date is only charged for occupied days', () => {
    const tenants = [
      tenant({ name: 'Stays all month' }),
      tenant({ name: 'Moves out mid-month', move_out_date: '2026-01-10' }),
    ];
    const splits = computeSplits(tenants, '2026-01-01', '2026-01-31', 100);
    const mover = splits.find((s) => s.tenant_name === 'Moves out mid-month');
    expect(mover.occupancy_days).toBe(10);
  });

  test('tenant fully outside the billing period is excluded, not charged $0', () => {
    const tenants = [
      tenant({ name: 'In period' }),
      tenant({ name: 'Moved out before period started', move_in_date: '2025-01-01', move_out_date: '2025-06-01' }),
    ];
    const splits = computeSplits(tenants, '2026-01-01', '2026-01-31', 100);
    expect(splits).toHaveLength(1);
    expect(splits[0].tenant_name).toBe('In period');
  });

  test('no tenants occupying the period returns an empty array, not a divide-by-zero crash', () => {
    const splits = computeSplits([], '2026-01-01', '2026-01-31', 100);
    expect(splits).toEqual([]);
  });

  test('more occupants means a larger share', () => {
    const tenants = [tenant({ name: 'Solo', number_of_occupants: 1 }), tenant({ name: 'Couple', number_of_occupants: 2 })];
    const splits = computeSplits(tenants, '2026-01-01', '2026-01-31', 90);
    const solo = splits.find((s) => s.tenant_name === 'Solo');
    const couple = splits.find((s) => s.tenant_name === 'Couple');
    expect(couple.owed_amount).toBeGreaterThan(solo.owed_amount);
    expect(Math.round((solo.owed_amount + couple.owed_amount) * 100)).toBe(9000);
  });

  // ─── CHR-21 / CHR-38: occupancy exceptions (negotiated absence) ────────────

  test('no exceptions passed: byte-identical output to the baseline (regression-safe)', () => {
    const tenants = [tenant({ name: 'A' }), tenant({ name: 'B' }), tenant({ name: 'C' })];
    const withoutArg = computeSplits(tenants, '2026-01-01', '2026-01-31', 100);
    const withEmptyArray = computeSplits(tenants, '2026-01-01', '2026-01-31', 100, []);
    expect(withEmptyArray).toEqual(withoutArg);
  });

  test('tenant fully exempted for the whole period is excluded, and the others split the whole bill', () => {
    const tenants = [tenant({ name: 'Exempted' }), tenant({ name: 'Pays' })];
    const exceptions = [{ tenant_id: tenants[0].id, exception_start: '2026-01-01', exception_end: '2026-01-31' }];
    const splits = computeSplits(tenants, '2026-01-01', '2026-01-31', 100, exceptions);
    expect(splits).toHaveLength(1);
    expect(splits[0].tenant_name).toBe('Pays');
    expect(splits[0].owed_amount).toBe(100);
  });

  test('tenant exempted for a sub-period pays less and the redistributed amount lands on the other tenant', () => {
    const tenants = [tenant({ name: 'Away' }), tenant({ name: 'Stayed' })];
    // Away tenant misses 10 of the 31 days
    const exceptions = [{ tenant_id: tenants[0].id, exception_start: '2026-01-01', exception_end: '2026-01-10' }];
    const baseline = computeSplits(tenants, '2026-01-01', '2026-01-31', 100);
    const adjusted = computeSplits(tenants, '2026-01-01', '2026-01-31', 100, exceptions);

    const awayAdjusted = adjusted.find((s) => s.tenant_name === 'Away');
    const stayedAdjusted = adjusted.find((s) => s.tenant_name === 'Stayed');
    const awayBaseline = baseline.find((s) => s.tenant_name === 'Away');
    const stayedBaseline = baseline.find((s) => s.tenant_name === 'Stayed');

    expect(awayAdjusted.occupancy_days).toBe(awayBaseline.occupancy_days - 10);
    expect(awayAdjusted.owed_amount).toBeLessThan(awayBaseline.owed_amount);
    expect(stayedAdjusted.owed_amount).toBeGreaterThan(stayedBaseline.owed_amount);
    // split-sum invariant: still sums to exactly the bill total
    expect(Math.round((awayAdjusted.owed_amount + stayedAdjusted.owed_amount) * 100)).toBe(10000);
  });

  test('multiple tenants with their own (non-overlapping) exceptions still sum to exactly the bill total', () => {
    for (let i = 0; i < 50; i++) {
      const tenants = [tenant({ name: 'A' }), tenant({ name: 'B' }), tenant({ name: 'C' })];
      const totalAmount = Math.round((1 + Math.random() * 999) * 100) / 100;
      const exceptions = [
        { tenant_id: tenants[0].id, exception_start: '2026-01-02', exception_end: '2026-01-05' },
        { tenant_id: tenants[1].id, exception_start: '2026-01-20', exception_end: '2026-01-25' },
      ];
      const splits = computeSplits(tenants, '2026-01-01', '2026-01-31', totalAmount, exceptions);
      const sum = splits.reduce((s, x) => s + Math.round(x.owed_amount * 100), 0);
      expect(sum).toBe(Math.round(totalAmount * 100));
    }
  });

  test('an exception outside the tenant\'s actual occupancy window has no effect', () => {
    const tenants = [
      tenant({ name: 'Moved out mid-month', move_out_date: '2026-01-15' }),
      tenant({ name: 'Full month' }),
    ];
    // Exception is entirely after the exempted tenant moved out — no overlap
    const exceptions = [{ tenant_id: tenants[0].id, exception_start: '2026-01-20', exception_end: '2026-01-25' }];
    const baseline = computeSplits(tenants, '2026-01-01', '2026-01-31', 100);
    const adjusted = computeSplits(tenants, '2026-01-01', '2026-01-31', 100, exceptions);
    expect(adjusted).toEqual(baseline);
  });
});

// ─── computeFlatSplitByHeadcount (internet bills) ────────────────────────────

describe('computeFlatSplitByHeadcount', () => {
  test('splits always sum exactly to the bill total, across randomized inputs', () => {
    for (let i = 0; i < 200; i++) {
      const tenantCount = 1 + Math.floor(Math.random() * 5);
      const tenants = Array.from({ length: tenantCount }, () =>
        tenant({
          number_of_occupants: 1 + Math.floor(Math.random() * 3),
          // Some tenants move in mid-period — flat split ignores this for share calc
          move_in_date: `2026-01-${String(1 + Math.floor(Math.random() * 20)).padStart(2, '0')}`,
        })
      );
      const totalAmount = Math.round((1 + Math.random() * 999) * 100) / 100;

      const splits = computeFlatSplitByHeadcount(tenants, '2026-01-01', '2026-01-31', totalAmount);
      const sum = splits.reduce((s, x) => s + Math.round(x.owed_amount * 100), 0);

      expect(sum).toBe(Math.round(totalAmount * 100));
    }
  });

  test('$90 over 3 equal single-occupant tenants = $30 each, regardless of move-in dates', () => {
    const tenants = [
      tenant({ name: 'A', move_in_date: '2026-01-01' }),
      tenant({ name: 'B', move_in_date: '2026-01-15' }), // moved in mid-period
      tenant({ name: 'C', move_in_date: '2026-01-28' }), // moved in near end
    ];
    const splits = computeFlatSplitByHeadcount(tenants, '2026-01-01', '2026-01-31', 90);
    expect(splits).toHaveLength(3);
    splits.forEach((s) => expect(s.owed_amount).toBe(30));
    expect(splits.reduce((sum, s) => sum + Math.round(s.owed_amount * 100), 0)).toBe(9000);
  });

  test('tenant who moved out before the period started is excluded', () => {
    const tenants = [
      tenant({ name: 'In period' }),
      tenant({ name: 'Gone', move_in_date: '2025-01-01', move_out_date: '2025-12-31' }),
    ];
    const splits = computeFlatSplitByHeadcount(tenants, '2026-01-01', '2026-01-31', 100);
    expect(splits).toHaveLength(1);
    expect(splits[0].tenant_name).toBe('In period');
  });

  test('tenant who moved in after the period ended is excluded', () => {
    const tenants = [
      tenant({ name: 'In period' }),
      tenant({ name: 'Not yet', move_in_date: '2026-02-01' }),
    ];
    const splits = computeFlatSplitByHeadcount(tenants, '2026-01-01', '2026-01-31', 100);
    expect(splits).toHaveLength(1);
    expect(splits[0].tenant_name).toBe('In period');
  });

  test('room with 2 occupants pays twice as much as a room with 1 occupant', () => {
    const tenants = [
      tenant({ name: 'Solo', number_of_occupants: 1 }),
      tenant({ name: 'Couple', number_of_occupants: 2 }),
    ];
    const splits = computeFlatSplitByHeadcount(tenants, '2026-01-01', '2026-01-31', 90);
    const solo = splits.find((s) => s.tenant_name === 'Solo');
    const couple = splits.find((s) => s.tenant_name === 'Couple');
    expect(couple.owed_amount).toBe(solo.owed_amount * 2);
    expect(Math.round((solo.owed_amount + couple.owed_amount) * 100)).toBe(9000);
  });

  test('single tenant gets 100% and the full amount', () => {
    const splits = computeFlatSplitByHeadcount([tenant()], '2026-01-01', '2026-01-31', 120);
    expect(splits).toHaveLength(1);
    expect(splits[0].percentage).toBe(100);
    expect(splits[0].owed_amount).toBe(120);
  });

  test('no tenants returns empty array without crashing', () => {
    const splits = computeFlatSplitByHeadcount([], '2026-01-01', '2026-01-31', 100);
    expect(splits).toEqual([]);
  });

  test('tenant who moved out on the last day of the period is included (boundary)', () => {
    const tenants = [
      tenant({ name: 'Full month' }),
      tenant({ name: 'Moves out last day', move_out_date: '2026-01-31' }),
    ];
    const splits = computeFlatSplitByHeadcount(tenants, '2026-01-01', '2026-01-31', 100);
    expect(splits).toHaveLength(2);
  });

  test('$100 over 3 equal tenants sums to exactly $100 (the classic 33.33 x3 failure)', () => {
    const tenants = [tenant({ name: 'A' }), tenant({ name: 'B' }), tenant({ name: 'C' })];
    const splits = computeFlatSplitByHeadcount(tenants, '2026-01-01', '2026-01-31', 100);
    const sum = splits.reduce((s, x) => s + Math.round(x.owed_amount * 100), 0);
    expect(sum).toBe(10000);
  });

  test('occupancy_start and occupancy_end equal the full billing period (flat split, no proration)', () => {
    const splits = computeFlatSplitByHeadcount([tenant({ move_in_date: '2026-01-15' })], '2026-01-01', '2026-01-31', 100);
    expect(splits[0].occupancy_start).toBe('2026-01-01');
    expect(splits[0].occupancy_end).toBe('2026-01-31');
  });
});

// ─── usesFlatSplit / FLAT_SPLIT_BILL_TYPES ────────────────────────────────────

describe('usesFlatSplit', () => {
  test('returns true for internet', () => {
    expect(usesFlatSplit('internet')).toBe(true);
  });

  test('returns false for electricity, gas, water, other', () => {
    ['electricity', 'gas', 'water', 'other'].forEach((type) => {
      expect(usesFlatSplit(type)).toBe(false);
    });
  });

  test('FLAT_SPLIT_BILL_TYPES contains internet', () => {
    expect(FLAT_SPLIT_BILL_TYPES.has('internet')).toBe(true);
  });
});
