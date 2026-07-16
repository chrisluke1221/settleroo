// Centralized so every payment-state chip (splits table, mobile cards,
// tenant view, dashboard work queue) reads the same colors and labels
// instead of each screen hardcoding its own.
export const STATUS_STYLES = {
  pending: 'bg-secondary-100 text-secondary-600',
  viewed: 'bg-warning-100 text-warning-700',
  paid: 'bg-success-100 text-success-700',
};

export const STATUS_LABELS = {
  pending: 'Pending',
  viewed: 'Viewed',
  paid: 'Paid',
};

export const statusStyle = (status) => STATUS_STYLES[status] || STATUS_STYLES.pending;
export const statusLabel = (status) => STATUS_LABELS[status] || STATUS_LABELS.pending;
