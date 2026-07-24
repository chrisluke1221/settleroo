import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, CalendarClock, Inbox, Wallet, Bell } from 'lucide-react';
import { useProperties } from '../contexts/PropertyContext';
import { effectiveStatus } from '../lib/paymentStatus';
import { todayLocal } from '../lib/dates';
import Money from '../components/Money';
import StatusBadge from '../components/StatusBadge';
import SplitActions from '../components/SplitActions';
import NameSetupBanner from '../components/NameSetupBanner';

// "Inbox zero for property money" — a returning landlord sees what needs
// attention, not a marketing hero. Everything here is derived from data
// PropertyContext already loads account-wide; no new Supabase calls.
// Rows are atomic (one charge each) with inline actions — clicking Mark
// Paid or Send acts right here, it doesn't send you off to the property
// page just to do it.
const Dashboard = () => {
  const {
    properties,
    tenants,
    bills,
    billSplits,
    landlordSettings,
    setNotifyOverdue,
    setNotifyRent,
    loadSampleProperty,
    setBillSplitStatus,
    sendBillEmail,
    revokeSplitToken,
    loading,
    error,
    refresh,
  } = useProperties();
  const [savingNotify, setSavingNotify] = useState(false);
  const [savingRentNotify, setSavingRentNotify] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [sampleError, setSampleError] = useState('');
  const [sendingSplitId, setSendingSplitId] = useState(null);
  const [actionError, setActionError] = useState('');
  const [filterPropertyId, setFilterPropertyId] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const navigate = useNavigate();

  const handleToggleNotify = async () => {
    setSavingNotify(true);
    try {
      await setNotifyOverdue(!landlordSettings.notify_overdue);
    } catch (err) {
      console.error('Failed to update reminder setting:', err);
    } finally {
      setSavingNotify(false);
    }
  };

  const handleToggleRentNotify = async () => {
    setSavingRentNotify(true);
    try {
      await setNotifyRent(!landlordSettings.notify_rent);
    } catch (err) {
      console.error('Failed to update rent notification setting:', err);
    } finally {
      setSavingRentNotify(false);
    }
  };

  const handleLoadSample = async () => {
    setLoadingSample(true);
    setSampleError('');
    try {
      const property = await loadSampleProperty();
      navigate(`/properties/${property.id}`);
    } catch (err) {
      console.error('Failed to load sample property:', err);
      setSampleError(err.message || 'Failed to load sample property');
    } finally {
      setLoadingSample(false);
    }
  };

  const handleRevokeLink = async (split) => {
    if (!window.confirm(`Revoke ${split.tenant_name}'s current bill link? The old link will stop working immediately.`)) return false;
    await revokeSplitToken(split.id);
    return true;
  };

  const handleSendEmail = async (split) => {
    const tenant = tenants.find((t) => t.id === split.tenant_id);
    if (!tenant?.email) {
      setActionError(`${split.tenant_name} has no email on file. Add one on their tenant record.`);
      return;
    }
    setActionError('');
    setSendingSplitId(split.id);
    try {
      await sendBillEmail(split.id);
    } catch (err) {
      console.error('Failed to send bill email:', err);
      setActionError(err.message || 'Failed to send email');
    } finally {
      setSendingSplitId(null);
    }
  };

  const propertyById = (propertyId) => properties.find((p) => p.id === propertyId);

  const outstandingSplits = billSplits.filter((s) => s.status !== 'paid');
  const today = todayLocal();

  const billById = new Map(bills.map((b) => [b.id, b]));
  const outstandingWithBill = outstandingSplits
    .map((split) => ({ split, bill: billById.get(split.bill_id) }))
    .filter((row) => row.bill);

  const totalOutstandingCents = outstandingWithBill.reduce(
    (sum, { split }) => sum + Math.round(Number(split.owed_amount) * 100),
    0
  );
  const overdueCount = outstandingWithBill.filter(({ bill }) => bill.due_date && bill.due_date < today).length;
  const nextDueDate = outstandingWithBill
    .map(({ bill }) => bill.due_date)
    .filter((d) => d && d >= today)
    .sort()[0];

  const filteredWithBill = outstandingWithBill.filter(({ bill }) => {
    if (filterPropertyId !== 'all' && bill.property_id !== filterPropertyId) return false;
    if (filterType === 'rent' && bill.bill_type !== 'rent') return false;
    if (filterType === 'utility' && bill.bill_type === 'rent') return false;
    return true;
  });

  const workQueue = filteredWithBill
    .sort((a, b) => {
      const aOverdue = a.bill.due_date && a.bill.due_date < today;
      const bOverdue = b.bill.due_date && b.bill.due_date < today;
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      return (a.bill.due_date || '9999-99-99').localeCompare(b.bill.due_date || '9999-99-99');
    })
    .slice(0, 30);

  // "Who owes me what in total" — grouped by tenant across every bill
  // (rent + utilities), not just the one in front of you. Follows the same
  // property/type filters as the queue below.
  const balanceByTenant = new Map();
  filteredWithBill.forEach(({ split, bill }) => {
    const key = split.tenant_id;
    const cents = Math.round(Number(split.owed_amount) * 100);
    const existing = balanceByTenant.get(key);
    if (existing) {
      existing.cents += cents;
    } else {
      balanceByTenant.set(key, {
        tenantName: split.tenant_name,
        propertyId: bill.property_id,
        propertyName: propertyById(bill.property_id)?.name,
        cents,
      });
    }
  });
  const tenantBalances = Array.from(balanceByTenant.values()).sort((a, b) => b.cents - a.cents);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <p className="text-secondary-600">Loading your work queue...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="card text-center py-12">
          <AlertCircle className="w-10 h-10 text-danger-600 mx-auto mb-3" />
          <p className="text-secondary-700 mb-4">Couldn't load your dashboard: {error}</p>
          <button onClick={refresh} className="btn-secondary">
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Empty state: show the product walkthrough so new landlords know
            exactly what to expect before they add their first property.
            Reduces time-to-first-value by setting clear expectations. */}
        <div className="text-center mb-8">
          <Inbox className="w-12 h-12 text-secondary-300 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-secondary-900 mb-2">Add your first property to get started</h1>
          <p className="text-secondary-600 mb-6">Once you add a property and tenants, bills you issue will show up here.</p>
          <div className="flex items-center justify-center space-x-3">
            <Link to="/properties?new=1" className="btn-primary inline-flex">
              Add a property
            </Link>
            <button onClick={handleLoadSample} disabled={loadingSample} className="btn-secondary inline-flex disabled:opacity-50">
              {loadingSample ? 'Loading...' : 'See it with sample data'}
            </button>
          </div>
          {sampleError && <p className="text-danger-600 text-sm mt-3">{sampleError}</p>}
        </div>

        {/* Product walkthrough — shows new landlords the full workflow
            before they commit to adding their first property */}
        <div className="card p-6">
          <p className="text-sm font-semibold text-secondary-500 uppercase tracking-wide mb-3 text-center">See how it works</p>
          <div
            className="relative w-full overflow-hidden rounded-lg"
            style={{ paddingBottom: '56.25%' }}
          >
            <iframe
              className="absolute inset-0 w-full h-full"
              src="https://www.youtube-nocookie.com/embed/ZndZOKyCQws?rel=0&modestbranding=1"
              title="Settleroo product walkthrough"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <NameSetupBanner />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
        <h1 className="text-3xl font-bold text-secondary-900">Work queue</h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
          <button
            onClick={handleToggleRentNotify}
            disabled={savingRentNotify}
            className="flex items-center space-x-2 text-sm text-secondary-500 hover:text-secondary-900 disabled:opacity-50"
            title="Email tenants automatically when a new rent bill is generated"
          >
            <Bell className="w-4 h-4" />
            <span>Rent emails: {landlordSettings.notify_rent ? 'On' : 'Off'}</span>
          </button>
          <button
            onClick={handleToggleNotify}
            disabled={savingNotify}
            className="flex items-center space-x-2 text-sm text-secondary-500 hover:text-secondary-900 disabled:opacity-50"
            title="Email tenants automatically when their bill goes overdue"
          >
            <Bell className="w-4 h-4" />
            <span>Overdue reminders: {landlordSettings.notify_overdue ? 'On' : 'Off'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="card flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
            <Wallet className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <p className="text-xs text-secondary-500 uppercase tracking-wide">Outstanding</p>
            <Money cents={totalOutstandingCents} className="text-xl text-secondary-900" />
          </div>
        </div>
        <div className="card flex items-center space-x-3">
          <div className="w-10 h-10 bg-danger-100 rounded-lg flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-danger-600" />
          </div>
          <div>
            <p className="text-xs text-secondary-500 uppercase tracking-wide">Overdue</p>
            <p className="text-xl font-semibold text-secondary-900 tabular-nums">{overdueCount}</p>
          </div>
        </div>
        <div className="card flex items-center space-x-3">
          <div className="w-10 h-10 bg-secondary-100 rounded-lg flex items-center justify-center">
            <CalendarClock className="w-5 h-5 text-secondary-600" />
          </div>
          <div>
            <p className="text-xs text-secondary-500 uppercase tracking-wide">Next due</p>
            <p className="text-xl font-semibold text-secondary-900">{nextDueDate || '—'}</p>
          </div>
        </div>
      </div>

      {tenantBalances.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-secondary-500 uppercase tracking-wide mb-3">Who owes you</h2>
          <div className="card divide-y divide-secondary-100 p-0 overflow-hidden">
            {tenantBalances.slice(0, 10).map((row) => (
              <Link
                key={`${row.propertyId}-${row.tenantName}`}
                to={`/properties/${row.propertyId}`}
                className="flex items-center justify-between px-6 py-3 hover:bg-secondary-50 transition-colors duration-150"
              >
                <p className="font-medium text-secondary-900">
                  {row.tenantName} <span className="text-secondary-400 font-normal">&middot; {row.propertyName}</span>
                </p>
                <Money cents={row.cents} className="text-secondary-900" />
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-secondary-500 uppercase tracking-wide">Needs attention</h2>
        <div className="flex items-center space-x-2">
          <select
            className="input-field text-sm py-1.5"
            value={filterPropertyId}
            onChange={(e) => setFilterPropertyId(e.target.value)}
          >
            <option value="all">All properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            className="input-field text-sm py-1.5"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">Rent &amp; utilities</option>
            <option value="rent">Rent only</option>
            <option value="utility">Utilities only</option>
          </select>
        </div>
      </div>

      {actionError && <p className="text-danger-600 text-sm mb-3">{actionError}</p>}

      {workQueue.length === 0 ? (
        <div className="card text-center py-16">
          <Inbox className="w-12 h-12 text-secondary-300 mx-auto mb-4" />
          <p className="text-secondary-600">
            {filterPropertyId !== 'all' || filterType !== 'all'
              ? 'Nothing outstanding matches this filter.'
              : 'All caught up — nothing outstanding right now.'}
          </p>
        </div>
      ) : (
        <div className="card divide-y divide-secondary-100 p-0 overflow-hidden">
          {workQueue.map(({ split, bill }) => {
            const property = propertyById(bill.property_id);
            const isOverdue = bill.due_date && bill.due_date < today;
            return (
              <div
                key={split.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4"
              >
                <div>
                  <Link
                    to={`/properties/${bill.property_id}`}
                    className="font-medium text-secondary-900 hover:text-primary-600"
                  >
                    {property?.name || 'Property'} &middot; {split.tenant_name}
                  </Link>
                  <p className="text-sm text-secondary-500 capitalize">
                    {bill.bill_type} bill{bill.due_date && <> &middot; {isOverdue ? 'was due' : 'due'} {bill.due_date}</>}
                  </p>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3">
                  <Money dollars={split.owed_amount} className="text-secondary-900" />
                  <StatusBadge status={effectiveStatus(split, bill)} />
                  <SplitActions
                    split={split}
                    sendingSplitId={sendingSplitId}
                    onRevoke={handleRevokeLink}
                    onSetStatus={setBillSplitStatus}
                    onSendEmail={handleSendEmail}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
