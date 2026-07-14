import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Receipt, Users } from 'lucide-react';
import { useProperties } from '../contexts/PropertyContext';

const emptyTenant = { name: '', email: '', phone: '', room: '', moveInDate: '', numberOfOccupants: 1 };
const emptyBill = { billType: 'utilities', totalAmount: '', periodStart: '', periodEnd: '' };

const PropertyDetail = () => {
  const { propertyId } = useParams();
  const { properties, tenants, bills, billSplits, createTenant, deleteTenant, createBillWithSplits, deleteBill } =
    useProperties();

  const property = properties.find((p) => p.id === propertyId);
  const propertyTenants = tenants.filter((t) => t.property_id === propertyId);
  const propertyBills = bills.filter((b) =>
    billSplits.some((s) => s.bill_id === b.id && propertyTenants.some((t) => t.id === s.tenant_id))
  );

  const [showTenantForm, setShowTenantForm] = useState(false);
  const [tenantForm, setTenantForm] = useState(emptyTenant);
  const [tenantError, setTenantError] = useState('');
  const [tenantSubmitting, setTenantSubmitting] = useState(false);

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

  const handleTenantSubmit = async (e) => {
    e.preventDefault();
    if (!tenantForm.name.trim() || !tenantForm.room.trim() || !tenantForm.moveInDate) {
      setTenantError('Name, room, and move-in date are required');
      return;
    }
    setTenantSubmitting(true);
    setTenantError('');
    try {
      await createTenant({ propertyId, ...tenantForm });
      setTenantForm(emptyTenant);
      setShowTenantForm(false);
    } catch (err) {
      console.error('Failed to add tenant:', err);
      setTenantError(err.message || 'Failed to add tenant');
    } finally {
      setTenantSubmitting(false);
    }
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
          <button onClick={() => setShowTenantForm((s) => !s)} className="btn-secondary flex items-center space-x-2">
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
                {tenantSubmitting ? 'Adding...' : 'Add Tenant'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowTenantForm(false)}>
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
                <button
                  onClick={() => deleteTenant(tenant.id)}
                  className="text-secondary-300 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
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
                        <th className="py-1">Person-days</th>
                        <th className="py-1">%</th>
                        <th className="py-1 text-right">Owed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {splits.map((split) => (
                        <tr key={split.id} className="border-b border-secondary-100 last:border-0">
                          <td className="py-1">{split.tenant_name}</td>
                          <td className="py-1">{split.room}</td>
                          <td className="py-1">{split.person_days}</td>
                          <td className="py-1">{split.percentage}%</td>
                          <td className="py-1 text-right font-medium">${Number(split.owed_amount).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
