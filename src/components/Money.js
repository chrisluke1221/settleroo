import React from 'react';
import { formatDollars, formatCents } from '../lib/format';

// Every money amount in the app renders through this component so the
// tabular-nums + weight treatment is consistent instead of ad hoc per screen.
const Money = ({ cents, dollars, className = '', as: Component = 'span' }) => {
  const text = cents !== undefined ? formatCents(cents) : formatDollars(dollars);
  return <Component className={`tabular-nums font-semibold ${className}`}>{text}</Component>;
};

export default Money;
