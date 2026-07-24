import React, { useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronRight,
  Plus,
  Trash2,
  Users,
  Pencil,
  Paperclip,
  X,
  Archive,
  RefreshCw,
  DollarSign,
  Zap,
  ChevronDown,
  ChevronUp,
  Inbox,
  AlertCircle,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import { useProperties } from '../contexts/PropertyContext';
import Money from '../components/Money';
import StatusBadge from '../components/StatusBadge';
import SplitActions from '../components/SplitActions';
import ConfirmModal from '../components/ConfirmModal';
import { effectiveStatus } from '../lib/paymentStatus';
import { todayLocal } from '../lib/dates';

const emptyTenant = {
  name: '',
  email: '',
  phone: '',
  room: '',
  moveInDate: '',
  moveOutDate: '',
  numberOfOccupants: 1,
  rentAmount: '',
  rentFrequency: 'monthly',
};
// CHR-24: description is required when billType === 'other'
const emptyBill = { billType: 'electricity', totalAmount: '', periodStart: '', periodEnd: '', dueDate: '', description: '' };
const emptyRentBill = { periodStart: '', periodEnd: '', dueDate: '' };
const emptyRate = { amount: '', frequency: 'monthly', effectiveFrom: '' };

const UTILITY_TYPES = [
  { value: 'electricity', label: 'Electricity' },
  { value: 'gas', label: 'Gas' },
  { value: 'water', label: 'Water' },
  { value: 'internet', label: 'Internet' },
  { value: 'other', label: 'Other utility' },
];

const today = todayLocal;

const TABS = [
  { id: 'tenants', label: 'Tenants' },
  { id: 'rent', label: 'Rent' },
  { id: 'utilities', label: 'Utilities' },
];

const PropertyDetail = () => {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Deep-linkable so a link (e.g. from the dashboard) can land directly on a
  // specific tab instead of always opening on Tenants — same ?param pattern
  // Properties.js already uses for its own initial-state flag.
  const [activeTab, setActiveTab] = useState(
    TABS.some((t) => t.id === searchParams.get('tab')) ? searchParams.get('tab') : 'tenants'
  );
  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tabId);
      return next;
    });
  };
  const {
    properties,
    tenants,
    bills,
    billSplits,
    rentRates,
    loading,
    error,
    refresh,
    updateProperty,
    deleteProperty,
    createTenant,
    updateTenant,
    deleteTenant,
    reactivateTenant,
    createBillWithSplits,
    updateBill,
    updateBillDueDate,
    recalculateBill,
    reissueBill,
    deleteBill,
    setBillSplitStatus,
    sendBillEmail,
    revokeSplitToken,
    uploadBillAttachment,
    removeBillAttachment,
    getBillAttachmentSignedUrl,
    addRentRate,
    deleteRentRate,
    createRentBill,
  } = useProperties();

  const [ratesTenantId, setRatesTenantId] = useState(null);
  const [rateForm, setRateForm] = useState(emptyRate);
  const [rateError, setRateError] = useState('');
  const [rateSubmitting, setRateSubmitting] = useState(false);
  const [expandedBreakdownSplitId, setExpandedBreakdownSplitId] = useState(null);

  const [sendingSplitId, setSendingSplitId] = useState(null);
  const [emailError, setEmailError] = useState('');
  const [uploadingBillId, setUploadingBillId] = useState(null);
  const [attachmentError, setAttachmentError] = useState('');
  const [openingAttachmentBillId, setOpeningAttachmentBillId] = useState(null);
  const [recalculatingBillId, setRecalculatingBillId] = useState(null);
  const [recalcError, setRecalcError] = useState('');
  const [confirmState, setConfirmState] = useState(null);
  const [editingDueDateBillId, setEditingDueDateBillId] = useState(null);
  const [dueDateDraft, setDueDateDraft] = useState('');
  const [dueDateSubmitting, setDueDateSubmitting] = useState(false);
  const [dueDateError, setDueDateError] = useState('');

  const ALLOWED_ATTACHMENT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
  const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB

  const handleAttachmentChange = async (billId, e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
      setAttachmentError('Only PNG, JPEG, WebP images or PDF files are allowed.');
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachmentError('File must be under 10MB.');
      return;
    }

    setAttachmentError('');
    setUploadingBillId(billId);
    try {
      await uploadBillAttachment(billId, file);
    } catch (err) {
      console.error('Failed to upload attachment:', err);
      setAttachmentError(err.message || 'Failed to upload attachment');
    } finally {
      setUploadingBillId(null);
    }
  };

  const handleViewAttachment = async (bill) => {
    setAttachmentError('');
    setOpeningAttachmentBillId(bill.id);
    try {
      const url = await getBillAttachmentSignedUrl(bill.attachment_path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Failed to open attachment:', err);
      setAttachmentError(err.message || 'Failed to open attachment');
    } finally {
      setOpeningAttachmentBillId(null);
    }
  };

  const handleRecalculate = async (billId) => {
    setRecalcError('');
    setRecalculatingBillId(billId);
    try {
      await recalculateBill(billId);
    } catch (err) {
      console.error('Failed to recalculate bill:', err);
      setRecalcError(err.message || 'Failed to recalculate bill');
    } finally {
      setRecalculatingBillId(null);
    }
  };

  const handleReissue = async (billId) => {
    setRecalcError('');
    setRecalculatingBillId(billId);
    try {
      await reissueBill(billId);
    } catch (err) {
      console.error('Failed to reissue bill:', err);
      setRecalcError(err.message || 'Failed to reissue bill');
    } finally {
      setRecalculatingBillId(null);
    }
  };

  const tenantById = (tenantId) => tenants.find((t) => t.id === tenantId);

  // The "who owes me what in total" payoff — sums everything unpaid for a
  // tenant across both rent and utility bills, not just the one in front of you.
  const balanceFor = (tenantId) =>
    billSplits
      .filter((s) => s.tenant_id === tenantId && s.status !== 'paid')
      .reduce((sum, s) => sum + Math.round(Number(s.owed_amount) * 100), 0);

  // Most recent split for this tenant — the "show them the math" moment,
  // surfaced as a first-class action instead of buried in a bill's action row.
  const latestSplitFor = (tenantId) =>
    billSplits
      .filter((s) => s.tenant_id === tenantId)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0];

  const currentRateFor = (tenantId) =>
    rentRates.filter((r) => r.tenant_id === tenantId).find((r) => !r.effective_to);

  const rateHistoryFor = (tenantId) =>
    rentRates.filter((r) => r.tenant_id === tenantId).sort((a, b) => b.effective_from.localeCompare(a.effective_from));

  const handleOpenRateForm = (tenantId) => {
    setRatesTenantId(tenantId);
    setRateForm(emptyRate);
    setRateError('');
  };

  const handleRateSubmit = async (e, tenantId) => {
    e.preventDefault();
    const amount = parseFloat(rateForm.amount);
    if (!amount || amount <= 0 || !rateForm.effectiveFrom) {
      setRateError('A positive amount and start date are required');
      return;
    }
    setRateSubmitting(true);
    setRateError('');
    try {
      await addRentRate(tenantId, {
        amountCents: Math.round(amount * 100),
        frequency: rateForm.frequency,
        effectiveFrom: rateForm.effectiveFrom,
      });
      setRatesTenantId(null);
      setRateForm(emptyRate);
    } catch (err) {
      console.error('Failed to save rent rate:', err);
      setRateError(err.message || 'Failed to save rent rate');
    } finally {
      setRateSubmitting(false);
    }
  };

  const handleDeleteRate = (rateId) => {
    setConfirmState({
      title: 'Delete this rent rate?',
      message: 'This removes the rate from the tenant\'s history. This cannot be undone.',
      confirmLabel: 'Delete rate',
      onConfirm: async () => {
        setConfirmState(null);
        try {
          await deleteRentRate(rateId);
        } catch (err) {
          console.error('Failed to delete rent rate:', err);
          window.alert(err.message || 'Failed to delete rent rate');
        }
      },
    });
  };

  const handleRevokeLink = async (split) => {
    if (!window.confirm(`Revoke ${split.tenant_name}'s current bill link? The old link will stop working immediately.`)) return false;
    await revokeSplitToken(split.id);
    return true;
  };

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
  const allPropertyTenants = tenants.filter((t) => t.property_id === propertyId);
  const activeTenants = allPropertyTenants.filter((t) => t.status !== 'former');
  const formerTenants = allPropertyTenants.filter((t) => t.status === 'former');
  const propertyBills = bills.filter((b) => b.property_id === propertyId);
  const rentBills = propertyBills.filter((b) => b.bill_type === 'rent');
  const utilityBills = propertyBills.filter((b) => b.bill_type !== 'rent');

  const [showTenantForm, setShowTenantForm] = useState(false);
  const [tenantForm, setTenantForm] = useState(emptyTenant);
  const [tenantError, setTenantError] = useState('');
  const [tenantSubmitting, setTenantSubmitting] = useState(false);
  const [editingTenantId, setEditingTenantId] = useState(null);

  const [showBillForm, setShowBillForm] = useState(false);
  const [billForm, setBillForm] = useState(emptyBill);
  const [billError, setBillError] = useState('');
  const [billSubmitting, setBillSubmitting] = useState(false);
  const [editingBillId, setEditingBillId] = useState(null);

  const [showRentBillForm, setShowRentBillForm] = useState(false);
  const [rentBillForm, setRentBillForm] = useState(emptyRentBill);
  const [rentBillError, setRentBillError] = useState('');
  const [rentBillSubmitting, setRentBillSubmitting] = useState(false);
  const [rentBillYearFilter, setRentBillYearFilter] = useState('all');
  const [showOlderRentBills, setShowOlderRentBills] = useState(false);

  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [propertyForm, setPropertyForm] = useState({ name: '', address: '', description: '' });
  const [propertyError, setPropertyError] = useState('');
  const [propertySubmitting, setPropertySubmitting] = useState(false);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-secondary-600">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-10 h-10 text-danger-600 mx-auto mb-3" />
        <p className="text-secondary-700 mb-4">Couldn't load this property: {error}</p>
        <button onClick={refresh} className="btn-secondary">
          Try again
        </button>
      </div>
    );
  }

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
    if (tenantForm.moveOutDate && tenantForm.moveOutDate < tenantForm.moveInDate) {
      setTenantError('Move-out date must be on or after the move-in date');
      return;
    }
    if (tenantForm.email.trim() && !EMAIL_PATTERN.test(tenantForm.email.trim())) {
      setTenantError('That email address doesn\'t look valid');
      return;
    }
    const rentAmount = parseFloat(tenantForm.rentAmount);
    if (tenantForm.rentAmount && (!rentAmount || rentAmount <= 0)) {
      setTenantError('Rent must be a positive amount, or left blank to set later');
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
          move_out_date: tenantForm.moveOutDate || null,
          number_of_occupants: tenantForm.numberOfOccupants,
        });
      } else {
        await createTenant({
          propertyId,
          ...tenantForm,
          rentAmountCents: rentAmount ? Math.round(rentAmount * 100) : null,
        });
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
      moveOutDate: tenant.move_out_date || '',
      numberOfOccupants: tenant.number_of_occupants,
      rentAmount: '',
      rentFrequency: 'monthly',
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

  const handleDeleteTenant = (tenant) => {
    const hasHistory = billSplits.some((s) => s.tenant_id === tenant.id);
    setConfirmState({
      title: hasHistory ? `Archive ${tenant.name}?` : `Delete ${tenant.name}?`,
      message: hasHistory
        ? `${tenant.name} has bill history, so they'll be archived (marked former) instead of deleted, to keep past bills intact.`
        : `${tenant.name} has no bill history yet, so this permanently deletes their record. This cannot be undone.`,
      confirmLabel: hasHistory ? 'Archive' : 'Delete',
      onConfirm: async () => {
        setConfirmState(null);
        try {
          await deleteTenant(tenant.id);
        } catch (err) {
          console.error('Failed to remove tenant:', err);
        }
      },
    });
  };

  const handleDeleteProperty = () => {
    const tenantCount = tenants.filter((t) => t.property_id === propertyId).length;
    const billCount = bills.filter((b) => b.property_id === propertyId).length;
    setConfirmState({
      title: `Delete ${property.name}?`,
      message: `This permanently deletes the property, its ${tenantCount} tenant record${tenantCount === 1 ? '' : 's'}, and all ${billCount} bill${billCount === 1 ? '' : 's'} — including any payment history and tenant links. This cannot be undone.`,
      confirmLabel: 'Delete property',
      onConfirm: async () => {
        setConfirmState(null);
        try {
          await deleteProperty(propertyId);
          navigate('/properties');
        } catch (err) {
          console.error('Failed to delete property:', err);
        }
      },
    });
  };

  const handleDeleteBill = (bill) => {
    const splitCount = billSplits.filter((s) => s.bill_id === bill.id).length;
    setConfirmState({
      title: `Delete this ${bill.bill_type} bill?`,
      message: `This deletes the bill and ${splitCount} tenant split${splitCount === 1 ? '' : 's'} that go with it. This cannot be undone.`,
      confirmLabel: 'Delete bill',
      onConfirm: async () => {
        setConfirmState(null);
        try {
          await deleteBill(bill.id);
        } catch (err) {
          console.error('Failed to delete bill:', err);
        }
      },
    });
  };

  const handleBillSubmit = async (e) => {
    e.preventDefault();
    if (!billForm.periodStart || !billForm.periodEnd) {
      setBillError('Billing period is required');
      return;
    }
    if (billForm.periodEnd > today()) {
      setBillError("The billing period end can't be in the future — a bill covers a period that's already happened.");
      return;
    }
    if (!billForm.totalAmount) {
      setBillError('Amount is required');
      return;
    }
    if (billForm.dueDate && billForm.dueDate < billForm.periodEnd) {
      setBillError('Due date must be on or after the billing period end');
      return;
    }
    // CHR-24: require a description when the utility type is "other"
    if (billForm.billType === 'other' && !billForm.description.trim()) {
      setBillError('Please describe what this "Other" bill is for — this helps you remember months later.');
      return;
    }
    setBillSubmitting(true);
    setBillError('');
    try {
      if (editingBillId) {
        await updateBill({
          billId: editingBillId,
          billType: billForm.billType,
          totalAmount: parseFloat(billForm.totalAmount),
          periodStart: billForm.periodStart,
          periodEnd: billForm.periodEnd,
          dueDate: billForm.dueDate || null,
          description: billForm.billType === 'other' ? billForm.description.trim() : null,
        });
      } else {
        await createBillWithSplits({
          propertyId,
          billType: billForm.billType,
          totalAmount: parseFloat(billForm.totalAmount),
          periodStart: billForm.periodStart,
          periodEnd: billForm.periodEnd,
          dueDate: billForm.dueDate || null,
          description: billForm.billType === 'other' ? billForm.description.trim() : null,
        });
      }
      setBillForm(emptyBill);
      setEditingBillId(null);
      setShowBillForm(false);
    } catch (err) {
      console.error('Failed to save bill:', err);
      setBillError(err.message || 'Failed to save bill');
    } finally {
      setBillSubmitting(false);
    }
  };

  const handleEditBill = (bill) => {
    setBillForm({
      billType: bill.bill_type,
      totalAmount: String(bill.total_amount),
      periodStart: bill.billing_period_start,
      periodEnd: bill.billing_period_end,
      dueDate: bill.due_date || '',
      // CHR-24: restore description when editing an existing bill
      description: bill.description || '',
    });
    setEditingBillId(bill.id);
    setBillError('');
    setShowBillForm(true);
  };

  // due_date has no effect on split amounts, so it's editable independent
  // of hasPaidSplit — unlike the full bill-edit form below, which is
  // blocked once a split is paid to protect the number a tenant may
  // already be looking at.
  const handleStartEditDueDate = (bill) => {
    setEditingDueDateBillId(bill.id);
    setDueDateDraft(bill.due_date || '');
    setDueDateError('');
  };

  const handleSaveDueDate = async (billId) => {
    setDueDateSubmitting(true);
    setDueDateError('');
    try {
      await updateBillDueDate(billId, dueDateDraft || null);
      setEditingDueDateBillId(null);
    } catch (err) {
      console.error('Failed to update due date:', err);
      setDueDateError(err.message || 'Failed to update due date');
    } finally {
      setDueDateSubmitting(false);
    }
  };

  const handleCancelBillForm = () => {
    setShowBillForm(false);
    setEditingBillId(null);
    setBillForm(emptyBill);
    setBillError('');
  };

  const handleRentBillSubmit = async (e) => {
    e.preventDefault();
    if (!rentBillForm.periodStart || !rentBillForm.periodEnd) {
      setRentBillError('Billing period is required');
      return;
    }
    setRentBillSubmitting(true);
    setRentBillError('');
    try {
      await createRentBill({
        propertyId,
        periodStart: rentBillForm.periodStart,
        periodEnd: rentBillForm.periodEnd,
        dueDate: rentBillForm.dueDate || null,
      });
      setRentBillForm(emptyRentBill);
      setShowRentBillForm(false);
    } catch (err) {
      console.error('Failed to generate rent bill:', err);
      setRentBillError(err.message || 'Failed to generate rent bill');
    } finally {
      setRentBillSubmitting(false);
    }
  };

  const handlePropertySubmit = async (e) => {
    e.preventDefault();
    if (!propertyForm.name.trim() || !propertyForm.address.trim()) {
      setPropertyError('Name and address are required');
      return;
    }
    setPropertySubmitting(true);
    setPropertyError('');
    try {
      await updateProperty(propertyId, {
        name: propertyForm.name.trim(),
        address: propertyForm.address.trim(),
        description: propertyForm.description.trim() || null,
      });
      setShowPropertyForm(false);
    } catch (err) {
      console.error('Failed to update property:', err);
      setPropertyError(err.message || 'Failed to update property');
    } finally {
      setPropertySubmitting(false);
    }
  };

  const handleEditProperty = () => {
    setPropertyForm({
      name: property.name,
      address: property.address,
      description: property.description || '',
    });
    setPropertyError('');
    setShowPropertyForm(true);
  };

  // Shared by the Rent and Utilities sections — a bill's split table/cards
  // are identical either way, only the surrounding actions differ slightly.
  const renderBillSplits = (bill) => {
    const splits = billSplits.filter((s) => s.bill_id === bill.id);
    const hasPaidSplit = splits.some((s) => s.status === 'paid');
    const isUtility = bill.bill_type !== 'rent';

    return (
      <div key={bill.id} className="card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-semibold text-secondary-900 capitalize">
              {bill.bill_type} &mdash; <Money dollars={bill.total_amount} />
            </p>
            {/* CHR-24: show description for Other utility bills */}
            {bill.bill_type === 'other' && bill.description && (
              <p className="text-xs text-secondary-500 mt-0.5">{bill.description}</p>
            )}
            <p className="text-sm font-semibold text-secondary-900 mt-0.5">
              {bill.billing_period_start} to {bill.billing_period_end}
            </p>
            {editingDueDateBillId === bill.id ? (
              <div className="mt-2 flex flex-wrap items-end gap-2 bg-secondary-50 border border-secondary-200 rounded-lg px-3 py-2">
                <div>
                  <label className="block text-xs text-secondary-500 mb-1">Due date</label>
                  <input
                    type="date"
                    value={dueDateDraft}
                    onChange={(e) => setDueDateDraft(e.target.value)}
                    className="input-field text-sm py-1.5 w-auto"
                  />
                </div>
                <button
                  onClick={() => handleSaveDueDate(bill.id)}
                  disabled={dueDateSubmitting}
                  className="btn-primary text-xs px-3 py-1"
                >
                  {dueDateSubmitting ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setEditingDueDateBillId(null)}
                  className="btn-secondary text-xs px-3 py-1"
                >
                  Cancel
                </button>
                {dueDateError && <p className="text-danger-600 text-xs w-full mt-1">{dueDateError}</p>}
              </div>
            ) : (
              <div className="mt-1 flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-secondary-400" />
                {bill.due_date ? (
                  <span className="text-sm text-secondary-700">Due {bill.due_date}</span>
                ) : (
                  <span className="text-sm text-secondary-500">No due date set</span>
                )}
                <button
                  onClick={() => handleStartEditDueDate(bill)}
                  className="text-primary-600 hover:text-primary-700 text-xs font-medium"
                >
                  {bill.due_date ? 'Edit' : 'Add due date'}
                </button>
              </div>
            )}
            {isUtility && (
              <p className="text-xs mt-1">
                {bill.locked_at ? (
                  <span className="text-secondary-400">Sent &middot; locked against roster changes</span>
                ) : (
                  <span className="text-primary-600">Draft &middot; updates automatically if tenants change</span>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center space-x-3">
            {isUtility && (
              <button
                onClick={() => handleEditBill(bill)}
                disabled={hasPaidSplit}
                title={hasPaidSplit ? 'A tenant has already paid this bill — it can no longer be edited' : 'Edit bill'}
                className="text-secondary-300 hover:text-primary-600 disabled:opacity-30 disabled:hover:text-secondary-300"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => handleRecalculate(bill.id)}
              disabled={hasPaidSplit || recalculatingBillId === bill.id}
              title={
                hasPaidSplit
                  ? 'A tenant has already paid this bill — recalculating is blocked to protect that record'
                  : 'Recompute the split against the current tenant list'
              }
              className="text-secondary-400 hover:text-primary-600 disabled:opacity-30 disabled:hover:text-secondary-400"
            >
              <RefreshCw className={`w-4 h-4 ${recalculatingBillId === bill.id ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => handleDeleteBill(bill)} className="text-secondary-300 hover:text-danger-600">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {isUtility && bill.needs_reissue && (
          <div className="mb-4 flex items-center justify-between bg-warning-50 border border-warning-100 rounded-lg px-3 py-2">
            <p className="text-sm text-warning-700 flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
              Tenants changed since this bill was sent — the split may be out of date.
            </p>
            <button
              onClick={() => handleReissue(bill.id)}
              disabled={hasPaidSplit || recalculatingBillId === bill.id}
              className="text-sm font-medium text-warning-700 hover:text-warning-800 whitespace-nowrap ml-3 disabled:opacity-50"
            >
              {recalculatingBillId === bill.id ? 'Reissuing...' : 'Reissue'}
            </button>
          </div>
        )}

        <div className="mb-4 flex items-center space-x-3 text-sm">
          {bill.attachment_path ? (
            <>
              <button
                onClick={() => handleViewAttachment(bill)}
                disabled={openingAttachmentBillId === bill.id}
                className="inline-flex items-center space-x-1 text-primary-600 hover:text-primary-700 disabled:opacity-50"
              >
                <Paperclip className="w-4 h-4" />
                <span>{openingAttachmentBillId === bill.id ? 'Opening...' : bill.attachment_name || 'View attachment'}</span>
              </button>
              <button
                onClick={() => removeBillAttachment(bill.id)}
                className="text-secondary-300 hover:text-danger-600"
                title="Remove attachment"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <label className="inline-flex items-center space-x-1 text-secondary-500 hover:text-primary-600 cursor-pointer">
                <Paperclip className="w-4 h-4" />
                <span>{uploadingBillId === bill.id ? 'Uploading...' : 'Attach bill (image/PDF)'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  className="hidden"
                  disabled={uploadingBillId === bill.id}
                  onChange={(e) => handleAttachmentChange(bill.id, e)}
                />
              </label>
              {/* CHR-26: state the file size limit clearly so landlords know before they try */}
              <span className="text-xs text-secondary-400">Max 10 MB</span>
            </>
          )}
        </div>
        {attachmentError && <p className="text-danger-600 text-xs mb-3">{attachmentError}</p>}
        {recalcError && <p className="text-danger-600 text-xs mb-3">{recalcError}</p>}

        {/* Desktop table */}
        <div className="hidden sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-secondary-500 border-b border-secondary-200">
                <th className="py-1">Tenant</th>
                <th className="py-1">Room</th>
                <th className="py-1">%</th>
                <th className="py-1 text-right">Owed</th>
                <th className="py-1 text-center">Status</th>
                <th className="py-1 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {splits.map((split) => (
                <React.Fragment key={split.id}>
                <tr className="border-b border-secondary-100 last:border-0">
                  <td className="py-1">
                    {split.tenant_name}
                    {split.rate_breakdown && (
                      <button
                        onClick={() =>
                          setExpandedBreakdownSplitId((id) => (id === split.id ? null : split.id))
                        }
                        className="ml-1 text-secondary-300 hover:text-primary-600 align-middle"
                        title="View rate breakdown"
                      >
                        {expandedBreakdownSplitId === split.id ? (
                          <ChevronUp className="w-3 h-3 inline" />
                        ) : (
                          <ChevronDown className="w-3 h-3 inline" />
                        )}
                      </button>
                    )}
                  </td>
                  <td className="py-1">{split.room}</td>
                  <td className="py-1 tabular-nums">{split.percentage}%</td>
                  <td className="py-1 text-right">
                    <Money dollars={split.owed_amount} className="text-secondary-900" />
                  </td>
                  <td className="py-1 text-center">
                    <StatusBadge status={effectiveStatus(split, bill)} />
                  </td>
                  <td className="py-1 text-right">
                    <div className="flex items-center justify-end">
                      <SplitActions
                        split={split}
                        sendingSplitId={sendingSplitId}
                        onRevoke={handleRevokeLink}
                        onSetStatus={setBillSplitStatus}
                        onSendEmail={handleSendEmail}
                        billHasAttachment={!!bill.attachment_path}
                      />
                    </div>
                  </td>
                </tr>
                {split.rate_breakdown && expandedBreakdownSplitId === split.id && (
                  <tr className="bg-secondary-50">
                    <td colSpan={6} className="py-2 px-3">
                      <ul className="text-xs text-secondary-600 space-y-1">
                        {split.rate_breakdown.map((seg, i) => (
                          <li key={i} className="flex justify-between">
                            <span>
                              {seg.from} to {seg.to} ({seg.days} day{seg.days === 1 ? '' : 's'} @{' '}
                              <Money cents={seg.amountCents} />/{seg.frequency})
                            </span>
                            <Money cents={seg.cents} className="font-medium" />
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile stacked cards */}
        <div className="sm:hidden space-y-3">
          {splits.map((split) => (
            <div key={split.id} className="border border-secondary-200 rounded-lg p-3">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium text-secondary-900">{split.tenant_name}</p>
                  <p className="text-xs text-secondary-500">
                    {split.room} &middot; {split.percentage}%
                  </p>
                </div>
                <div className="text-right">
                  <Money dollars={split.owed_amount} as="p" className="text-secondary-900 block mb-1" />
                  <StatusBadge status={effectiveStatus(split, bill)} />
                </div>
              </div>

              {split.rate_breakdown && (
                <>
                  <button
                    onClick={() => setExpandedBreakdownSplitId((id) => (id === split.id ? null : split.id))}
                    className="text-xs text-primary-600 hover:text-primary-700 mb-2"
                  >
                    {expandedBreakdownSplitId === split.id ? 'Hide' : 'View'} rate breakdown
                  </button>
                  {expandedBreakdownSplitId === split.id && (
                    <ul className="text-xs text-secondary-600 space-y-1 mb-2 bg-secondary-50 rounded p-2">
                      {split.rate_breakdown.map((seg, i) => (
                        <li key={i} className="flex justify-between">
                          <span>
                            {seg.from} to {seg.to} ({seg.days}d @ <Money cents={seg.amountCents} />/{seg.frequency})
                          </span>
                          <Money cents={seg.cents} className="font-medium" />
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-secondary-100">
                <SplitActions
                  split={split}
                  sendingSplitId={sendingSplitId}
                  onRevoke={handleRevokeLink}
                  onSetStatus={setBillSplitStatus}
                  onSendEmail={handleSendEmail}
                  billHasAttachment={!!bill.attachment_path}
                />
              </div>
            </div>
          ))}
        </div>
        {emailError && <p className="text-danger-600 text-xs mt-3">{emailError}</p>}
      </div>
    );
  };

  // Rent bills tend to accumulate fast (one per month, automatically) — show
  // only the two most recent by default so a long history doesn't read as an
  // unexplained wall of bills, with a year filter and an explicit toggle to
  // see older ones instead of always dumping everything on screen at once.
  const rentBillYears = Array.from(new Set(rentBills.map((b) => b.billing_period_start.slice(0, 4)))).sort(
    (a, b) => b.localeCompare(a)
  );
  const yearFilteredRentBills =
    rentBillYearFilter === 'all'
      ? rentBills
      : rentBills.filter((b) => b.billing_period_start.startsWith(rentBillYearFilter));
  const sortedRentBills = [...yearFilteredRentBills].sort((a, b) =>
    b.billing_period_start.localeCompare(a.billing_period_start)
  );
  const shouldCollapse = rentBillYearFilter === 'all' && !showOlderRentBills;
  const visibleRentBills = shouldCollapse ? sortedRentBills.slice(0, 2) : sortedRentBills;
  const hiddenRentBillsCount = shouldCollapse ? Math.max(0, sortedRentBills.length - 2) : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <ConfirmModal
        open={!!confirmState}
        title={confirmState?.title}
        message={confirmState?.message}
        confirmLabel={confirmState?.confirmLabel}
        onConfirm={confirmState?.onConfirm}
        onCancel={() => setConfirmState(null)}
      />

      <nav className="flex items-center text-sm text-secondary-500 mb-6" aria-label="Breadcrumb">
        <Link to="/dashboard" className="hover:text-secondary-900">Dashboard</Link>
        <ChevronRight className="w-3.5 h-3.5 mx-1.5" />
        <Link to="/properties" className="hover:text-secondary-900">Properties</Link>
        <ChevronRight className="w-3.5 h-3.5 mx-1.5" />
        <span className="text-secondary-900 font-medium">{property.name}</span>
      </nav>

      <div className="mb-8">
        {showPropertyForm ? (
          <form onSubmit={handlePropertySubmit} className="card space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-secondary-900 mb-1.5">Property name</label>
                <input
                  className="input-field"
                  value={propertyForm.name}
                  onChange={(e) => setPropertyForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-900 mb-1.5">Address</label>
                <input
                  className="input-field"
                  value={propertyForm.address}
                  onChange={(e) => setPropertyForm((p) => ({ ...p, address: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-900 mb-1.5">Description (optional)</label>
              <input
                className="input-field"
                maxLength={500}
                value={propertyForm.description}
                onChange={(e) => setPropertyForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            {propertyError && <p className="text-danger-600 text-sm">{propertyError}</p>}
            <div className="flex space-x-3">
              <button type="submit" disabled={propertySubmitting} className="btn-primary">
                {propertySubmitting ? 'Saving...' : 'Save Changes'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowPropertyForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-secondary-900">{property.name}</h1>
              <p className="text-secondary-600">{property.address}</p>
              {property.description && <p className="text-secondary-500 text-sm mt-1">{property.description}</p>}
            </div>
            <div className="flex items-center space-x-2 mt-1">
              <button onClick={handleEditProperty} className="text-secondary-300 hover:text-primary-600" title="Edit property">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={handleDeleteProperty} className="text-secondary-300 hover:text-danger-600" title="Delete property">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="border-b border-secondary-200 mb-8 flex space-x-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`pb-3 text-sm font-medium border-b-2 -mb-px transition-colors duration-200 ${
              activeTab === tab.id
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-secondary-500 hover:text-secondary-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tenants */}
      {activeTab === 'tenants' && (
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
              <div>
                <label className="block text-sm font-medium text-secondary-900 mb-1.5">Name</label>
                <input
                  className="input-field"
                  value={tenantForm.name}
                  onChange={(e) => setTenantForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-900 mb-1.5">Room</label>
                <input
                  className="input-field"
                  placeholder="e.g. Room 1"
                  value={tenantForm.room}
                  onChange={(e) => setTenantForm((p) => ({ ...p, room: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-900 mb-1.5">Occupants in this room</label>
                <input
                  type="number"
                  min="1"
                  className="input-field"
                  value={tenantForm.numberOfOccupants}
                  onChange={(e) => setTenantForm((p) => ({ ...p, numberOfOccupants: parseInt(e.target.value, 10) || 1 }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-secondary-900 mb-1.5">Email (optional)</label>
                <input
                  type="email"
                  className="input-field"
                  value={tenantForm.email}
                  onChange={(e) => setTenantForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-900 mb-1.5">Phone (optional)</label>
                <input
                  className="input-field"
                  value={tenantForm.phone}
                  onChange={(e) => setTenantForm((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-secondary-900 mb-1.5">Move-in date</label>
                <input
                  type="date"
                  className="input-field"
                  value={tenantForm.moveInDate}
                  onChange={(e) => setTenantForm((p) => ({ ...p, moveInDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-900 mb-1.5">Move-out date (optional)</label>
                <input
                  type="date"
                  className="input-field"
                  value={tenantForm.moveOutDate}
                  onChange={(e) => setTenantForm((p) => ({ ...p, moveOutDate: e.target.value }))}
                />
              </div>
            </div>
            {!editingTenantId && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-secondary-100">
                <div>
                  <label className="block text-sm font-medium text-secondary-900 mb-1.5">Rent (optional — can set later)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      className="input-field pl-7"
                      placeholder="0.00"
                      value={tenantForm.rentAmount}
                      onChange={(e) => setTenantForm((p) => ({ ...p, rentAmount: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary-900 mb-1.5">Frequency</label>
                  <select
                    className="input-field"
                    value={tenantForm.rentFrequency}
                    onChange={(e) => setTenantForm((p) => ({ ...p, rentFrequency: e.target.value }))}
                  >
                    <option value="weekly">Weekly</option>
                    <option value="fortnightly">Fortnightly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>
            )}
            {tenantError && <p className="text-danger-600 text-sm">{tenantError}</p>}
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

        {activeTenants.length === 0 ? (
          <div className="card text-center py-12">
            <Users className="w-10 h-10 text-secondary-300 mx-auto mb-3" />
            <p className="text-secondary-600">No active tenants yet. Add one to start splitting bills.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeTenants.map((tenant) => {
              const balanceCents = balanceFor(tenant.id);
              const latestSplit = latestSplitFor(tenant.id);
              return (
              <div key={tenant.id} className="card flex items-start justify-between">
                <div>
                  <p className="font-semibold text-secondary-900">{tenant.name}</p>
                  <p className="text-sm text-secondary-600">Room: {tenant.room}</p>
                  <p className="text-sm text-secondary-600">Occupants: {tenant.number_of_occupants}</p>
                  <p className="text-sm text-secondary-500">Moved in: {tenant.move_in_date}</p>
                  {tenant.move_out_date && (
                    <p className="text-sm text-secondary-500">Moves out: {tenant.move_out_date}</p>
                  )}
                  <div className="mt-3 pt-3 border-t border-secondary-100">
                    <p className="text-sm text-secondary-700">
                      Owes across everything: <Money cents={balanceCents} className={balanceCents > 0 ? 'text-secondary-900' : 'text-success-700'} />
                    </p>
                    {latestSplit && (
                      <a
                        href={`/bill/${latestSplit.access_token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-xs font-medium text-primary-600 hover:text-primary-700 mt-1"
                      >
                        Preview their breakdown &rarr;
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleEditTenant(tenant)}
                    className="text-secondary-300 hover:text-primary-600"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteTenant(tenant)}
                    className="text-secondary-300 hover:text-danger-600"
                    title="Delete or archive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}

        {formerTenants.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide mb-2">Former tenants</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {formerTenants.map((tenant) => (
                <div key={tenant.id} className="card flex items-start justify-between opacity-70">
                  <div>
                    <p className="font-semibold text-secondary-900">{tenant.name}</p>
                    <p className="text-sm text-secondary-600">Room: {tenant.room}</p>
                    <p className="text-sm text-secondary-500">
                      {tenant.move_in_date} to {tenant.move_out_date || '—'}
                    </p>
                  </div>
                  <button
                    onClick={() => reactivateTenant(tenant.id)}
                    className="text-secondary-400 hover:text-primary-600"
                    title="Reactivate"
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
      )}

      {/* Rent — its own area: per-tenant rates, and rent bills generated from them */}
      {activeTab === 'rent' && (
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-secondary-900 flex items-center mb-1">
          <DollarSign className="w-5 h-5 mr-2" /> Rent
        </h2>
        <p className="text-xs text-secondary-500 mb-4">
          A rate's "effective from" date is when it starts applying — bills before that date use whatever
          rate was in place before it.
        </p>

        {activeTenants.length === 0 ? (
          <div className="card text-center py-12">
            <DollarSign className="w-10 h-10 text-secondary-300 mx-auto mb-3" />
            <p className="text-secondary-600">Add a tenant above to set their rent.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {activeTenants.map((tenant) => (
              <div key={tenant.id} className="card">
                <p className="font-semibold text-secondary-900">{tenant.name}</p>
                <p className="text-xs text-secondary-500 mb-2">Room: {tenant.room}</p>

                {currentRateFor(tenant.id) ? (
                  <p className="text-sm text-secondary-700 flex items-center">
                    <Money cents={currentRateFor(tenant.id).amount_cents} className="text-secondary-700" />/{currentRateFor(tenant.id).frequency}
                    <span className="text-secondary-400 ml-1">since {currentRateFor(tenant.id).effective_from}</span>
                  </p>
                ) : (
                  <p className="text-sm text-secondary-400">No rent rate set</p>
                )}
                <button
                  onClick={() => handleOpenRateForm(tenant.id)}
                  className="text-xs text-primary-600 hover:text-primary-700 mt-1"
                >
                  {currentRateFor(tenant.id) ? 'Change rent' : 'Set rent'}
                </button>

                {ratesTenantId === tenant.id && (
                  <form
                    onSubmit={(e) => handleRateSubmit(e, tenant.id)}
                    className="mt-3 space-y-3 bg-secondary-50 rounded-lg p-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-secondary-500 mb-1">Amount</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary-400 text-sm">$</span>
                          <input
                            type="number"
                            step="0.01"
                            className="input-field text-sm pl-6"
                            value={rateForm.amount}
                            onChange={(e) => setRateForm((p) => ({ ...p, amount: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-secondary-500 mb-1">Frequency</label>
                        <select
                          className="input-field text-sm"
                          value={rateForm.frequency}
                          onChange={(e) => setRateForm((p) => ({ ...p, frequency: e.target.value }))}
                        >
                          <option value="weekly">Weekly</option>
                          <option value="fortnightly">Fortnightly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-secondary-500 mb-1">Effective from</label>
                        <input
                          type="date"
                          className="input-field text-sm"
                          value={rateForm.effectiveFrom}
                          onChange={(e) => setRateForm((p) => ({ ...p, effectiveFrom: e.target.value }))}
                        />
                      </div>
                    </div>
                    {rateError && <p className="text-danger-600 text-xs">{rateError}</p>}
                    <div className="flex space-x-2">
                      <button type="submit" disabled={rateSubmitting} className="btn-primary text-xs px-3 py-1">
                        {rateSubmitting ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary text-xs px-3 py-1"
                        onClick={() => setRatesTenantId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {rateHistoryFor(tenant.id).length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {rateHistoryFor(tenant.id).map((r) => (
                      <li key={r.id} className="text-xs text-secondary-500 flex items-center justify-between">
                        <span>
                          <Money cents={r.amount_cents} className="text-secondary-500" />/{r.frequency} &middot; {r.effective_from} to{' '}
                          {r.effective_to || 'ongoing'}
                        </span>
                        <button onClick={() => handleDeleteRate(r.id)} className="text-secondary-300 hover:text-danger-600">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-secondary-500 uppercase tracking-wide">Rent bills</h3>
          <div className="flex items-center space-x-2">
            {rentBillYears.length > 1 && (
              <select
                className="input-field text-sm py-1.5"
                value={rentBillYearFilter}
                onChange={(e) => setRentBillYearFilter(e.target.value)}
              >
                <option value="all">All years</option>
                {rentBillYears.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => setShowRentBillForm((s) => !s)}
              disabled={activeTenants.length === 0}
              className="btn-secondary flex items-center space-x-2 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Generate for a custom period</span>
            </button>
          </div>
        </div>
        <p className="text-xs text-secondary-500 mb-4">
          Every month, a rent bill is created automatically using each tenant's active rate. If someone
          moves out or their rate changes mid-month, it's prorated automatically. Use the button above only
          to create a bill for an earlier period, or one that doesn't line up with a calendar month.
        </p>

        {showRentBillForm && (
          <form onSubmit={handleRentBillSubmit} className="card mb-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-secondary-900 mb-1.5">Period start</label>
                <input
                  type="date"
                  className="input-field"
                  value={rentBillForm.periodStart}
                  onChange={(e) => setRentBillForm((p) => ({ ...p, periodStart: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-900 mb-1.5">Period end</label>
                <input
                  type="date"
                  className="input-field"
                  value={rentBillForm.periodEnd}
                  onChange={(e) => setRentBillForm((p) => ({ ...p, periodEnd: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-900 mb-1.5">Due date (optional)</label>
                <input
                  type="date"
                  className="input-field"
                  value={rentBillForm.dueDate}
                  onChange={(e) => setRentBillForm((p) => ({ ...p, dueDate: e.target.value }))}
                />
              </div>
            </div>
            <p className="text-xs text-secondary-500">
              Unlike a utility bill, rent isn't split from one shared total — each tenant pays their own
              agreed rate, prorated for any partial period.
            </p>
            {rentBillError && <p className="text-danger-600 text-sm">{rentBillError}</p>}
            <div className="flex space-x-3">
              <button type="submit" disabled={rentBillSubmitting} className="btn-primary">
                {rentBillSubmitting ? 'Generating...' : 'Generate Rent Bill'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowRentBillForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {rentBills.length === 0 ? (
          <div className="card text-center py-12">
            <Inbox className="w-10 h-10 text-secondary-300 mx-auto mb-3" />
            <p className="text-secondary-600">No rent bills yet — one generates automatically once a tenant has a rate set.</p>
          </div>
        ) : sortedRentBills.length === 0 ? (
          <div className="card text-center py-12">
            <Inbox className="w-10 h-10 text-secondary-300 mx-auto mb-3" />
            <p className="text-secondary-600">No rent bills in {rentBillYearFilter}.</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">{visibleRentBills.map(renderBillSplits)}</div>
            {hiddenRentBillsCount > 0 && (
              <button
                onClick={() => setShowOlderRentBills(true)}
                className="mt-4 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Show older bills ({hiddenRentBillsCount})
              </button>
            )}
          </>
        )}
      </section>
      )}

      {/* Utilities — episodic bills, split by occupancy, unrelated to rent rates */}
      {activeTab === 'utilities' && (
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-secondary-900 flex items-center">
            <Zap className="w-5 h-5 mr-2" /> Utilities
          </h2>
          <button
            onClick={() => {
              if (showBillForm) {
                handleCancelBillForm();
              } else {
                setEditingBillId(null);
                setBillForm(emptyBill);
                setShowBillForm(true);
              }
            }}
            disabled={activeTenants.length === 0}
            className="btn-secondary flex items-center space-x-2 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Add Bill</span>
          </button>
        </div>

        {showBillForm && (
          <form onSubmit={handleBillSubmit} className="card mb-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-secondary-900 mb-1.5">Type</label>
                <select
                  className="input-field"
                  value={billForm.billType}
                  onChange={(e) => setBillForm((p) => ({ ...p, billType: e.target.value }))}
                >
                  {UTILITY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-900 mb-1.5">Total amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field pl-7"
                    value={billForm.totalAmount}
                    onChange={(e) => setBillForm((p) => ({ ...p, totalAmount: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-900 mb-1.5">Billing period start</label>
                <input
                  type="date"
                  className="input-field"
                  value={billForm.periodStart}
                  onChange={(e) => setBillForm((p) => ({ ...p, periodStart: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-900 mb-1.5">Billing period end</label>
                <input
                  type="date"
                  className="input-field"
                  max={today()}
                  value={billForm.periodEnd}
                  onChange={(e) => setBillForm((p) => ({ ...p, periodEnd: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-secondary-900 mb-1.5">Due date (optional)</label>
                <input
                  type="date"
                  className="input-field"
                  min={billForm.periodEnd || undefined}
                  value={billForm.dueDate}
                  onChange={(e) => setBillForm((p) => ({ ...p, dueDate: e.target.value }))}
                />
              </div>
            </div>
            {/* CHR-24: show a required description field when bill type is "Other" */}
            {billForm.billType === 'other' && (
              <div>
                <label className="block text-sm font-medium text-secondary-900 mb-1.5">
                  What is this bill for? <span className="text-danger-600">*</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Strata levy, pest control, garden maintenance"
                  value={billForm.description}
                  onChange={(e) => setBillForm((p) => ({ ...p, description: e.target.value }))}
                  maxLength={200}
                />
                <p className="text-xs text-secondary-400 mt-1">This description will appear on the tenant's bill.</p>
              </div>
            )}
            {billError && <p className="text-danger-600 text-sm">{billError}</p>}
            <div className="flex space-x-3">
              <button type="submit" disabled={billSubmitting} className="btn-primary">
                {billSubmitting ? 'Saving...' : editingBillId ? 'Save Changes' : 'Create Bill & Split'}
              </button>
              <button type="button" className="btn-secondary" onClick={handleCancelBillForm}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {utilityBills.length === 0 ? (
          <div className="card text-center py-12">
            <Inbox className="w-10 h-10 text-secondary-300 mx-auto mb-3" />
            <p className="text-secondary-600">No bills yet. Add one above once tenants are in place.</p>
          </div>
        ) : (
          <div className="space-y-4">{utilityBills.map(renderBillSplits)}</div>
        )}
      </section>
      )}
    </div>
  );
};

export default PropertyDetail;
