import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Check, Minus } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

// Public pricing page. Renders from the plans table (RLS allows anon select
// on is_public plans) rather than hardcoded copy, so repricing is a data
// change — the operator edits the row, no deploy.

const TITLE = 'Pricing — Settleroo';

// Display order + labels for the keys inside plans.limits. A numeric null
// renders as Unlimited; booleans as included/not-included.
const FEATURE_ROWS = [
  { key: 'max_properties', label: 'Properties' },
  { key: 'max_active_tenants', label: 'Active tenants' },
  { key: '_attachments', label: 'Bill attachments' },
  { key: 'branding_removable', label: 'Remove "Powered by Settleroo" from tenant pages' },
  // The three AI features are still building — one honest combined row reads
  // better than three "coming soon" rows selling futures on a pricing table.
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

const Pricing = () => {
  const { isAuthenticated } = useAuth();
  const [plans, setPlans] = useState([]);
  const [period, setPeriod] = useState('monthly');
  const [loadError, setLoadError] = useState(null);

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

  const yearlySavingPct = useMemo(() => {
    const paid = plans.find((p) => p.price_cents_monthly > 0);
    if (!paid || !paid.price_cents_yearly) return null;
    return Math.round((1 - paid.price_cents_yearly / (paid.price_cents_monthly * 12)) * 100);
  }, [plans]);

  return (
    <div className="min-h-screen py-16">
      <Helmet defer={false}>
        <title>{TITLE}</title>
        <link rel="canonical" href="https://settleroo.netlify.app/pricing" />
      </Helmet>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
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
                      <a
                        href="mailto:chrisluke1221@gmail.com?subject=Upgrade%20to%20Settleroo%20Pro"
                        className="btn-primary w-full block text-center"
                      >
                        Email me — I'll set you up within 24h
                      </a>
                      <p className="text-xs text-secondary-500 text-center mt-2">Signed, Chris — no self-serve checkout yet.</p>
                    </>
                  ) : (
                    <Link to="/login" className="btn-primary w-full block text-center">
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
