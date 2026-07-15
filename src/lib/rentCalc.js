// Effective-dated rent proration. A tenant can have multiple rent_rates
// rows over time (weekly/fortnightly/monthly, each with an effective
// date range). Given a billing period, this resolves the rate in force
// for each day and sums the cost — so a mid-period rate change prorates
// both rates by day, cents-exact.

const DAY_MS = 86400000;

const daysInMonth = (year, monthIndex) => new Date(year, monthIndex + 1, 0).getDate();

// Daily rate in cents for a given calendar day. Weekly/fortnightly divide
// by a fixed period length; monthly divides by the number of days in that
// specific calendar month, so "$800/mo in a 31-day month" and "$800/mo in
// a 30-day month" charge different daily amounts — matching how real
// rent proration works, not a flat 30.44-day approximation.
const dailyRateCents = (rate, date) => {
  if (rate.frequency === 'weekly') return rate.amount_cents / 7;
  if (rate.frequency === 'fortnightly') return rate.amount_cents / 14;
  return rate.amount_cents / daysInMonth(date.getFullYear(), date.getMonth());
};

const rateForDay = (rates, date) => {
  const dateStr = date.toISOString().slice(0, 10);
  return rates.find((r) => {
    if (dateStr < r.effective_from) return false;
    if (r.effective_to && dateStr > r.effective_to) return false;
    return true;
  });
};

// Returns { totalCents, segments } where segments groups consecutive days
// under the same rate into one line item, for a transparent breakdown.
export const computeRentForPeriod = (rates, periodStart, periodEnd) => {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const sortedRates = [...rates].sort((a, b) => a.effective_from.localeCompare(b.effective_from));

  const segments = [];
  let totalCents = 0;
  let cursor = new Date(start);

  while (cursor <= end) {
    const rate = rateForDay(sortedRates, cursor);
    if (!rate) {
      cursor = new Date(cursor.getTime() + DAY_MS);
      continue;
    }
    const cents = dailyRateCents(rate, cursor);
    const last = segments[segments.length - 1];
    if (last && last.rateId === rate.id) {
      last.days += 1;
      last.cents += cents;
      last.to = cursor.toISOString().slice(0, 10);
    } else {
      segments.push({
        rateId: rate.id,
        amountCents: rate.amount_cents,
        frequency: rate.frequency,
        from: cursor.toISOString().slice(0, 10),
        to: cursor.toISOString().slice(0, 10),
        days: 1,
        cents,
      });
    }
    totalCents += cents;
    cursor = new Date(cursor.getTime() + DAY_MS);
  }

  const roundedTotal = Math.round(totalCents);
  return {
    totalCents: roundedTotal,
    segments: segments.map((s) => ({ ...s, cents: Math.round(s.cents) })),
  };
};

// Whether a proposed new rate [effectiveFrom, ) would overlap any existing
// rate for the same tenant. Mirrors the DB exclusion constraint so the UI
// can give an immediate error instead of waiting on a 23P01 from Postgres.
export const ratesOverlap = (existingRates, effectiveFrom, effectiveTo) => {
  return existingRates.some((r) => {
    const aStart = effectiveFrom;
    const aEnd = effectiveTo || '9999-12-31';
    const bStart = r.effective_from;
    const bEnd = r.effective_to || '9999-12-31';
    return aStart <= bEnd && bStart <= aEnd;
  });
};
