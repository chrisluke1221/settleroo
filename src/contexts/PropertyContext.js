import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';
import { computeSplits } from '../lib/billSplit';
import { computeRentForPeriod, ratesOverlap, findOverlappingRate } from '../lib/rentCalc';
import { formatLocalDate } from '../lib/dates';
import { EntitlementError } from '../lib/entitlements';

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
  const [landlordSettings, setLandlordSettings] = useState({ notify_overdue: true, notify_rent: true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Set when a plan limit blocks an action; the global UpgradeModal renders
  // from this. Cleared on dismiss.
  const [entitlementBlock, setEntitlementBlock] = useState(null);

  // The single client-side gate for plan limits. The RPC is the enforcement
  // point (server-side, security definer); this helper calls it at the
  // moment of the action, and on a block both surfaces the upgrade modal
  // and throws so the calling flow stops. Applied to the three PRD-named
  // actions only: property create, tenant create, bill create. The
  // automatic rent-bill catch-up is deliberately not gated — charging rent
  // that's already owed is core behavior, not new usage.
  const requireEntitlement = async (key) => {
    const { data, error: rpcError } = await supabase.rpc('check_entitlement', { p_key: key });
    if (rpcError) throw rpcError;
    if (!data?.allowed) {
      setEntitlementBlock(data);
      throw new EntitlementError(data);
    }
    return data;
  };

  const clearEntitlementBlock = () => setEntitlementBlock(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setProperties([]);
      setTenants([]);
      setBills([]);
      setBillSplits([]);
      setRentRates([]);
      setLandlordSettings({ notify_overdue: true, notify_rent: true });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [
        { data: propertiesData, error: propertiesError },
        { data: tenantsData, error: tenantsError },
        { data: billsData, error: billsError },
        { data: billSplitsData, error: billSplitsError },
        { data: rentRatesData, error: rentRatesError },
        { data: settingsData },
      ] = await Promise.all([
        supabase.from('properties').select('*').order('created_at', { ascending: false }),
        supabase.from('tenants').select('*').order('created_at', { ascending: false }),
        supabase.from('bills').select('*').order('created_at', { ascending: false }),
        supabase.from('bill_splits').select('*'),
        supabase.from('rent_rates').select('*').order('effective_from', { ascending: true }),
        supabase.from('landlord_settings').select('*').maybeSingle(),
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
      // No row yet just means the landlord never changed the defaults —
      // both toggles default to on until explicitly changed.
      const settings = settingsData ?? { notify_overdue: true, notify_rent: true };
      setLandlordSettings(settings);

      // Catch up on any rent that should have been generated since last
      // login — passes the just-fetched arrays directly rather than reading
      // state, since setX() above hasn't landed in this closure yet.
      await generateDueRentBills({
        properties: propertiesData ?? [],
        tenants: tenantsData ?? [],
        bills: billsData ?? [],
        rentRates: rentRatesData ?? [],
        settings,
      });
    } catch (err) {
      console.error('Failed to load property data:', err);
      setError(err.message || 'Failed to load your data');
    } finally {
      setLoading(false);
    }
    // generateDueRentBills (like every other helper in this file besides
    // refresh) is a plain function recreated each render, not memoized —
    // it's intentionally not in this dependency list, same as every other
    // context function this file calls without listing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const setNotifyOverdue = async (enabled) => {
    const { data, error } = await supabase
      .from('landlord_settings')
      .upsert({ landlord_id: user.id, notify_overdue: enabled }, { onConflict: 'landlord_id' })
      .select()
      .single();
    if (error) throw error;
    setLandlordSettings(data);
    return data;
  };

  const setNotifyRent = async (enabled) => {
    const { data, error } = await supabase
      .from('landlord_settings')
      .upsert({ landlord_id: user.id, notify_rent: enabled }, { onConflict: 'landlord_id' })
      .select()
      .single();
    if (error) throw error;
    setLandlordSettings(data);
    return data;
  };

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createProperty = async ({ name, address, description }) => {
    await requireEntitlement('max_properties');
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
    // Tenants and bills cascade-delete at the DB, but their attachment files
    // live in storage and would orphan — remove those first.
    const attachmentPaths = bills
      .filter((b) => b.property_id === propertyId && b.attachment_path)
      .map((b) => b.attachment_path);
    if (attachmentPaths.length > 0) {
      await supabase.storage.from('bill-attachments').remove(attachmentPaths);
    }
    const { error } = await supabase.from('properties').delete().eq('id', propertyId);
    if (error) throw error;
    setProperties((prev) => prev.filter((p) => p.id !== propertyId));
    setTenants((prev) => prev.filter((t) => t.property_id !== propertyId));
    setBills((prev) => prev.filter((b) => b.property_id !== propertyId));
  };

  // Ground truth for "who's on this property right now" at a point in time,
  // used instead of the `tenants` closure wherever a roster-changing action
  // needs the up-to-date list within the same function call (see the comment
  // in createTenant below for why the closure can't be trusted there).
  const fetchTenantsForProperty = async (propertyId, fallbackRow) => {
    const { data, error } = await supabase.from('tenants').select('*').eq('property_id', propertyId);
    if (error || !data) return fallbackRow ? [fallbackRow] : [];
    return data;
  };

  // rentAmountCents/rentFrequency are optional — set on the tenant-create
  // form so a landlord does rent + tenant data entry in one pass. Inserted
  // directly (not via addRentRate) since this is always a tenant's first
  // rate: no overlap/auto-close logic needed, effective_from is just the
  // move-in date.
  const createTenant = async ({
    propertyId,
    name,
    email,
    phone,
    room,
    moveInDate,
    moveOutDate,
    numberOfOccupants,
    rentAmountCents,
    rentFrequency,
  }) => {
    await requireEntitlement('max_active_tenants');
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

    if (rentAmountCents) {
      const { data: rate, error: rateError } = await supabase
        .from('rent_rates')
        .insert({
          tenant_id: data.id,
          landlord_id: user.id,
          amount_cents: rentAmountCents,
          frequency: rentFrequency || 'monthly',
          effective_from: moveInDate,
        })
        .select()
        .single();
      if (rateError) throw rateError;
      setRentRates((prev) => [...prev, rate]);
    }

    setTenants((prev) => [data, ...prev]);
    // Fetch the roster fresh rather than trusting this closure's `tenants` —
    // callers that create several tenants in one function call (loadSampleProperty)
    // would otherwise have each call race the previous one's still-pending
    // setTenants, since a long-running async function keeps its own frozen
    // reference to `tenants` for its whole execution regardless of re-renders.
    const currentRoster = await fetchTenantsForProperty(propertyId, data);
    await recalcUnlockedBillsForProperty(propertyId, currentRoster);
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
    const currentRoster = await fetchTenantsForProperty(data.property_id, data);
    await recalcUnlockedBillsForProperty(data.property_id, currentRoster);
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
    const tenant = tenants.find((t) => t.id === tenantId);
    const { error } = await supabase.from('tenants').delete().eq('id', tenantId);
    if (error) throw error;
    setTenants((prev) => prev.filter((t) => t.id !== tenantId));
    if (tenant) {
      const currentRoster = (await fetchTenantsForProperty(tenant.property_id)).filter((t) => t.id !== tenantId);
      await recalcUnlockedBillsForProperty(tenant.property_id, currentRoster);
    }
    return null;
  };

  const reactivateTenant = async (tenantId) => updateTenant(tenantId, { status: 'active' });

  // tenantList override exists for callers (like loadSampleProperty) that
  // create tenants and immediately bill them in the same function — the
  // context's `tenants` closure won't include those until the next render.
  const createBillWithSplits = async ({ propertyId, billType, totalAmount, periodStart, periodEnd, dueDate, tenantList = tenants }) => {
    await requireEntitlement('max_bills_per_month');
    const propertyTenants = tenantList.filter((t) => t.property_id === propertyId && t.status !== 'former');
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

  // Shared by recalculateBill, updateBill, and the roster-change auto-recalc:
  // recompute a bill's splits against its current field values and the
  // current active tenant list, updating matching tenant rows in place
  // (keeps id/access_token/status) and only inserting/deleting for tenants
  // that actually changed. tenantList defaults to context state, but callers
  // reacting to a just-applied tenant change pass the updated array directly
  // — setTenants() doesn't land in this closure's `tenants` until next render.
  const applyRecomputedSplits = async (bill, tenantList = tenants) => {
    const existingSplits = billSplits.filter((s) => s.bill_id === bill.id);
    const propertyTenants = tenantList.filter((t) => t.property_id === bill.property_id && t.status !== 'former');
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

  // Called after any tenant roster change (add/edit/archive/delete). A
  // utility bill that's still an unsent draft (locked_at null) recomputes
  // live — this is what fixes "added tenant 2, bill still shows 100% for
  // tenant 1". A locked (already-sent) bill never auto-recomputes; instead
  // it's flagged needs_reissue so the landlord sees a banner and reissues
  // explicitly. A bill with any paid split is never touched either way.
  // Rent bills aren't in scope — rent has no shared-split roster to react to.
  const recalcUnlockedBillsForProperty = async (propertyId, tenantList = tenants) => {
    const propertyBills = bills.filter((b) => b.property_id === propertyId && b.bill_type !== 'rent');
    for (const bill of propertyBills) {
      const splits = billSplits.filter((s) => s.bill_id === bill.id);
      if (splits.some((s) => s.status === 'paid')) continue;

      if (bill.locked_at) {
        if (!bill.needs_reissue) {
          const { data, error } = await supabase
            .from('bills')
            .update({ needs_reissue: true })
            .eq('id', bill.id)
            .select()
            .single();
          if (!error) setBills((prev) => prev.map((b) => (b.id === bill.id ? data : b)));
        }
      } else {
        await applyRecomputedSplits(bill, tenantList);
      }
    }
  };

  // Explicit landlord action once a locked bill's roster has drifted
  // (needs_reissue) — recomputes against the current roster and clears the
  // flag. Same paid-split guard as recalculateBill/updateBill.
  const reissueBill = async (billId) => {
    const bill = bills.find((b) => b.id === billId);
    if (!bill) throw new Error('Bill not found');
    const existingSplits = billSplits.filter((s) => s.bill_id === billId);
    if (existingSplits.some((s) => s.status === 'paid')) {
      throw new Error('This bill has a payment already confirmed — it can no longer be reissued.');
    }
    await applyRecomputedSplits(bill);
    const { data, error } = await supabase
      .from('bills')
      .update({ needs_reissue: false })
      .eq('id', billId)
      .select()
      .single();
    if (error) throw error;
    setBills((prev) => prev.map((b) => (b.id === billId ? data : b)));
    return data;
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

  // due_date doesn't affect split amounts, so it stays editable even once a
  // split has been paid — unlike updateBill above, which guards every field
  // to protect the number a tenant may already be looking at. Most rent
  // bills are auto-generated with due_date: null (see
  // generateDueRentBillsInner), so this is the only way to add one later.
  const updateBillDueDate = async (billId, dueDate) => {
    const { data: updatedBill, error } = await supabase
      .from('bills')
      .update({ due_date: dueDate || null })
      .eq('id', billId)
      .select()
      .single();
    if (error) throw error;
    setBills((prev) => prev.map((b) => (b.id === billId ? updatedBill : b)));
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
      const conflict = findOverlappingRate(ratesForOverlapCheck, effectiveFrom, null);
      const conflictRange = conflict
        ? `${conflict.effective_from} to ${conflict.effective_to || 'ongoing'}`
        : 'an existing rate';
      throw new Error(
        `This overlaps the existing rate from ${conflictRange}. Delete or adjust that rate below, then try again.`
      );
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
  //
  // A rate's own effective_to window isn't enough on its own — a tenant who
  // moves out without their rate being explicitly end-dated would otherwise
  // keep being charged forever. Every rent computation clamps the period to
  // the tenant's move_out_date as well as the rate's own window.
  //
  // Symmetrically, clamp the start to move_in_date rather than trusting a
  // rate's effective_from alone: addRentRate blocks a *new* rate from
  // starting before move-in, but editing a tenant's move_in_date afterward
  // doesn't retroactively touch already-existing rates, so without this
  // clamp a corrected move-in date can leave stale rate coverage that bills
  // for days before the tenant actually lived there.
  const buildRentCharges = (propertyTenants, rentRatesList, periodStart, periodEnd) => {
    return propertyTenants
      .map((tenant) => {
        const tenantRates = rentRatesList.filter((r) => r.tenant_id === tenant.id);
        const clampedStart =
          tenant.move_in_date && tenant.move_in_date > periodStart ? tenant.move_in_date : periodStart;
        const clampedEnd =
          tenant.move_out_date && tenant.move_out_date < periodEnd ? tenant.move_out_date : periodEnd;
        if (clampedEnd < clampedStart) return { tenant, totalCents: 0, segments: [] };
        const { totalCents, segments } = computeRentForPeriod(tenantRates, clampedStart, clampedEnd);
        return { tenant, totalCents, segments };
      })
      .filter((c) => c.totalCents > 0);
  };

  const insertRentBillRow = async (propertyId, periodStart, periodEnd, dueDate, charges) => {
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

  // Manual, landlord-triggered generation for an arbitrary period — kept
  // alongside the automatic monthly generation below for backfilling history
  // or an out-of-cycle charge.
  const createRentBill = async ({ propertyId, periodStart, periodEnd, dueDate }) => {
    await requireEntitlement('max_bills_per_month');
    const propertyTenants = tenants.filter((t) => t.property_id === propertyId && t.status !== 'former');
    const charges = buildRentCharges(propertyTenants, rentRates, periodStart, periodEnd);
    if (charges.length === 0) {
      throw new Error('No tenant has a rent rate covering this period.');
    }
    return insertRentBillRow(propertyId, periodStart, periodEnd, dueDate, charges);
  };

  // Guards against React StrictMode's dev-mode double-invoke of the mount
  // effect (both calls would otherwise see "no bill for this period yet" and
  // both insert) — a fast-path skip for the common case. The database's
  // bills_unique_rent_period index is the real safety net (covers e.g. two
  // browser tabs racing in production, which this ref can't see).
  const rentGenerationInFlight = useRef(false);

  // Runs once per login (from refresh, with freshly-fetched data rather than
  // this closure's state — see the comment in refresh()). For each property,
  // auto-generates any missing calendar-month rent bill from the current
  // month back up to 3 months, so a landlord catches up even after a while
  // away. Stops charging a tenant from their move-out date via
  // buildRentCharges; picks up a new rate automatically since it just reads
  // whatever rate is in force for each day. Silently skips a property/period
  // with nothing billable (no active tenant has a rate covering it yet).
  const generateDueRentBills = async ({ properties: propsList, tenants: tenantsList, bills: billsList, rentRates: ratesList, settings }) => {
    if (rentGenerationInFlight.current) return;
    rentGenerationInFlight.current = true;
    try {
      await generateDueRentBillsInner({ propsList, tenantsList, billsList, ratesList, settings });
    } finally {
      rentGenerationInFlight.current = false;
    }
  };

  const generateDueRentBillsInner = async ({ propsList, tenantsList, billsList, ratesList, settings }) => {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periods = [];
    for (let i = 3; i >= 0; i--) {
      const start = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() - i, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      periods.push({ start: formatLocalDate(start), end: formatLocalDate(end) });
    }

    for (const property of propsList) {
      const propertyTenants = tenantsList.filter((t) => t.property_id === property.id && t.status !== 'former');
      if (propertyTenants.length === 0) continue;

      for (const period of periods) {
        const alreadyExists = billsList.some(
          (b) =>
            b.property_id === property.id &&
            b.bill_type === 'rent' &&
            b.billing_period_start === period.start &&
            b.billing_period_end === period.end
        );
        if (alreadyExists) continue;

        const charges = buildRentCharges(propertyTenants, ratesList, period.start, period.end);
        if (charges.length === 0) continue;

        let inserted;
        try {
          inserted = await insertRentBillRow(property.id, period.start, period.end, null, charges);
        } catch (err) {
          if (err.code === '23505') {
            // Another concurrent run (StrictMode's double-invoke, or a
            // second tab) already created this exact period's bill — the
            // database's bills_unique_rent_period index is the real guard
            // here, this is the expected, benign outcome of losing the race.
          } else {
            console.error('Failed to auto-generate rent bill:', err);
          }
          continue;
        }
        // Reflect this period's bill in the list we're iterating so a later
        // loop iteration (next property, or a future call) doesn't re-check
        // against stale data within this same run.
        billsList = [...billsList, inserted.bill];

        if (settings?.notify_rent !== false) {
          for (const split of inserted.splits) {
            const tenant = propertyTenants.find((t) => t.id === split.tenant_id);
            if (!tenant?.email) continue;
            try {
              await sendBillEmail(split.id);
            } catch (err) {
              console.error('Failed to auto-send rent bill email:', err);
            }
          }
        }
      }
    }
  };

  // The 60-second aha: a fully-formed property with two tenants (staggered
  // move-in dates, so the split visibly isn't 50/50) and one utility bill
  // already split — so a new landlord sees the breakdown card before typing
  // anything. Uses last month as the bill period so it's always plausible
  // regardless of when this runs.
  const loadSampleProperty = async () => {
    const now = new Date();
    const periodEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
    const periodStartDate = new Date(periodEndDate.getFullYear(), periodEndDate.getMonth(), 1);
    const midDate = new Date(periodStartDate);
    midDate.setDate(15);
    const fmt = formatLocalDate;

    const property = await createProperty({
      name: 'Sample Share House',
      address: '12 Example Street, Melbourne',
      description: 'A sample property showing how Settleroo splits a bill fairly — delete any time.',
    });

    const alice = await createTenant({
      propertyId: property.id,
      name: 'Alice (sample)',
      email: '',
      phone: '',
      room: 'Room 1',
      moveInDate: fmt(periodStartDate),
      moveOutDate: '',
      numberOfOccupants: 1,
    });
    const bob = await createTenant({
      propertyId: property.id,
      name: 'Bob (sample)',
      email: '',
      phone: '',
      room: 'Room 2',
      moveInDate: fmt(midDate),
      moveOutDate: '',
      numberOfOccupants: 1,
    });

    await createBillWithSplits({
      propertyId: property.id,
      billType: 'electricity',
      totalAmount: 120,
      periodStart: fmt(periodStartDate),
      periodEnd: fmt(periodEndDate),
      dueDate: null,
      tenantList: [alice, bob],
    });

    return property;
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

    // First send locks a utility bill's split — from here, roster changes
    // flag needs_reissue instead of silently rewriting a number the tenant
    // may already be looking at.
    const split = billSplits.find((s) => s.id === splitId);
    const bill = split && bills.find((b) => b.id === split.bill_id);
    if (bill && bill.bill_type !== 'rent' && !bill.locked_at) {
      const { data: lockedBill, error: lockError } = await supabase
        .from('bills')
        .update({ locked_at: new Date().toISOString() })
        .eq('id', bill.id)
        .select()
        .single();
      if (!lockError) setBills((prev) => prev.map((b) => (b.id === bill.id ? lockedBill : b)));
    }
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
    landlordSettings,
    setNotifyOverdue,
    setNotifyRent,
    loading,
    error,
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
    loadSampleProperty,
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
    addRentRate,
    deleteRentRate,
    createRentBill,
    entitlementBlock,
    clearEntitlementBlock,
  };

  return (
    <PropertyContext.Provider value={value}>
      {children}
    </PropertyContext.Provider>
  );
};
