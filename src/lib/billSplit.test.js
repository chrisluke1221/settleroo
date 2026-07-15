import { computeSplits } from './billSplit';

const tenant = (overrides) => ({
  id: Math.random().toString(36).slice(2),
  name: 'Tenant',
  room: 'Room 1',
  number_of_occupants: 1,
  move_in_date: '2026-01-01',
  move_out_date: null,
  ...overrides,
});

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
});
