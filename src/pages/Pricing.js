import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Check, CheckCircle, Minus, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

// Public pricing page. Renders from the plans table (RLS allows anon select
// on is_public plans) rather than hardcoded copy, so repricing is a data
// change — the operator edits the row, no deploy.
//
// CHR-34 Phase C: replaced the mailto: CTA with a real Stripe Checkout button.
// The button calls the create-checkout-session edge function and redirects to
// the Stripe-hosted checkout page. On return, ?checkout=success shows a
// success banner. A "Manage billing" link calls create-portal-session for
// accounts that already have a Stripe subscription.

const TITLE = 'Pricing — Settleroo';

const FEATURE_ROWS = [
  { key: 'max_properties', label: 'Properties' },
  { key: 'max_active_tenants', label: 'Active tenants' },
  { key: '_attachments', label: 'Bill attachments' },
  { key: 'branding_removable', label: 'Remove "Powered by Settleroo" from tenant pages' },
  { key: '_ai_features', label: 'Early access to AI features as they ship' },
];

const faqs = [
  {
    q: 'What happens when I hit a limit?',
    a: "Nothing breaks and nothing is deleted. The action that would exceed the limit (adding a second property, or a fifth tenant on Starter) is paused and you're shown exactly which limit you've reached, with the option to upgrade. Everything you've already created keeps working.",
  },
  {
    q: 'Can I cancel any time?',
    a: 'Yes. Cancel whenever you like and Pro runs to the end of the period you paid for, then your account moves back to Starter. Your data stays — you just return to Starter limits for new activity.',
  },
  {
    q: 'Do my tenants ever pay for anything?',
    a: 'No. Tenants never need an account and never pay Settleroo anything. Plans are for landlords only.',
  },
  {
    q: 'Is my data private?',
    a: "Yes. Every account is private by design — only you can see your properties, tenants, and bills, enforced at the database level, not just in the app. A tenant's link shows how their bill share was worked out, including each tenant's occupancy days on that specific bill (since a shared bill isn't individually metered) — but never another tenant's contact details, other bills, or your account beyond that one bill.",
  },
];

const FeatureValue = ({ value }) => {
  if (value === true) return <Check className="w-4 h-4 text-primary-600 mx-auto" />;
  if (value === false) return <Minus className="w-4 h-4 text-secondary-300 mx-auto" />;
  if (value === null || value === undefined) return <span className="text-secondary-900 font-medium">Unlimited</span>;
  return <span className="text-secondary-900 font-medium">{value}</span>;
};

// Call an authenticated edge function and return the JSON response.
// Throws if the session is missing or the function returns an error.
const callEdgeFunction = async (fnName, body = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');

  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const res = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: process.env.REACT_APP_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `${fnName} failed`);
  return json;
};

const Pricing = () => {
  const { isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [plans, setPlans] = useState([]);
  const [period, setPeriod] = useState('monthly');
  const [loadError, setLoadError] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  // Whether this account already has a Stripe-managed subscription
  const [hasStripeSubscription, setHasStripeSubscription] = useState(false);
  const [isProPlan, setIsProPlan] = useState(false);
  // Whether the subscription fetch below has resolved (or was skipped
  // because the user isn't authenticated) — gates the auto-resume effect
  // so it can't fire before we actually know the user's plan status.
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);
  // Guards against firing handleUpgrade() more than once (StrictMode
  // double-invoke, re-renders) when resuming checkout after login.
  const hasAutoFiredRef = useRef(false);

  // ?checkout=success is set by the success_url in create-checkout-session
  const checkoutSuccess = searchParams.get('checkout') === 'success';

  useEffect(() => {
    supabase
      .from('plans')
      .select('*')
      .eq('is_public', true)
      .order('sort_order')
      .then(({ data, error }) => {
        if (error) setLoadError(error.message);
        else setPlans(data ?? []);
      });
  }, []);

  // Load the caller's subscription state so we know whether to show
  // "Upgrade" or "Manage billing"
  useEffect(() => {
    if (!isAuthenticated) {
      setSubscriptionChecked(true);
      return;
    }
    supabase
      .from('subscriptions')
      .select('plan_id, source, status')
      .single()
      .then(({ data }) => {
        if (data) {
          setHasStripeSubscription(data.source === 'stripe' && data.status === 'active');
          setIsProPlan(data.plan_id === 'pro' && data.status === 'active');
        }
        setSubscriptionChecked(true);
      });
  }, [isAuthenticated]);

  // Resume checkout automatically after the user logs in from the
  // logged-out "Start with Pro" CTA (see the Link below), instead of
  // dropping them on /dashboard and making them find their way back here
  // and click again. Login.js carries ?intent=upgrade&period=... through
  // both the Google OAuth and magic-link redirect targets.
  useEffect(() => {
    if (!isAuthenticated || !subscriptionChecked) return;
    if (searchParams.get('intent') !== 'upgrade') return;
    if (hasAutoFiredRef.current) return;
    if (isProPlan) return; // already Pro — "Manage billing" shows instead

    const intentPeriod = searchParams.get('period');
    if (intentPeriod === 'monthly' || intentPeriod === 'yearly') {
      setPeriod(intentPeriod);
    }

    hasAutoFiredRef.current = true;
    // Strip intent params before triggering checkout so a re-render or a
    // later refresh/back-nav can't cause a second auto-fire.
    setSearchParams((prev) => {
      prev.delete('intent');
      prev.delete('plan');
      prev.delete('period');
      return prev;
    });
    handleUpgrade();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, subscriptionChecked, isProPlan, searchParams, setSearchParams]);

  // Clear ?checkout=success from the URL after showing the banner so a
  // page refresh doesn't re-show it.
  useEffect(() => {
    if (checkoutSuccess) {
      const timer = setTimeout(() => {
        setSearchParams((prev) => {
          prev.delete('checkout');
          return prev;
        });
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [checkoutSuccess, setSearchParams]);

  const yearlySavingPct = useMemo(() => {
    const paid = plans.find((p) => p.price_cents_monthly > 0);
    if (!paid || !paid.price_cents_yearly) return null;
    return Math.round((1 - paid.price_cents_yearly / (paid.price_cents_monthly * 12)) * 100);
  }, [plans]);

  const handleUpgrade = async () => {
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const { url } = await callEdgeFunction('create-checkout-session', { period });
      window.location.href = url;
    } catch (err) {
      setCheckoutError(err.message);
      setCheckoutLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const { url } = await callEdgeFunction('create-portal-session');
      window.location.href = url;
    } catch (err) {
      // Portal errors are non-critical — show inline rather than a full error state
      setCheckoutError(err.message);
      setPortalLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-16">
      <Helmet defer={false}>
        <title>{TITLE}</title>
        <link rel="canonical" href="https://settleroo.netlify.app/pricing" />
      </Helmet>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Checkout success banner ─────────────────────────────────────── */}
        {checkoutSuccess && (
          <div className="mb-8 rounded-lg border border-success-200 bg-success-50 px-5 py-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-success-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-success-900">You're on Pro.</p>
              <p className="text-sm text-success-700 mt-0.5">
                Property limits removed, branding removed from tenant pages. Your subscription
                is billed per property — adding or removing a property updates your bill
                automatically.
              </p>
            </div>
          </div>
        )}

        {/* ── Checkout error banner ───────────────────────────────────────── */}
        {checkoutError && (
          <div className="mb-8 rounded-lg border border-danger-200 bg-danger-50 px-5 py-4">
            <p className="text-sm text-danger-700">
              <span className="font-semibold">Couldn't start checkout: </span>{checkoutError}
            </p>
            <button
              className="text-xs text-danger-600 underline mt-1"
              onClick={() => setCheckoutError(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-secondary-900 mb-4">
            Less than a week's rent from one room — for the whole year.
          </h1>
          <p className="text-lg text-secondary-600 max-w-2xl mx-auto">
            Start free with your first property. Pro is priced per property, so you only pay for the
            doors you actually manage — every plan includes the full split engine and no-login tenant
            links.
          </p>
        </div>

        {/* Monthly / yearly toggle */}
        <div className="flex items-center justify-center space-x-3 mb-10">
          <button
            onClick={() => setPeriod('monthly')}
            className={period === 'monthly' ? 'btn-primary' : 'btn-secondary'}
          >
            Monthly
          </button>
          <button
            onClick={() => setPeriod('yearly')}
            className={period === 'yearly' ? 'btn-primary' : 'btn-secondary'}
          >
            Yearly{yearlySavingPct ? ` — save ${yearlySavingPct}%` : ''}
          </button>
        </div>

        {loadError && (
          <p className="text-center text-danger-600 mb-8">Couldn't load plans: {loadError}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {plans.map((plan) => {
            const cents = period === 'yearly' ? plan.price_cents_yearly : plan.price_cents_monthly;
            const isPaid = plan.price_cents_monthly > 0;
            return (
              <div
                key={plan.id}
                className={`card ${isPaid ? 'border-primary-300 shadow-md' : ''}`}
              >
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-secondary-900">{plan.name}</h2>
                  <p className="mt-2">
                    <span className="text-4xl font-bold text-secondary-900 tabular-nums">
                      {cents === 0 ? 'Free' : `A$${(cents / 100).toFixed(0)}`}
                    </span>
                    {cents > 0 && (
                      <span className="text-secondary-500 text-sm ml-1">
                        /{plan.price_unit === 'per_property' ? 'property/' : ''}
                        {period === 'yearly' ? 'year' : 'month'}
                      </span>
                    )}
                  </p>
                </div>

                <ul className="space-y-3 mb-6">
                  {FEATURE_ROWS.map((row) => {
                    const value =
                      row.key === '_attachments'
                        ? true
                        : row.key === '_ai_features'
                        ? plan.limits?.email_ingestion
                        : plan.limits?.[row.key];
                    return (
                      <li key={row.key} className="flex items-center justify-between text-sm">
                        <span className="text-secondary-600">{row.label}</span>
                        <FeatureValue value={value} />
                      </li>
                    );
                  })}
                </ul>

                {isPaid ? (
                  isAuthenticated ? (
                    <>
                      {/* Already on Pro via Stripe — show Manage billing */}
                      {isProPlan && hasStripeSubscription ? (
                        <button
                          onClick={handleManageBilling}
                          disabled={portalLoading}
                          className="btn-secondary w-full flex items-center justify-center gap-2"
                        >
                          {portalLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ExternalLink className="w-4 h-4" />
                          )}
                          Manage billing
                        </button>
                      ) : isProPlan ? (
                        // Pro but managed manually (operator-granted) — no Stripe portal
                        <div className="btn-secondary w-full text-center cursor-default opacity-70">
                          Pro (operator-managed)
                        </div>
                      ) : (
                        /* Free plan — show real Checkout button */
                        <>
                          <button
                            onClick={handleUpgrade}
                            disabled={checkoutLoading}
                            className="btn-primary w-full flex items-center justify-center gap-2"
                          >
                            {checkoutLoading ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Redirecting to checkout…
                              </>
                            ) : (
                              `Upgrade to ${plan.name}`
                            )}
                          </button>
                          <p className="text-xs text-secondary-500 text-center mt-2">
                            Secure checkout via Stripe. Cancel any time.
                          </p>
                        </>
                      )}
                    </>
                  ) : (
                    <Link
                      to={`/login?redirect=/pricing&intent=upgrade&plan=pro&period=${period}`}
                      className="btn-primary w-full block text-center"
                    >
                      Start with {plan.name}
                    </Link>
                  )
                ) : (
                  <Link
                    to={isAuthenticated ? '/dashboard' : '/login'}
                    className="btn-secondary w-full block text-center"
                  >
                    {isAuthenticated ? 'You have this' : 'Get started free'}
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-secondary-900 mb-6 text-center">
            Pricing questions
          </h2>
          <div className="space-y-3">
            {faqs.map((item) => (
              <div key={item.q} className="card">
                <h3 className="text-base font-semibold text-secondary-900 mb-2">{item.q}</h3>
                <p className="text-sm text-secondary-600">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
