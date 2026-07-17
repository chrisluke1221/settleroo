// Centralized so every payment-state chip (splits table, mobile cards,
// tenant view, dashboard work queue) reads the same colors and labels
// instead of each screen hardcoding its own.
export const STATUS_STYLES = {
  pending: 'bg-secondary-100 text-secondary-600',
  viewed: 'bg-warning-100 text-warning-700',
  paid: 'bg-success-100 text-success-700',
  overdue: 'bg-danger-100 text-danger-700',
};

export const STATUS_LABELS = {
  pending: 'Pending',
  viewed: 'Viewed',
  paid: 'Paid',
  overdue: 'Overdue',
};

export const statusStyle = (status) => STATUS_STYLES[status] || STATUS_STYLES.pending;
export const statusLabel = (status) => STATUS_LABELS[status] || STATUS_LABELS.pending;

// "Overdue" isn't a stored status — it's derived from the bill's due date so
// it can never drift out of sync with today. A split is only ever pending,
// viewed, or paid in the database; overdue is what the UI shows on top of
// pending/viewed once the due date has passed.
export const effectiveStatus = (split, bill) => {
  const status = split.status || 'pending';
  if (status === 'paid') return status;
  if (bill?.due_date && bill.due_date < new Date().toISOString().slice(0, 10)) return 'overdue';
  return status;
};
