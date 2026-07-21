import React, { useState } from 'react';
import { ExternalLink, Copy, ShieldOff, CheckCircle2, RotateCcw, Mail, MailCheck } from 'lucide-react';

// Fast, CSS-only tooltip — replaces the native title= attribute, whose
// browser-default hover delay (~1-1.5s+) reads as sluggish on icon-only
// buttons. group-hover + a short delay/duration keeps it snappy.
const Tip = ({ label, children }) => (
  <span className="relative inline-flex group">
    {children}
    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded bg-secondary-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity duration-100 delay-100 group-hover:opacity-100 z-10">
      {label}
    </span>
  </span>
);

// Shared by the desktop splits table and the mobile stacked-card layout so
// the five per-split actions aren't duplicated in two places.
const SplitActions = ({ split, sendingSplitId, onRevoke, onSetStatus, onSendEmail }) => {
  const [revoking, setRevoking] = useState(false);
  const [revokeFeedback, setRevokeFeedback] = useState(null); // 'success' | 'error' | null
  const [statusPending, setStatusPending] = useState(false);

  const handleRevokeClick = async () => {
    setRevoking(true);
    setRevokeFeedback(null);
    try {
      const didRevoke = await onRevoke(split);
      if (didRevoke !== false) {
        setRevokeFeedback('success');
        setTimeout(() => setRevokeFeedback(null), 2500);
      }
    } catch (err) {
      console.error('Failed to revoke link:', err);
      setRevokeFeedback('error');
      setTimeout(() => setRevokeFeedback(null), 3500);
    } finally {
      setRevoking(false);
    }
  };

  const handleStatusClick = async (nextStatus) => {
    setStatusPending(true);
    try {
      await onSetStatus(split.id, nextStatus);
    } catch (err) {
      console.error('Failed to update bill status:', err);
    } finally {
      setStatusPending(false);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <Tip label="View bill breakdown">
        <a
          href={`/bill/${split.access_token}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-secondary-400 hover:text-primary-600"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </Tip>
      <Tip label="Copy tenant link">
        <button
          onClick={() => navigator.clipboard.writeText(`${window.location.origin}/bill/${split.access_token}`)}
          className="text-secondary-400 hover:text-primary-600"
        >
          <Copy className="w-4 h-4" />
        </button>
      </Tip>
      <Tip label="Revoke this link (rotates the token)">
        <button
          onClick={handleRevokeClick}
          disabled={revoking}
          className="text-secondary-400 hover:text-danger-600 disabled:opacity-50"
        >
          <ShieldOff className="w-4 h-4" />
        </button>
      </Tip>
      {revokeFeedback === 'success' && (
        <span className="text-xs text-success-700 whitespace-nowrap">Link revoked</span>
      )}
      {revokeFeedback === 'error' && (
        <span className="text-xs text-danger-600 whitespace-nowrap">Couldn't revoke link</span>
      )}
      {split.status === 'paid' ? (
        <Tip label="Reset to pending">
          <button
            onClick={() => handleStatusClick('pending')}
            disabled={statusPending}
            className="text-secondary-400 hover:text-secondary-700 disabled:opacity-50"
          >
            <RotateCcw className={`w-4 h-4 ${statusPending ? 'animate-spin' : ''}`} />
          </button>
        </Tip>
      ) : (
        <Tip label="Mark as paid">
          <button
            onClick={() => handleStatusClick('paid')}
            disabled={statusPending}
            className="text-secondary-400 hover:text-success-600 disabled:opacity-50"
          >
            <CheckCircle2 className={`w-4 h-4 ${statusPending ? 'animate-pulse' : ''}`} />
          </button>
        </Tip>
      )}
      <Tip label={split.email_sent_at ? `Sent ${new Date(split.email_sent_at).toLocaleString()} — click to resend` : 'Send bill email'}>
        <button
          onClick={() => onSendEmail(split)}
          disabled={sendingSplitId === split.id}
          className={`inline-flex items-center space-x-1 text-xs px-2 py-1 rounded ${
            split.email_sent_at ? 'text-success-700 hover:bg-success-50' : 'text-primary-600 hover:bg-primary-50'
          } disabled:opacity-50`}
        >
          {split.email_sent_at ? <MailCheck className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
          <span>{sendingSplitId === split.id ? 'Sending...' : split.email_sent_at ? 'Sent' : 'Send'}</span>
        </button>
      </Tip>
    </div>
  );
};

export default SplitActions;
