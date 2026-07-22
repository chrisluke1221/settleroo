import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Receipt, Calendar, Users, CalendarDays, Paperclip, Mail } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import TenantShell from '../components/TenantShell';
import Money from '../components/Money';

const TenantBillView = () => {
  const { token } = useParams();
  const [split, setSplit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: rpcError } = await supabase.rpc('get_bill_split_by_token', { p_token: token });
    if (rpcError || !data || data.length === 0) {
      setError('This bill link is invalid or has expired.');
      setLoading(false);
      return;
    }
    setSplit(data[0]);
    setLoading(false);

    // A logged-in session here is the landlord previewing their own link —
    // don't let that flip pending -> viewed, since tenants never have
    // accounts and the "viewed" signal only means something if it's real.
    const { data: sessionData } = await supabase.auth.getSession();
    if (data[0].status === 'pending' && !sessionData?.session) {
      await supabase.rpc('mark_bill_split_viewed', { p_token: token });
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleConfirmPaid = async () => {
    setConfirming(true);
    const { error: rpcError } = await supabase.rpc('mark_bill_split_paid', { p_token: token });
    if (!rpcError) {
      setSplit((prev) => ({ ...prev, status: 'paid', paid_at: new Date().toISOString() }));
    }
    setConfirming(false);
  };

  const [openingAttachment, setOpeningAttachment] = useState(false);
  const handleViewAttachment = async () => {
    setOpeningAttachment(true);
    const { data, error: fnError } = await supabase.functions.invoke('get-bill-attachment-url', {
      body: { token },
    });
    setOpeningAttachment(false);
    if (fnError || data?.error || !data?.url) {
      console.error('Failed to open attachment:', fnError || data?.error);
      return;
    }
    window.open(data.url, '_blank', 'noopener,noreferrer');
  };

  const noindexHelmet = (
    <Helmet defer={false}>
      <meta name="robots" content="noindex" />
    </Helmet>
  );

  if (loading) {
    return (
      <TenantShell>
        {noindexHelmet}
        <p className="text-secondary-600">Loading...</p>
      </TenantShell>
    );
  }

  if (error) {
    return (
      <TenantShell>
        {noindexHelmet}
        <div className="card max-w-md w-full text-center">
          <p className="text-danger-600">{error}</p>
        </div>
      </TenantShell>
    );
  }

  const totalPersonDays = split.bill_total_person_days;
  const otherTenantCount = split.bill_tenant_count - 1;

  return (
    <TenantShell propertyName={split.property_name} landlordName={split.landlord_name}>
      {noindexHelmet}
      <div className="card max-w-lg w-full">
        <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
          <Receipt className="w-6 h-6 text-primary-600" />
        </div>
        <h1 className="text-2xl font-bold text-secondary-900 capitalize mb-1">{split.bill_type} Bill</h1>
        <p className="text-secondary-600 mb-1">
          Billing period: {split.billing_period_start} to {split.billing_period_end}
        </p>
        <p className="text-secondary-500 text-sm mb-6">Hi {split.tenant_name}, here's exactly how your share was calculated.</p>

        {/* Headline amount */}
        <div className="bg-primary-50 border border-primary-100 rounded-lg p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-secondary-600">You owe</p>
            <Money dollars={split.owed_amount} as="p" className="text-3xl text-primary-700" />
          </div>
          <div className="text-right">
            <p className="text-sm text-secondary-600">of total bill</p>
            <Money dollars={split.total_amount} as="p" className="text-lg text-secondary-900" />
          </div>
        </div>

        {/* Step-by-step calculation */}
        <div className="border border-secondary-200 rounded-lg overflow-hidden mb-6">
          <div className="bg-secondary-50 px-4 py-2 border-b border-secondary-200">
            <p className="text-xs font-semibold text-secondary-600 uppercase tracking-wide">How this was calculated</p>
          </div>
          {split.rate_breakdown ? (
            <div className="divide-y divide-secondary-100 text-sm">
              {split.rate_breakdown.map((seg, i) => (
                <div key={i} className="flex items-start justify-between px-4 py-3">
                  <div className="flex items-start space-x-2">
                    <CalendarDays className="w-4 h-4 text-secondary-400 mt-0.5" />
                    <div>
                      <p className="text-secondary-900 font-medium">
                        <Money cents={seg.amountCents} className="text-secondary-900" />/{seg.frequency} rate
                      </p>
                      <p className="text-secondary-500">
                        {seg.from} to {seg.to} ({seg.days} day{seg.days === 1 ? '' : 's'})
                      </p>
                    </div>
                  </div>
                  <Money cents={seg.cents} className="text-secondary-900 whitespace-nowrap" />
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-3 bg-secondary-50">
                <span className="text-secondary-700">Total rent for this period</span>
                <Money dollars={split.owed_amount} className="text-primary-700 whitespace-nowrap" />
              </div>
            </div>
          ) : (
            <div className="divide-y divide-secondary-100 text-sm">
              {otherTenantCount > 0 && (
                <div className="flex items-start justify-between px-4 py-3">
                  <div className="flex items-start space-x-2">
                    <Users className="w-4 h-4 text-secondary-400 mt-0.5" />
                    <div>
                      <p className="text-secondary-900 font-medium">
                        Sharing this bill with {otherTenantCount} other tenant{otherTenantCount === 1 ? '' : 's'}
                      </p>
                      <p className="text-secondary-500">
                        Everyone pays for the exact days they lived here, not a flat split — so your share
                        depends on how long you (and each other tenant) were here this period.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-start justify-between px-4 py-3">
                <div className="flex items-start space-x-2">
                  <CalendarDays className="w-4 h-4 text-secondary-400 mt-0.5" />
                  <div>
                    <p className="text-secondary-900 font-medium">Your occupancy in this bill period</p>
                    <p className="text-secondary-500">{split.occupancy_start} to {split.occupancy_end}</p>
                  </div>
                </div>
                <span className="font-medium text-secondary-900 whitespace-nowrap tabular-nums">{split.occupancy_days} days</span>
              </div>

              <div className="flex items-start justify-between px-4 py-3">
                <div className="flex items-start space-x-2">
                  <Users className="w-4 h-4 text-secondary-400 mt-0.5" />
                  <div>
                    <p className="text-secondary-900 font-medium">Occupants in your room</p>
                    <p className="text-secondary-500">Room: {split.room}</p>
                  </div>
                </div>
                <span className="font-medium text-secondary-900 whitespace-nowrap tabular-nums">{split.number_of_occupants}</span>
              </div>

              <div className="flex items-center justify-between px-4 py-3 bg-secondary-50">
                <span className="text-secondary-700">
                  Your days this period = {split.occupancy_days} days &times; {split.number_of_occupants} occupant
                  {split.number_of_occupants === 1 ? '' : 's'}
                </span>
                <span className="font-semibold text-secondary-900 whitespace-nowrap tabular-nums">{split.person_days}</span>
              </div>

              {Array.isArray(split.peer_splits) && split.peer_splits.length > 1 && (
                <div className="px-4 py-3">
                  <p className="text-xs font-semibold text-secondary-600 uppercase tracking-wide mb-2">
                    Everyone's days this period
                  </p>
                  <div className="space-y-1.5">
                    {split.peer_splits.map((peer) => {
                      const isYou = peer.id === split.id;
                      return (
                        <div key={peer.id} className="flex items-center justify-between text-sm">
                          <span className={isYou ? 'font-semibold text-secondary-900' : 'text-secondary-700'}>
                            {isYou ? 'You' : peer.tenant_name}
                          </span>
                          <span className="text-secondary-500">
                            {peer.occupancy_days} day{peer.occupancy_days === 1 ? '' : 's'}
                          </span>
                          <span className="font-medium text-secondary-900 tabular-nums">{peer.percentage}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between px-4 py-3 bg-secondary-50">
                <span className="text-secondary-700">
                  Your share = {split.person_days} &divide; {totalPersonDays} (everyone's days added together)
                </span>
                <span className="font-semibold text-secondary-900 whitespace-nowrap tabular-nums">{split.percentage}%</span>
              </div>

              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-secondary-700">
                  Your amount = {split.percentage}% &times; <Money dollars={split.total_amount} />
                </span>
                <Money dollars={split.owed_amount} className="text-primary-700 whitespace-nowrap" />
              </div>
            </div>
          )}
        </div>

        {split.due_date && (
          <p className="flex items-center text-sm text-secondary-600 mb-4">
            <Calendar className="w-4 h-4 mr-2" />
            Due {split.due_date}
          </p>
        )}

        {split.attachment_path && (
          <button
            onClick={handleViewAttachment}
            disabled={openingAttachment}
            className="flex items-center text-sm text-primary-600 hover:text-primary-700 mb-6 disabled:opacity-50"
          >
            <Paperclip className="w-4 h-4 mr-2" />
            {openingAttachment ? 'Opening...' : `View original bill (${split.attachment_name || 'attachment'})`}
          </button>
        )}

        <AnimatePresence mode="wait">
          {split.status === 'paid' ? (
            <motion.div
              key="paid"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              className="flex items-center justify-center space-x-2 bg-success-50 border border-success-100 rounded-lg py-3"
            >
              <CheckCircle className="w-5 h-5 text-success-600" />
              <span className="text-success-700 font-medium">You've confirmed this as paid</span>
            </motion.div>
          ) : (
            <motion.button
              key="unpaid"
              onClick={handleConfirmPaid}
              disabled={confirming}
              className="btn-primary w-full flex items-center justify-center space-x-2"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{confirming ? 'Confirming...' : "I've Paid This"}</span>
            </motion.button>
          )}
        </AnimatePresence>

        <p className="text-xs text-secondary-400 mt-4 text-center">
          This confirms you've settled the amount directly with your landlord (e.g. bank transfer). It does not
          process a payment.
        </p>

        {split.landlord_email && (
          <p className="text-center mt-3">
            <a
              href={`mailto:${split.landlord_email}?subject=${encodeURIComponent(`Question about my ${split.bill_type} bill`)}`}
              className="inline-flex items-center text-xs text-secondary-500 hover:text-primary-600"
            >
              <Mail className="w-3 h-3 mr-1" />
              Something look wrong? Email {split.landlord_name}
            </a>
          </p>
        )}
      </div>
    </TenantShell>
  );
};

export default TenantBillView;
