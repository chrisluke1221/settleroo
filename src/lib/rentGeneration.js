// Pure helpers for the rent-bill auto-generation logic.
// Extracted from PropertyContext so they can be unit-tested without React or
// Supabase. The context imports and calls these; nothing else should need to.

import { formatLocalDate } from './dates';

// Returns the calendar-month start Date that should be the earliest period
// generated for a given property. Anchored to the earliest rent_rate
// effective_from among the property's active tenants, capped at 12 months
// ago so we never generate more than one financial year of backfill.
//
// If no rates exist for the property's tenants, the 12-month floor is
// returned — the outer generation loop will find no billable charges and
// skip every period cleanly, which is the correct silent behaviour for a
// property that has tenants but no rates yet.
export const earliestGenerationMonthForProperty = (propertyTenants, ratesList, now = new Date()) => {
  // Hard floor: 12 months ago (aligns with AU financial year cycle).
  const floorMonthStart = new Date(now.getFullYear(), now.getMonth() - 12, 1);

  const tenantIds = new Set(propertyTenants.map((t) => t.id));
  const propertyRates = ratesList.filter((r) => tenantIds.has(r.tenant_id));
  if (propertyRates.length === 0) {
    return floorMonthStart;
  }

  // Earliest effective_from across all rates for this property's tenants.
  const earliestRateDate = propertyRates.reduce((earliest, r) => {
    return r.effective_from < earliest ? r.effective_from : earliest;
  }, propertyRates[0].effective_from);

  // Snap to the first day of that calendar month.
  const [year, month] = earliestRateDate.split('-').map(Number);
  const dataAnchorMonthStart = new Date(year, month - 1, 1);

  // Use whichever is later: the data anchor or the 12-month floor.
  return dataAnchorMonthStart > floorMonthStart ? dataAnchorMonthStart : floorMonthStart;
};

// Builds the ordered list of calendar-month { start, end } period strings
// from the earliest generation month up to and including the current month.
// Both bounds are inclusive. The result is always at least one period
// (the current month).
export const buildGenerationPeriods = (startMonth, currentMonthStart) => {
  const periods = [];
  let cursor = new Date(startMonth);
  while (cursor <= currentMonthStart) {
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    periods.push({ start: formatLocalDate(cursor), end: formatLocalDate(end) });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return periods;
};
