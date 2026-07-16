import React from 'react';
import { ExternalLink, Copy, ShieldOff, CheckCircle2, RotateCcw, Mail, MailCheck } from 'lucide-react';

// Shared by the desktop splits table and the mobile stacked-card layout so
// the five per-split actions aren't duplicated in two places.
const SplitActions = ({ split, sendingSplitId, onRevoke, onSetStatus, onSendEmail }) => (
  <div className="flex items-center space-x-2">
    <a
      href={`/bill/${split.access_token}`}
      target="_blank"
      rel="noopener noreferrer"
      title="View bill breakdown"
      className="text-secondary-400 hover:text-primary-600"
    >
      <ExternalLink className="w-4 h-4" />
    </a>
    <button
      title="Copy tenant link"
      onClick={() => navigator.clipboard.writeText(`${window.location.origin}/bill/${split.access_token}`)}
      className="text-secondary-400 hover:text-primary-600"
    >
      <Copy className="w-4 h-4" />
    </button>
    <button
      title="Revoke this link (rotates the token)"
      onClick={() => onRevoke(split)}
      className="text-secondary-400 hover:text-danger-600"
    >
      <ShieldOff className="w-4 h-4" />
    </button>
    {split.status === 'paid' ? (
      <button
        title="Reset to pending"
        onClick={() => onSetStatus(split.id, 'pending')}
        className="text-secondary-400 hover:text-secondary-700"
      >
        <RotateCcw className="w-4 h-4" />
      </button>
    ) : (
      <button
        title="Mark as paid"
        onClick={() => onSetStatus(split.id, 'paid')}
        className="text-secondary-400 hover:text-success-600"
      >
        <CheckCircle2 className="w-4 h-4" />
      </button>
    )}
    <button
      title={split.email_sent_at ? `Sent ${new Date(split.email_sent_at).toLocaleString()} — click to resend` : 'Send bill email'}
      onClick={() => onSendEmail(split)}
      disabled={sendingSplitId === split.id}
      className={`inline-flex items-center space-x-1 text-xs px-2 py-1 rounded ${
        split.email_sent_at ? 'text-success-700 hover:bg-success-50' : 'text-primary-600 hover:bg-primary-50'
      } disabled:opacity-50`}
    >
      {split.email_sent_at ? <MailCheck className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
      <span>{sendingSplitId === split.id ? 'Sending...' : split.email_sent_at ? 'Sent' : 'Send'}</span>
    </button>
  </div>
);

export default SplitActions;
