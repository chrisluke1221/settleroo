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

  const deleteTenant = async (tenantId) => {
    const { error } = await supabase.from('tenants').delete().eq('id', tenantId);
    if (error) throw error;
    setTenants((prev) => prev.filter((t) => t.id !== tenantId));
  };

  const createBillWithSplits = async ({ propertyId, billType, totalAmount, periodStart, periodEnd }) => {
    const propertyTenants = tenants.filter((t) => t.property_id === propertyId);
    if (propertyTenants.length === 0) {
      throw new Error('This property has no tenants to split the bill across.');
    }

    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    const perTenantDays = propertyTenants.map((tenant) => {
      const moveIn = new Date(tenant.move_in_date);
      const moveOut = tenant.move_out_date ? new Date(tenant.move_out_date) : null;
      const occStart = moveIn > start ? moveIn : start;
      const occEnd = moveOut && moveOut < end ? moveOut : end;
      const occupancyDays = Math.max(0, Math.round((occEnd - occStart) / 86400000) + 1);
      const personDays = occupancyDays * (tenant.number_of_occupants || 1);
      return { tenant, occStart, occEnd, occupancyDays, personDays };
    });

    const totalPersonDays = perTenantDays.reduce((sum, t) => sum + t.personDays, 0);
    if (totalPersonDays === 0) {
      throw new Error('No tenant occupancy overlaps this billing period.');
    }

    const { data: bill, error: billError } = await supabase
      .from('bills')
      .insert({
        bill_type: billType,
        total_amount: totalAmount,
        billing_period_start: periodStart,
        billing_period_end: periodEnd,
        landlord_id: user.id,
      })
      .select()
      .single();
    if (billError) throw billError;

    const splitsToInsert = perTenantDays.map(({ tenant, occStart, occEnd, occupancyDays, personDays }) => ({
      bill_id: bill.id,
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
      landlord_id: user.id,
    }));

    const { data: splits, error: splitsError } = await supabase
      .from('bill_splits')
      .insert(splitsToInsert)
      .select();
    if (splitsError) throw splitsError;

    setBills((prev) => [bill, ...prev]);
    setBillSplits((prev) => [...prev, ...splits]);
    return { bill, splits };
  };

  const deleteBill = async (billId) => {
    const { error } = await supabase.from('bills').delete().eq('id', billId);
    if (error) throw error;
    setBills((prev) => prev.filter((b) => b.id !== billId));
    setBillSplits((prev) => prev.filter((s) => s.bill_id !== billId));
  };

  const value = {
    properties,
    tenants,
    bills,
    billSplits,
    loading,
    refresh,
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
