import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';
import { computeSplits } from '../lib/billSplit';
import { computeRentForPeriod, ratesOverlap } from '../lib/rentCalc';

const PropertyContext = createContext();

export const useProperties = () => {
  const context = useContext(PropertyContext);
  if (!context) {
    throw new Error('useProperties must be used within a PropertyProvider');
  }
  return context;
};

export const PropertyProvider = ({ children }) => {
  const { user } = useAuth();
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [bills, setBills] = useState([]);
  const [billSplits, setBillSplits] = useState([]);
  const [rentRates, setRentRates] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setProperties([]);
      setTenants([]);
      setBills([]);
      setBillSplits([]);
      setRentRates([]);
      return;
    }
    setLoading(true);
    const [
      { data: propertiesData, error: propertiesError },
      { data: tenantsData, error: tenantsError },
      { data: billsData, error: billsError },
      { data: billSplitsData, error: billSplitsError },
      { data: rentRatesData, error: rentRatesError },
    ] = await Promise.all([
      supabase.from('properties').select('*').order('created_at', { ascending: false }),
      supabase.from('tenants').select('*').order('created_at', { ascending: false }),
      supabase.from('bills').select('*').order('created_at', { ascending: false }),
      supabase.from('bill_splits').select('*'),
      supabase.from('rent_rates').select('*').order('effective_from', { ascending: true }),
    ]);

    if (propertiesError) throw propertiesError;
    if (tenantsError) throw tenantsError;
    if (billsError) throw billsError;
    if (billSplitsError) throw billSplitsError;
    if (rentRatesError) throw rentRatesError;

    setProperties(propertiesData ?? []);
    setTenants(tenantsData ?? []);
    setBills(billsData ?? []);
    setBillSplits(billSplitsData ?? []);
    setRentRates(rentRatesData ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh().catch((err) => console.error('Failed to load property data:', err));
  }, [refresh]);

  const createProperty = async ({ name, address, description }) => {
    const { data, error } = await supabase
      .from('properties')
      .insert({ name, address, description, landlord_id: user.id })
      .select()
      .single();
    if (error) throw error;
    setProperties((prev) => [data, ...prev]);
    return data;
  };

  const updateProperty = async (propertyId, updates) => {
    const { data, error } = await supabase
      .from('properties')
      .update(updates)
      .eq('id', propertyId)
      .select()
      .single();
    if (error) throw error;
    setProperties((prev) => prev.map((p) => (p.id === propertyId ? data : p)));
    return data;
  };

  const deleteProperty = async (propertyId) => {
    const { error } = await supabase.from('properties').delete().eq('id', propertyId);
    if (error) throw error;
    setProperties((prev) => prev.filter((p) => p.id !== propertyId));
    setTenants((prev) => prev.filter((t) => t.property_id !== propertyId));
  };

  const createTenant = async ({ propertyId, name, email, phone, room, moveInDate, moveOutDate, numberOfOccupants }) => {
    const { data, error } = await supabase
      .from('tenants')
      .insert({
        property_id: propertyId,
        landlord_id: user.id,
        name,
        email: email || null,
        phone: phone || null,
        room,
        move_in_date: moveInDate,
        move_out_date: moveOutDate || null,
        number_of_occupants: numberOfOccupants || 1,
      })
      .select()
      .single();
    if (error) throw error;
    setTenants((prev) => [data, ...prev]);
    return data;
  };

  const updateTenant = async (tenantId, updates) => {
    const { data, error } = await supabase
      .from('tenants')
      .update(updates)
      .eq('id', tenantId)
      .select()
      .single();
    if (error) throw error;
    setTenants((prev) => prev.map((t) => (t.id === tenantId ? data : t)));
    return data;
  };

  // A tenant with any bill history is never hard-deleted — their splits
  // reference them, and deleting the row would orphan that history (and,
  // pre-fix, silently rewrote already-paid amounts). They're archived
  // instead; only a tenant with zero bill history can be truly removed.
  const deleteTenant = async (tenantId) => {
    const hasHistory = billSplits.some((s) => s.tenant_id === tenantId);
    if (hasHistory) {
      return updateTenant(tenantId, { status: 'former' });
    }
    const { error } = await supabase.from('tenants').delete().eq('id', tenantId);
    if (error) throw error;
    setTenants((prev) => prev.filter((t) => t.id !== tenantId));
    return null;
  };

  const reactivateTenant = async (tenantId) => updateTenant(tenantId, { status: 'active' });

  const createBillWithSplits = async ({ propertyId, billType, totalAmount, periodStart, periodEnd, dueDate }) => {
    const propertyTenants = tenants.filter((t) => t.property_id === propertyId && t.status !== 'former');
    if (propertyTenants.length === 0) {
      throw new Error('This property has no active tenants to split the bill across.');
    }

    const splits = computeSplits(propertyTenants, periodStart, periodEnd, totalAmount);
    if (splits.length === 0) {
      throw new Error('No tenant occupancy overlaps this billing period.');
    }

    const { data: bill, error: billError } = await supabase
      .from('bills')
      .insert({
        property_id: propertyId,
        bill_type: billType,
        total_amount: totalAmount,
        billing_period_start: periodStart,
        billing_period_end: periodEnd,
        due_date: dueDate || null,
        landlord_id: user.id,
      })
      .select()
      .single();
    if (billError) throw billError;

    const splitsToInsert = splits.map((s) => ({ ...s, bill_id: bill.id, landlord_id: user.id }));

    const { data: insertedSplits, error: splitsError } = await supabase
      .from('bill_splits')
      .insert(splitsToInsert)
      .select();
    if (splitsError) throw splitsError;

    setBills((prev) => [bill, ...prev]);
    setBillSplits((prev) => [...prev, ...insertedSplits]);
    return { bill, splits: insertedSplits };
  };

  // Shared by recalculateBill and updateBill: recompute a bill's splits
  // against its current field values and the current active tenant list,
  // updating matching tenant rows in place (keeps id/access_token/status)
  // and only inserting/deleting for tenants that actually changed.
  const applyRecomputedSplits = async (bill) => {
    const existingSplits = billSplits.filter((s) => s.bill_id === bill.id);
    const propertyTenants = tenants.filter((t) => t.property_id === bill.property_id && t.status !== 'former');
    const newSplits = computeSplits(
      propertyTenants,
      bill.billing_period_start,
      bill.billing_period_end,
      bill.total_amount
    );

    const existingByTenantId = new Map(existingSplits.map((s) => [s.tenant_id, s]));
    const newTenantIds = new Set(newSplits.map((s) => s.tenant_id));

    const toUpdate = newSplits.filter((s) => existingByTenantId.has(s.tenant_id));
    const toInsert = newSplits
      .filter((s) => !existingByTenantId.has(s.tenant_id))
      .map((s) => ({ ...s, bill_id: bill.id, landlord_id: user.id }));
    const toDeleteIds = existingSplits
      .filter((s) => !newTenantIds.has(s.tenant_id))
      .map((s) => s.id);

    const updatedRows = await Promise.all(
      toUpdate.map(async (s) => {
        const existing = existingByTenantId.get(s.tenant_id);
        const { tenant_id, ...fields } = s;
        const { data, error } = await supabase
          .from('bill_splits')
          .update(fields)
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      })
    );

    let insertedRows = [];
    if (toInsert.length > 0) {
      const { data, error: insertError } = await supabase.from('bill_splits').insert(toInsert).select();
      if (insertError) throw insertError;
      insertedRows = data;
    }

    if (toDeleteIds.length > 0) {
      const { error: deleteError } = await supabase.from('bill_splits').delete().in('id', toDeleteIds);
      if (deleteError) throw deleteError;
    }

    const newBillSplitRows = [...updatedRows, ...insertedRows];
    setBillSplits((prev) => [...prev.filter((s) => s.bill_id !== bill.id), ...newBillSplitRows]);
    return newBillSplitRows;
  };

  // Explicit, landlord-triggered recompute — never automatic. Refuses to
  // touch a bill once any tenant has confirmed paying it, since that would
  // silently rewrite a settled amount (the exact bug the v1 audit caught).
  const recalculateBill = async (billId) => {
    const bill = bills.find((b) => b.id === billId);
    if (!bill) throw new Error('Bill not found');

    const existingSplits = billSplits.filter((s) => s.bill_id === billId);
    if (existingSplits.some((s) => s.status === 'paid')) {
      throw new Error('This bill has a payment already confirmed — it can no longer be recalculated.');
    }

    return applyRecomputedSplits(bill);
  };

  // Corrects a bill's own fields (fat-fingered amount, wrong dates, etc.)
  // and recomputes its splits to match. Same paid-split guard as
  // recalculateBill — a settled bill's numbers can't move under a tenant.
  const updateBill = async ({ billId, billType, totalAmount, periodStart, periodEnd, dueDate }) => {
    const existingSplits = billSplits.filter((s) => s.bill_id === billId);
    if (existingSplits.some((s) => s.status === 'paid')) {
      throw new Error('This bill has a payment already confirmed — it can no longer be edited.');
    }

    const { data: updatedBill, error } = await supabase
      .from('bills')
      .update({
        bill_type: billType,
        total_amount: totalAmount,
        billing_period_start: periodStart,
        billing_period_end: periodEnd,
        due_date: dueDate || null,
      })
      .eq('id', billId)
      .select()
      .single();
    if (error) throw error;
    setBills((prev) => prev.map((b) => (b.id === billId ? updatedBill : b)));

    await applyRecomputedSplits(updatedBill);
    return updatedBill;
  };

  // A rate is blocked from edit/delete once it overlaps a rent bill period
  // where this tenant's split is already paid — same immutability
  // principle as bills, applied to the rate that generated them.
  const rentRateEditGuard = (tenantId, effectiveFrom, effectiveTo) => {
    const rangeEnd = effectiveTo || '9999-12-31';
    return bills.some((b) => {
      if (b.bill_type !== 'rent') return false;
      const split = billSplits.find((s) => s.bill_id === b.id && s.tenant_id === tenantId);
      if (!split || split.status !== 'paid') return false;
      return effectiveFrom <= b.billing_period_end && b.billing_period_start <= rangeEnd;
    });
  };

  const addRentRate = async (tenantId, { amountCents, frequency, effectiveFrom }) => {
    const tenant = tenants.find((t) => t.id === tenantId);
    if (!tenant) throw new Error('Tenant not found');
    if (effectiveFrom < tenant.move_in_date) {
      throw new Error("Rate can't start before the tenant's move-in date.");
    }

    const tenantRates = rentRates.filter((r) => r.tenant_id === tenantId);

    // Auto-close the previous open-ended rate the day before this one
    // starts, so consecutive rates never have a gap between them. This
    // rate is expected to "overlap" the new one before it's closed, so
    // it's excluded from the overlap check below rather than treated as
    // a conflict.
    const openRate = tenantRates.find((r) => !r.effective_to);
    const willAutoClose = openRate && openRate.effective_from < effectiveFrom;
    const ratesForOverlapCheck = willAutoClose
      ? tenantRates.filter((r) => r.id !== openRate.id)
      : tenantRates;

    if (ratesOverlap(ratesForOverlapCheck, effectiveFrom, null)) {
      throw new Error('This overlaps an existing rate for this tenant.');
    }

    if (willAutoClose) {
      const dayBefore = new Date(effectiveFrom);
      dayBefore.setDate(dayBefore.getDate() - 1);
      const closedDate = dayBefore.toISOString().slice(0, 10);
      const { data: closedRate, error: closeError } = await supabase
        .from('rent_rates')
        .update({ effective_to: closedDate })
        .eq('id', openRate.id)
        .select()
        .single();
      if (closeError) throw closeError;
      setRentRates((prev) => prev.map((r) => (r.id === openRate.id ? closedRate : r)));
    }

    const { data, error } = await supabase
      .from('rent_rates')
      .insert({
        tenant_id: tenantId,
        landlord_id: user.id,
        amount_cents: amountCents,
        frequency,
        effective_from: effectiveFrom,
      })
      .select()
      .single();
    if (error) throw error;
    setRentRates((prev) => [...prev, data]);
    return data;
  };

  const deleteRentRate = async (rateId) => {
    const rate = rentRates.find((r) => r.id === rateId);
    if (!rate) throw new Error('Rate not found');
    if (rentRateEditGuard(rate.tenant_id, rate.effective_from, rate.effective_to)) {
      throw new Error(
        'This rate was used for an already-paid rent bill and cannot be deleted. End-date it with a new rate instead.'
      );
    }
    const { error } = await supabase.from('rent_rates').delete().eq('id', rateId);
    if (error) throw error;
    setRentRates((prev) => prev.filter((r) => r.id !== rateId));
  };

  // Rent works differently from a shared utility bill: each tenant is
  // charged their own rate (resolved day-by-day, prorated across any
  // mid-period rate change) rather than a portion of one shared total.
  // The "total" is just the sum of everyone's own charge.
  const createRentBill = async ({ propertyId, periodStart, periodEnd, dueDate }) => {
    const propertyTenants = tenants.filter((t) => t.property_id === propertyId && t.status !== 'former');

    const charges = propertyTenants
      .map((tenant) => {
        const tenantRates = rentRates.filter((r) => r.tenant_id === tenant.id);
        const { totalCents, segments } = computeRentForPeriod(tenantRates, periodStart, periodEnd);
        return { tenant, totalCents, segments };
      })
      .filter((c) => c.totalCents > 0);

    if (charges.length === 0) {
      throw new Error('No tenant has a rent rate covering this period.');
    }

    const totalCents = charges.reduce((sum, c) => sum + c.totalCents, 0);

    const { data: bill, error: billError } = await supabase
      .from('bills')
      .insert({
        property_id: propertyId,
        bill_type: 'rent',
        total_amount: totalCents / 100,
        billing_period_start: periodStart,
        billing_period_end: periodEnd,
        due_date: dueDate || null,
        landlord_id: user.id,
      })
      .select()
      .single();
    if (billError) throw billError;

    const splitsToInsert = charges.map(({ tenant, totalCents: tenantCents, segments }) => ({
      bill_id: bill.id,
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      room: tenant.room,
      number_of_occupants: tenant.number_of_occupants || 1,
      occupancy_days: segments.reduce((s, seg) => s + seg.days, 0),
      person_days: segments.reduce((s, seg) => s + seg.days, 0),
      percentage: Math.round((tenantCents / totalCents) * 10000) / 100,
      owed_amount: tenantCents / 100,
      occupancy_start: periodStart,
      occupancy_end: periodEnd,
      landlord_id: user.id,
      rate_breakdown: segments,
    }));

    const { data: insertedSplits, error: splitsError } = await supabase
      .from('bill_splits')
      .insert(splitsToInsert)
      .select();
    if (splitsError) throw splitsError;

    setBills((prev) => [bill, ...prev]);
    setBillSplits((prev) => [...prev, ...insertedSplits]);
    return { bill, splits: insertedSplits };
  };

  const deleteBill = async (billId) => {
    const bill = bills.find((b) => b.id === billId);
    if (bill?.attachment_path) {
      await supabase.storage.from('bill-attachments').remove([bill.attachment_path]);
    }
    const { error } = await supabase.from('bills').delete().eq('id', billId);
    if (error) throw error;
    setBills((prev) => prev.filter((b) => b.id !== billId));
    setBillSplits((prev) => prev.filter((s) => s.bill_id !== billId));
  };

  const setBillSplitStatus = async (splitId, status) => {
    const updates = { status };
    if (status === 'paid') updates.paid_at = new Date().toISOString();
    if (status === 'pending') {
      updates.paid_at = null;
      updates.viewed_at = null;
    }
    const { data, error } = await supabase
      .from('bill_splits')
      .update(updates)
      .eq('id', splitId)
      .select()
      .single();
    if (error) throw error;
    setBillSplits((prev) => prev.map((s) => (s.id === splitId ? data : s)));
    return data;
  };

  const sendBillEmail = async (splitId) => {
    const { data, error } = await supabase.functions.invoke('send-bill-email', {
      body: { splitId },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    setBillSplits((prev) =>
      prev.map((s) => (s.id === splitId ? { ...s, email_sent_at: new Date().toISOString() } : s))
    );
    return data;
  };

  // Rotates a tenant's access_token so any previously shared link stops
  // working immediately — for a lost device, a mistaken recipient, etc.
  const revokeSplitToken = async (splitId) => {
    const { data: newToken, error } = await supabase.rpc('revoke_bill_split_token', { p_split_id: splitId });
    if (error) throw error;
    setBillSplits((prev) => prev.map((s) => (s.id === splitId ? { ...s, access_token: newToken } : s)));
    return newToken;
  };

  const uploadBillAttachment = async (billId, file) => {
    const extension = file.name.split('.').pop();
    const path = `${billId}/${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage.from('bill-attachments').upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      .from('bills')
      .update({ attachment_path: path, attachment_name: file.name, attachment_type: file.type })
      .eq('id', billId)
      .select()
      .single();
    if (error) throw error;

    setBills((prev) => prev.map((b) => (b.id === billId ? data : b)));
    return data;
  };

  const removeBillAttachment = async (billId) => {
    const bill = bills.find((b) => b.id === billId);
    if (bill?.attachment_path) {
      await supabase.storage.from('bill-attachments').remove([bill.attachment_path]);
    }
    const { data, error } = await supabase
      .from('bills')
      .update({ attachment_path: null, attachment_name: null, attachment_type: null })
      .eq('id', billId)
      .select()
      .single();
    if (error) throw error;
    setBills((prev) => prev.map((b) => (b.id === billId ? data : b)));
    return data;
  };

  // Bucket is private now (P0-6 fix), so the landlord gets a short-lived
  // signed URL via their own authenticated session (owner-scoped RLS).
  const getBillAttachmentSignedUrl = async (attachmentPath) => {
    if (!attachmentPath) return null;
    const { data, error } = await supabase.storage
      .from('bill-attachments')
      .createSignedUrl(attachmentPath, 3600);
    if (error) throw error;
    return data.signedUrl;
  };

  const value = {
    properties,
    tenants,
    bills,
    billSplits,
    rentRates,
    loading,
    refresh,
    setBillSplitStatus,
    sendBillEmail,
    revokeSplitToken,
    uploadBillAttachment,
    removeBillAttachment,
    getBillAttachmentSignedUrl,
    createProperty,
    updateProperty,
    deleteProperty,
    createTenant,
    updateTenant,
    deleteTenant,
    reactivateTenant,
    createBillWithSplits,
    updateBill,
    recalculateBill,
    deleteBill,
    addRentRate,
    deleteRentRate,
    createRentBill,
  };

  return (
    <PropertyContext.Provider value={value}>
      {children}
    </PropertyContext.Provider>
  );
};
