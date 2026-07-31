// Bill splitting helpers. Two strategies are supported:
//
//   computeSplits — occupancy-day-weighted (default for electricity, gas, water,
//     and all other utility types). Each tenant's share is proportional to
//     (occupancy_days × number_of_occupants), so a tenant who moved in mid-period
//     pays less than one who was there the whole time, and a room with two people
//     pays more than a room with one.
//
//   computeFlatSplitByHeadcount — flat per-person split (internet/NBN bills).
//     Internet is a fixed monthly service: it doesn't matter when in the month
//     someone moved in — the service was provisioned for the whole period and
//     the cost is shared equally by headcount. A tenant who moved out before the
//     period started is excluded; everyone else pays an equal share regardless
//     of occupancy days.
//
// Both helpers work in integer cents throughout and use the largest-remainder
// method so shares always sum exactly to the bill total, regardless of rounding.

// Which bill types use flat headcount splitting instead of occupancy-day weighting.
// Exported so the UI can show the right explanation copy without duplicating this list.
export const FLAT_SPLIT_BILL_TYPES = new Set(['internet']);

// Returns true when this bill type should use flat per-person splitting.
export const usesFlatSplit = (billType) => FLAT_SPLIT_BILL_TYPES.has(billType);

// ─── Shared helpers ───────────────────────────────────────────────────────────

// Largest-remainder allocation: given an array of { flooredCents, remainder }
// objects and a leftover cents count, distribute the leftover one cent at a
// time to the entries with the largest remainders. Mutates in place.
const applyLargestRemainder = (shares, leftoverCents) => {
  const byRemainderDesc = [...shares].sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; i < leftoverCents; i++) {
    byRemainderDesc[i % byRemainderDesc.length].flooredCents += 1;
  }
};

// ─── Strategy 1: occupancy-day weighted ──────────────────────────────────────

// exceptions: optional array of { tenant_id, exception_start, exception_end }
// — a negotiated absence adjustment (CHR-21). Exception days that overlap a
// tenant's occupancy window are subtracted from their occupancy_days before
// person_days is computed, which is sufficient to redistribute their reduced
// share pro-rata across the other tenants: totalPersonDays shrinks by the
// same amount, so every other tenant's (personDays / totalPersonDays)
// percentage increases automatically. No separate redistribution step is
// needed — this is the same proportional-split math, just over fewer
// person-days for the exempted tenant, so the split-sum invariant holds for
// free (see PROPOSED_20260731090000_occupancy_exceptions.sql for the schema
// this is designed against).
const excludedDaysForTenant = (tenantId, occStart, occEnd, exceptions) => {
  if (!exceptions || exceptions.length === 0) return 0;
  return exceptions
    .filter((ex) => ex.tenant_id === tenantId)
    .reduce((sum, ex) => {
      const exStart = new Date(ex.exception_start);
      const exEnd = new Date(ex.exception_end);
      const overlapStart = exStart > occStart ? exStart : occStart;
      const overlapEnd = exEnd < occEnd ? exEnd : occEnd;
      const overlapDays = Math.round((overlapEnd - overlapStart) / 86400000) + 1;
      return sum + Math.max(0, overlapDays);
    }, 0);
};

export const computeSplits = (propertyTenants, periodStart, periodEnd, totalAmount, exceptions = []) => {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);

  const perTenantDays = propertyTenants
    .map((tenant) => {
      const moveIn = new Date(tenant.move_in_date);
      const moveOut = tenant.move_out_date ? new Date(tenant.move_out_date) : null;
      const occStart = moveIn > start ? moveIn : start;
      const occEnd = moveOut && moveOut < end ? moveOut : end;
      const rawOccupancyDays = Math.max(0, Math.round((occEnd - occStart) / 86400000) + 1);
      const excludedDays = excludedDaysForTenant(tenant.id, occStart, occEnd, exceptions);
      const occupancyDays = Math.max(0, rawOccupancyDays - excludedDays);
      const personDays = occupancyDays * (tenant.number_of_occupants || 1);
      return { tenant, occStart, occEnd, occupancyDays, personDays };
    })
    .filter((t) => t.personDays > 0);

  const totalPersonDays = perTenantDays.reduce((sum, t) => sum + t.personDays, 0);
  if (totalPersonDays === 0) return [];

  const totalCents = Math.round(totalAmount * 100);

  const shares = perTenantDays.map((t) => {
    const exactCents = (t.personDays / totalPersonDays) * totalCents;
    const flooredCents = Math.floor(exactCents);
    return { ...t, flooredCents, remainder: exactCents - flooredCents };
  });

  const allocatedCents = shares.reduce((sum, s) => sum + s.flooredCents, 0);
  applyLargestRemainder(shares, totalCents - allocatedCents);

  return shares.map((s) => ({
    tenant_id: s.tenant.id,
    tenant_name: s.tenant.name,
    room: s.tenant.room,
    number_of_occupants: s.tenant.number_of_occupants || 1,
    occupancy_days: s.occupancyDays,
    person_days: s.personDays,
    percentage: Math.round((s.personDays / totalPersonDays) * 10000) / 100,
    owed_amount: s.flooredCents / 100,
    occupancy_start: s.occStart.toISOString().slice(0, 10),
    occupancy_end: s.occEnd.toISOString().slice(0, 10),
  }));
};

// ─── Strategy 2: flat per-person (internet) ───────────────────────────────────

// Internet is a fixed-cost service billed for the whole period regardless of
// when tenants moved in. Tenants fully outside the billing period are excluded
// (they weren't there at all), but everyone else pays an equal share per person
// (number_of_occupants). No day-weighting: a tenant who moved in on the last
// day of the period still pays the same as one who was there the whole month.
export const computeFlatSplitByHeadcount = (propertyTenants, periodStart, periodEnd, totalAmount) => {
  // Exclude tenants who moved out before the period started or moved in after
  // the period ended — they had no presence in this billing window at all.
  const activeTenants = propertyTenants.filter((tenant) => {
    if (tenant.move_out_date && tenant.move_out_date < periodStart) return false;
    if (tenant.move_in_date > periodEnd) return false;
    return true;
  });

  const totalHeadcount = activeTenants.reduce((sum, t) => sum + (t.number_of_occupants || 1), 0);
  if (totalHeadcount === 0) return [];

  const totalCents = Math.round(totalAmount * 100);

  const shares = activeTenants.map((t) => {
    const headcount = t.number_of_occupants || 1;
    const exactCents = (headcount / totalHeadcount) * totalCents;
    const flooredCents = Math.floor(exactCents);
    return { tenant: t, headcount, flooredCents, remainder: exactCents - flooredCents };
  });

  const allocatedCents = shares.reduce((sum, s) => sum + s.flooredCents, 0);
  applyLargestRemainder(shares, totalCents - allocatedCents);

  return shares.map((s) => ({
    tenant_id: s.tenant.id,
    tenant_name: s.tenant.name,
    room: s.tenant.room,
    number_of_occupants: s.headcount,
    // occupancy_days is the full period length — flat split doesn't prorate by day,
    // but we store the period length so the UI can show "full period" consistently.
    occupancy_days: Math.round((new Date(periodEnd) - new Date(periodStart)) / 86400000) + 1,
    person_days: s.headcount, // flat: each person counts as 1 "unit" regardless of days
    percentage: Math.round((s.headcount / totalHeadcount) * 10000) / 100,
    owed_amount: s.flooredCents / 100,
    occupancy_start: periodStart,
    occupancy_end: periodEnd,
  }));
};
