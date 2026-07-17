import React from 'react';
import { motion } from 'framer-motion';
import { statusStyle, statusLabel } from '../lib/paymentStatus';

// Keyed on status so it replays a brief confirmation pop whenever a split
// actually changes state (e.g. marked paid), instead of an instant silent swap.
const StatusBadge = ({ status }) => (
  <motion.span
    key={status}
    initial={{ scale: 0.85, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ duration: 0.2 }}
    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle(status)}`}
  >
    {statusLabel(status)}
  </motion.span>
);

export default StatusBadge;
