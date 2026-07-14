import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Receipt, Users, Copy, RotateCcw, CheckCircle2, Mail, MailCheck, Pencil } from 'lucide-react';
import { useProperties } from '../contexts/PropertyContext';

const emptyTenant = { name: '', email: '', phone: '', room: '', moveInDate: '', numberOfOccupants: 1 };
const emptyBill = { billType: 'utilities', totalAmount: '', periodStart: '', periodEnd: '', dueDate: '' };

const STATUS_STYLES = {
  pending: 'bg-secondary-100 text-secondary-600',
  viewed: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
};

const PropertyDetail = () => {
  const { propertyId } = useParams();
  const {
    properties,
    tenants,
    bills,
    billSplits,
    createTenant,
    updateTenant,
    deleteTenant,
    createBillWithSplits,
    deleteBill,
    setBillSplitStatus,
    sendBillEmail,
  } = useProperties();

  const [sendingSplitId, setSendingSplitId] = useState(null);
  const [emailError, setEmailError] = useState('');

  const tenantById = (tenantId) => tenants.find((t) => t.id === tenantId);

  const handleSendEmail = async (split) => {
    const tenant = tenantById(split.tenant_id);
    if (!tenant?.email) {
      setEmailError(`${split.tenant_name} has no email on file. Add one to their tenant record first.`);
      return;
    }
    setEmailError('');
    setSendingSplitId(split.id);
    try {
      await sendBillEmail(split.id);
    } catch (err) {
      console.error('Failed to send bill email:', err);
      setEmailError(err.message || 'Failed to send email');
    } finally {
      setSendingSplitId(null);
    }
  };

  const property = properties.find((p) => p.id === propertyId);
  const propertyTenants = tenants.filter((t) => t.property_id === propertyId);
  const propertyBills = bills.filter((b) =>
    billSplits.some((s) => s.bill_id === b.id && propertyTenants.some((t) => t.id === s.tenant_id))
  );

  const [showTenantForm, setShowTenantForm] = useState(false);
  const [tenantForm, setTenantForm] = useState(emptyTenant);
  const [tenantError, setTenantError] = useState('');
  const [tenantSubmitting, setTenantSubmitting] = useState(false);
  const [editingTenantId, setEditingTenantId] = useState(null);

  const [showBillForm, setShowBillForm] = useState(false);
  const [billForm, setBillForm] = useState(emptyBill);
  const [billError, setBillError] = useState('');
  const [billSubmitting, setBillSubmitting] = useState(false);

  if (!property) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-secondary-600 mb-4">Property not found.</p>
        <Link to="/properties" className="text-primary-600 hover:text-primary-700">
          Back to properties
        </Link>
      </div>
    );
  }

  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleTenantSubmit = async (e) => {
    e.preventDefault();
    if (!tenantForm.name.trim() || !tenantForm.room.trim() || !tenantForm.moveInDate) {
      setTenantError('Name, room, and move-in date are required');
      return;
    }
    if (tenantForm.email.trim() && !EMAIL_PATTERN.test(tenantForm.email.trim())) {
      setTenantError('That email address doesn\'t look valid');
      return;
    }
    setTenantSubmitting(true);
    setTenantError('');
    try {
      if (editingTenantId) {
        await updateTenant(editingTenantId, {
          name: tenantForm.name.trim(),
          email: tenantForm.email.trim() || null,
          phone: tenantForm.phone.trim() || null,
          room: tenantForm.room.trim(),
          move_in_date: tenantForm.moveInDate,
          number_of_occupants: tenantForm.numberOfOccupants,
        });
      } else {
        await createTenant({ propertyId, ...tenantForm });
      }
      setTenantForm(emptyTenant);
      setEditingTenantId(null);
      setShowTenantForm(false);
    } catch (err) {
      console.error('Failed to save tenant:', err);
      setTenantError(err.message || 'Failed to save tenant');
    } finally {
      setTenantSubmitting(false);
    }
  };

  const handleEditTenant = (tenant) => {
    setTenantForm({
      name: tenant.name,
      email: tenant.email || '',
      phone: tenant.phone || '',
      room: tenant.room,
      moveInDate: tenant.move_in_date,
      numberOfOccupants: tenant.number_of_occupants,
    });
    setEditingTenantId(tenant.id);
    setTenantError('');
    setShowTenantForm(true);
  };

  const handleCancelTenantForm = () => {
    setShowTenantForm(false);
    setEditingTenantId(null);
    setTenantForm(emptyTenant);
    setTenantError('');
  };

  const handleBillSubmit = async (e) => {
    e.preventDefault();
    if (!billForm.totalAmount || !billForm.periodStart || !billForm.periodEnd) {
      setBillError('Amount and billing period are required');
      return;
    }
    setBillSubmitting(true);
    setBillError('');
    try {
      await createBillWithSplits({
        propertyId,
        billType: billForm.billType,
        totalAmount: parseFloat(billForm.totalAmount),
        periodStart: billForm.periodStart,
        periodEnd: billForm.periodEnd,
        dueDate: billForm.dueDate || null,
      });
      setBillForm(emptyBill);
      setShowBillForm(false);
    } catch (err) {
      console.error('Failed to create bill:', err);
      setBillError(err.message || 'Failed to create bill');
    } finally {
      setBillSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Link to="/properties" className="inline-flex items-center text-secondary-600 hover:text-secondary-900 mb-6">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to properties
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-secondary-900">{property.name}</h1>
        <p className="text-secondary-600">{property.address}</p>
        {property.description && <p className="text-secondary-500 text-sm mt-1">{property.description}</p>}
      </div>

      {/* Tenants */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-secondary-900 flex items-center">
            <Users className="w-5 h-5 mr-2" /> Tenants
          </h2>
          <button
            onClick={() => {
              if (showTenantForm) {
                handleCancelTenantForm();
              } else {
                setEditingTenantId(null);
                setTenantForm(emptyTenant);
                setShowTenantForm(true);
              }
            }}
            className="btn-secondary flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Tenant</span>
          </button>
        </div>

        {showTenantForm && (
          <form onSubmit={handleTenantSubmit} className="card mb-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                className="input-field"
                placeholder="Name"
                value={tenantForm.name}
                onChange={(e) => setTenantForm((p) => ({ ...p, name: e.target.value }))}
              />
              <input
                className="input-field"
                placeholder="Room"
                value={tenantForm.room}
                onChange={(e) => setTenantForm((p) => ({ ...p, room: e.target.value }))}
              />
              <input
                type="number"
                min="1"
                className="input-field"
                placeholder="Occupants"
                value={tenantForm.numberOfOccupants}
                onChange={(e) => setTenantForm((p) => ({ ...p, numberOfOccupants: parseInt(e.target.value, 10) || 1 }))}
              />
              <input
                type="email"
                className="input-field"
                placeholder="Email (optional)"
                value={tenantForm.email}
                onChange={(e) => setTenantForm((p) => ({ ...p, email: e.target.value }))}
              />
              <input
                className="input-field"
                placeholder="Phone (optional)"
                value={tenantForm.phone}
                onChange={(e) => setTenantForm((p) => ({ ...p, phone: e.target.value }))}
              />
              <input
                type="date"
                className="input-field"
                value={tenantForm.moveInDate}
                onChange={(e) => setTenantForm((p) => ({ ...p, moveInDate: e.target.value }))}
              />
            </div>
            {tenantError && <p className="text-red-600 text-sm">{tenantError}</p>}
            <div className="flex space-x-3">
              <button type="submit" disabled={tenantSubmitting} className="btn-primary">
                {tenantSubmitting ? 'Saving...' : editingTenantId ? 'Save Changes' : 'Add Tenant'}
              </button>
              <button type="button" className="btn-secondary" onClick={handleCancelTenantForm}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {propertyTenants.length === 0 ? (
          <p className="text-secondary-500">No tenants yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {propertyTenants.map((tenant) => (
              <div key={tenant.id} className="card flex items-start justify-between">
                <div>
                  <p className="font-semibold text-secondary-900">{tenant.name}</p>
                  <p className="text-sm text-secondary-600">Room: {tenant.room}</p>
                  <p className="text-sm text-secondary-600">Occupants: {tenant.number_of_occupants}</p>
                  <p className="text-sm text-secondary-500">Moved in: {tenant.move_in_date}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleEditTenant(tenant)}
                    className="text-secondary-300 hover:text-primary-600"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteTenant(tenant.id)}
                    className="text-secondary-300 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Bills */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-secondary-900 flex items-center">
            <Receipt className="w-5 h-5 mr-2" /> Bills
          </h2>
          <button
            onClick={() => setShowBillForm((s) => !s)}
            disabled={propertyTenants.length === 0}
            className="btn-secondary flex items-center space-x-2 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Add Bill</span>
          </button>
        </div>

        {showBillForm && (
          <form onSubmit={handleBillSubmit} className="card mb-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <select
                className="input-field"
                value={billForm.billType}
                onChange={(e) => setBillForm((p) => ({ ...p, billType: e.target.value }))}
              >
                <option value="utilities">Utilities</option>
                <option value="rent">Rent</option>
                <option value="internet">Internet</option>
                <option value="other">Other</option>
              </select>
              <input
                type="number"
                step="0.01"
                className="input-field"
                placeholder="Total amount"
                value={billForm.totalAmount}
                onChange={(e) => setBillForm((p) => ({ ...p, totalAmount: e.target.value }))}
              />
              <input
                type="date"
                className="input-field"
                value={billForm.periodStart}
                onChange={(e) => setBillForm((p) => ({ ...p, periodStart: e.target.value }))}
              />
              <input
                type="date"
                className="input-field"
                value={billForm.periodEnd}
                onChange={(e) => setBillForm((p) => ({ ...p, periodEnd: e.target.value }))}
              />
              <div>
                <label className="block text-xs text-secondary-500 mb-1">Due date (optional)</label>
                <input
                  type="date"
                  className="input-field"
                  value={billForm.dueDate}
                  onChange={(e) => setBillForm((p) => ({ ...p, dueDate: e.target.value }))}
                />
              </div>
            </div>
            {billError && <p className="text-red-600 text-sm">{billError}</p>}
            <div className="flex space-x-3">
              <button type="submit" disabled={billSubmitting} className="btn-primary">
                {billSubmitting ? 'Calculating split...' : 'Create Bill & Split'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowBillForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {propertyBills.length === 0 ? (
          <p className="text-secondary-500">No bills yet.</p>
        ) : (
          <div className="space-y-4">
            {propertyBills.map((bill) => {
              const splits = billSplits.filter((s) => s.bill_id === bill.id);
              return (
                <div key={bill.id} className="card">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-secondary-900 capitalize">
                        {bill.bill_type} &mdash; ${Number(bill.total_amount).toFixed(2)}
                      </p>
                      <p className="text-sm text-secondary-500">
                        {bill.billing_period_start} to {bill.billing_period_end}
                        {bill.due_date && <> &middot; Due {bill.due_date}</>}
                      </p>
                    </div>
                    <button onClick={() => deleteBill(bill.id)} className="text-secondary-300 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-secondary-500 border-b border-secondary-200">
                        <th className="py-1">Tenant</th>
                        <th className="py-1">Room</th>
                        <th className="py-1">%</th>
                        <th className="py-1 text-right">Owed</th>
                        <th className="py-1 text-center">Status</th>
                        <th className="py-1 text-right">Link</th>
                        <th className="py-1 text-right">Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {splits.map((split) => (
                        <tr key={split.id} className="border-b border-secondary-100 last:border-0">
                          <td className="py-1">{split.tenant_name}</td>
                          <td className="py-1">{split.room}</td>
                          <td className="py-1">{split.percentage}%</td>
                          <td className="py-1 text-right font-medium">${Number(split.owed_amount).toFixed(2)}</td>
                          <td className="py-1 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                                STATUS_STYLES[split.status] || STATUS_STYLES.pending
                              }`}
                            >
                              {split.status || 'pending'}
                            </span>
                          </td>
                          <td className="py-1 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                title="Copy tenant link"
                                onClick={() =>
                                  navigator.clipboard.writeText(`${window.location.origin}/bill/${split.access_token}`)
                                }
                                className="text-secondary-400 hover:text-primary-600"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              {split.status === 'paid' ? (
                                <button
                                  title="Reset to pending"
                                  onClick={() => setBillSplitStatus(split.id, 'pending')}
                                  className="text-secondary-400 hover:text-secondary-700"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  title="Mark as paid"
                                  onClick={() => setBillSplitStatus(split.id, 'paid')}
                                  className="text-secondary-400 hover:text-green-600"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-1 text-right">
                            <button
                              title={split.email_sent_at ? `Sent ${new Date(split.email_sent_at).toLocaleString()} — click to resend` : 'Send bill email'}
                              onClick={() => handleSendEmail(split)}
                              disabled={sendingSplitId === split.id}
                              className={`inline-flex items-center space-x-1 text-xs px-2 py-1 rounded ${
                                split.email_sent_at
                                  ? 'text-green-700 hover:bg-green-50'
                                  : 'text-primary-600 hover:bg-primary-50'
                              } disabled:opacity-50`}
                            >
                              {split.email_sent_at ? <MailCheck className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                              <span>{sendingSplitId === split.id ? 'Sending...' : split.email_sent_at ? 'Sent' : 'Send'}</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {emailError && <p className="text-red-600 text-xs mt-3">{emailError}</p>}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default PropertyDetail;
