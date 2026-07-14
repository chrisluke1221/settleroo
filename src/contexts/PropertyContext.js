import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';

const PropertyContext = createContext();

export const useProperties = () => {
  const context = useContext(PropertyContext);
  if (!context) {
    throw new Error('useProperties must be used within a PropertyProvider');
  }
  return context;
};

const computeSplits = (propertyTenants, periodStart, periodEnd, totalAmount) => {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);

  const perTenantDays = propertyTenants
    .map((tenant) => {
      const moveIn = new Date(tenant.move_in_date);
      const moveOut = tenant.move_out_date ? new Date(tenant.move_out_date) : null;
      const occStart = moveIn > start ? moveIn : start;
      const occEnd = moveOut && moveOut < end ? moveOut : end;
      const occupancyDays = Math.max(0, Math.round((occEnd - occStart) / 86400000) + 1);
      const personDays = occupancyDays * (tenant.number_of_occupants || 1);
      return { tenant, occStart, occEnd, occupancyDays, personDays };
    })
    .filter((t) => t.personDays > 0);

  const totalPersonDays = perTenantDays.reduce((sum, t) => sum + t.personDays, 0);
  if (totalPersonDays === 0) return [];

  return perTenantDays.map(({ tenant, occStart, occEnd, occupancyDays, personDays }) => ({
    tenant_id: tenant.id,
    tenant_name: tenant.name,
    room: tenant.room,
    number_of_occupants: tenant.number_of_occupants || 1,
    occupancy_days: occupancyDays,
    person_days: personDays,
    percentage: Math.round((personDays / totalPersonDays) * 10000) / 100,
    owed_amount: Math.round((personDays / totalPersonDays) * totalAmount * 100) / 100,
    occupancy_start: occStart.toISOString().slice(0, 10),
    occupancy_end: occEnd.toISOString().slice(0, 10),
  }));
};

export const PropertyProvider = ({ children }) => {
  const { user } = useAuth();
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [bills, setBills] = useState([]);
  const [billSplits, setBillSplits] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setProperties([]);
      setTenants([]);
      setBills([]);
      setBillSplits([]);
      return;
    }
    setLoading(true);
    const [
      { data: propertiesData, error: propertiesError },
      { data: tenantsData, error: tenantsError },
      { data: billsData, error: billsError },
      { data: billSplitsData, error: billSplitsError },
    ] = await Promise.all([
      supabase.from('properties').select('*').order('created_at', { ascending: false }),
      supabase.from('tenants').select('*').order('created_at', { ascending: false }),
      supabase.from('bills').select('*').order('created_at', { ascending: false }),
      supabase.from('bill_splits').select('*'),
    ]);

    if (propertiesError) throw propertiesError;
    if (tenantsError) throw tenantsError;
    if (billsError) throw billsError;
    if (billSplitsError) throw billSplitsError;

    setProperties(propertiesData ?? []);
    setTenants(tenantsData ?? []);
    setBills(billsData ?? []);
    setBillSplits(billSplitsData ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh().catch((err) => console.error('Failed to load property data:', err));
  }, [refresh]);

  // Bills don't carry property_id directly, so a bill "belongs" to a property
  // through the tenants its existing splits point at. Any bill that already
  // splits across one of this property's tenants gets recomputed.
  const recalcBillsForProperty = async (propertyId, currentPropertyTenants) => {
    const propertyTenantIds = new Set(
      tenants.filter((t) => t.property_id === propertyId).map((t) => t.id)
    );
    const affectedBillIds = [
      ...new Set(billSplits.filter((s) => propertyTenantIds.has(s.tenant_id)).map((s) => s.bill_id)),
    ];
    if (affectedBillIds.length === 0) return;

    for (const billId of affectedBillIds) {
      const bill = bills.find((b) => b.id === billId);
      if (!bill) continue;

      const newSplits = computeSplits(
        currentPropertyTenants,
        bill.billing_period_start,
        bill.billing_period_end,
        bill.total_amount
      ).map((s) => ({ ...s, bill_id: billId, landlord_id: user.id }));

      const { error: deleteError } = await supabase.from('bill_splits').delete().eq('bill_id', billId);
      if (deleteError) throw deleteError;

      let insertedSplits = [];
      if (newSplits.length > 0) {
        const { data, error: insertError } = await supabase.from('bill_splits').insert(newSplits).select();
        if (insertError) throw insertError;
        insertedSplits = data;
      }

      setBillSplits((prev) => [...prev.filter((s) => s.bill_id !== billId), ...insertedSplits]);
    }
  };

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

  const deleteProperty = async (propertyId) => {
    const { error } = await supabase.from('properties').delete().eq('id', propertyId);
    if (error) throw error;
    setProperties((prev) => prev.filter((p) => p.id !== propertyId));
    setTenants((prev) => prev.filter((t) => t.property_id !== propertyId));
  };

  const createTenant = async ({ propertyId, name, email, phone, room, moveInDate, numberOfOccupants }) => {
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
        number_of_occupants: numberOfOccupants || 1,
      })
      .select()
      .single();
    if (error) throw error;
    setTenants((prev) => [data, ...prev]);

    const currentPropertyTenants = [...tenants.filter((t) => t.property_id === propertyId), data];
    await recalcBillsForProperty(propertyId, currentPropertyTenants).catch((err) =>
      console.error('Failed to recalculate bills after adding tenant:', err)
    );

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

    const currentPropertyTenants = tenants
      .map((t) => (t.id === tenantId ? data : t))
      .filter((t) => t.property_id === data.property_id);
    await recalcBillsForProperty(data.property_id, currentPropertyTenants).catch((err) =>
      console.error('Failed to recalculate bills after updating tenant:', err)
    );

    return data;
  };

  const deleteTenant = async (tenantId) => {
    const tenant = tenants.find((t) => t.id === tenantId);
    const { error } = await supabase.from('tenants').delete().eq('id', tenantId);
    if (error) throw error;
    setTenants((prev) => prev.filter((t) => t.id !== tenantId));

    if (tenant) {
      const currentPropertyTenants = tenants.filter(
        (t) => t.property_id === tenant.property_id && t.id !== tenantId
      );
      await recalcBillsForProperty(tenant.property_id, currentPropertyTenants).catch((err) =>
        console.error('Failed to recalculate bills after removing tenant:', err)
      );
    }
  };

  const createBillWithSplits = async ({ propertyId, billType, totalAmount, periodStart, periodEnd, dueDate }) => {
    const propertyTenants = tenants.filter((t) => t.property_id === propertyId);
    if (propertyTenants.length === 0) {
      throw new Error('This property has no tenants to split the bill across.');
    }

    const splits = computeSplits(propertyTenants, periodStart, periodEnd, totalAmount);
    if (splits.length === 0) {
      throw new Error('No tenant occupancy overlaps this billing period.');
    }

    const { data: bill, error: billError } = await supabase
      .from('bills')
      .insert({
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

  const deleteBill = async (billId) => {
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

  const value = {
    properties,
    tenants,
    bills,
    billSplits,
    loading,
    refresh,
    setBillSplitStatus,
    sendBillEmail,
    createProperty,
    deleteProperty,
    createTenant,
    updateTenant,
    deleteTenant,
    createBillWithSplits,
    deleteBill,
  };

  return (
    <PropertyContext.Provider value={value}>
      {children}
    </PropertyContext.Provider>
  );
};
