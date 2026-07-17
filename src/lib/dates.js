// Local-calendar-date formatting. `new Date(y, m, d).toISOString().slice(0,10)`
// silently shifts the date by one day for any timezone ahead of UTC (e.g.
// Australia/Melbourne), since toISOString() always converts to UTC first —
// local midnight becomes the previous UTC day. This reads the local calendar
// fields directly instead, so it never crosses that boundary.
export const formatLocalDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const todayLocal = () => formatLocalDate(new Date());
