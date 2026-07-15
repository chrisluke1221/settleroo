// Occupancy-day-weighted bill splitting. Works in integer cents throughout
// and uses the largest-remainder method so shares always sum exactly to the
// bill total, regardless of rounding.
export const computeSplits = (propertyTenants, periodStart, periodEnd, totalAmount) => {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);

  const perTenantDays = propertyTenants
    .map((tenant) => {
      const moveIn = new Date(tenant.move_in_date);
      const moveOut = tenant.move_out_date ? new Date(tenant.move_out_date) : null;
      const occStart = moveIn > start ? moveIn : start;
      const occEnd = moveOut && moveOut < end ? moveOut : end;
      const occupancyDays = Math.max(0, Math.round((occEnd - occStart) / 86400000) + 1);
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
  const leftoverCents = totalCents - allocatedCents;

  const byRemainderDesc = [...shares].sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; i < leftoverCents; i++) {
    byRemainderDesc[i % byRemainderDesc.length].flooredCents += 1;
  }

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
