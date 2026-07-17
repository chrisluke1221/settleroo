export const formatDollars = (value) => `$${Number(value).toFixed(2)}`;

export const formatCents = (cents) => `$${(Number(cents) / 100).toFixed(2)}`;
