import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CalendarClock, Inbox, Wallet } from 'lucide-react';
import { useProperties } from '../contexts/PropertyContext';
import { statusStyle, statusLabel } from '../lib/paymentStatus';
import Money from '../components/Money';

// "Inbox zero for property money" — a returning landlord sees what needs
// attention, not a marketing hero. Everything here is derived from data
// PropertyContext already loads account-wide; no new Supabase calls.
const Dashboard = () => {
  const { properties, bills, billSplits, loading, error, refresh } = useProperties();

  const propertyById = (propertyId) => properties.find((p) => p.id === propertyId);

  const outstandingSplits = billSplits.filter((s) => s.status !== 'paid');
  const today = new Date().toISOString().slice(0, 10);

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

  const workQueue = outstandingWithBill
    .sort((a, b) => {
      const aOverdue = a.bill.due_date && a.bill.due_date < today;
      const bOverdue = b.bill.due_date && b.bill.due_date < today;
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      return (a.bill.due_date || '9999-99-99').localeCompare(b.bill.due_date || '9999-99-99');
    })
    .slice(0, 20);

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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="card text-center py-16">
          <Inbox className="w-12 h-12 text-secondary-300 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-secondary-900 mb-2">Add your first property to get started</h1>
          <p className="text-secondary-600 mb-6">Once you add a property and tenants, bills you issue will show up here.</p>
          <Link to="/properties" className="btn-primary inline-flex">
            Add a property
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-secondary-900 mb-8">Work queue</h1>

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

      {workQueue.length === 0 ? (
        <div className="card text-center py-16">
          <Inbox className="w-12 h-12 text-secondary-300 mx-auto mb-4" />
          <p className="text-secondary-600">All caught up — nothing outstanding right now.</p>
        </div>
      ) : (
        <div className="card divide-y divide-secondary-100 p-0 overflow-hidden">
          {workQueue.map(({ split, bill }) => {
            const property = propertyById(bill.property_id);
            const isOverdue = bill.due_date && bill.due_date < today;
            return (
              <Link
                key={split.id}
                to={`/properties/${bill.property_id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-secondary-50 transition-colors duration-150"
              >
                <div>
                  <p className="font-medium text-secondary-900">
                    {property?.name || 'Property'} &middot; {split.tenant_name}
                  </p>
                  <p className="text-sm text-secondary-500 capitalize">
                    {bill.bill_type} bill{bill.due_date && <> &middot; {isOverdue ? 'was due' : 'due'} {bill.due_date}</>}
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <Money dollars={split.owed_amount} className="text-secondary-900" />
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle(split.status)}`}>
                    {statusLabel(split.status)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
