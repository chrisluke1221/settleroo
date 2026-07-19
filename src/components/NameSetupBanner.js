import React, { useState } from 'react';
import { User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// Google sign-in supplies a name automatically; magic-link sign-in doesn't,
// so a magic-link landlord would otherwise see their own email standing in
// for their name everywhere (Header, future tenant-facing "from" lines)
// forever. Shows once, at the top of the dashboard, until user_metadata.full_name
// is set — then it's gone for good since the condition no longer holds.
const NameSetupBanner = () => {
  const { user, updateName } = useAuth();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (user?.user_metadata?.full_name) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError('');
    try {
      await updateName(trimmed);
    } catch (err) {
      setError(err.message || 'Failed to save your name');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card mb-6 flex items-center space-x-4">
      <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
        <User className="w-5 h-5 text-primary-600" />
      </div>
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-secondary-900">What should we call you?</p>
          <p className="text-xs text-secondary-500">Shown instead of your email in the header — takes a second.</p>
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={100}
          className="input-field sm:w-56"
        />
        <button type="submit" disabled={saving || !name.trim()} className="btn-primary whitespace-nowrap">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </form>
      {error && <p className="text-danger-600 text-xs">{error}</p>}
    </div>
  );
};

export default NameSetupBanner;
