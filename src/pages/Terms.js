import React from 'react';
import { Helmet } from 'react-helmet-async';

const TITLE = 'Terms of Service — Settleroo';
const LAST_UPDATED = '20 July 2026';

// Baseline terms — same reasoning as Privacy.js: real coverage now, refined
// with real legal advice as the business grows, rather than left blank.
const Terms = () => (
  <div className="min-h-screen py-16">
    <Helmet defer={false}>
      <title>{TITLE}</title>
      <meta name="robots" content="noindex" />
    </Helmet>
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-secondary-900 mb-2">Terms of Service</h1>
      <p className="text-sm text-secondary-500 mb-10">Last updated {LAST_UPDATED}</p>

      <div className="space-y-8 text-secondary-700">
        <section>
          <h2 className="text-lg font-semibold text-secondary-900 mb-2">The service</h2>
          <p>
            Settleroo helps landlords split shared bills and rent by occupancy across tenants, and share
            the breakdown with tenants via a no-login link. You're responsible for the accuracy of the
            property, tenant, and bill information you enter.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-secondary-900 mb-2">Your account</h2>
          <p>
            You must provide a real, working email address and keep your account credentials secure.
            You're responsible for activity under your account. Don't use Settleroo for a property you
            don't have the right to manage, or to mislead a tenant about what they owe.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-secondary-900 mb-2">Plans & billing</h2>
          <p>
            A free Starter plan and a paid Pro plan are available; current limits and pricing are shown on
            our <a href="/pricing" className="text-primary-600 hover:text-primary-700">pricing page</a>. Where
            billing is handled through Stripe, Stripe's own terms also apply to that transaction. You can
            cancel a paid plan at any time; it runs to the end of the period already paid for.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-secondary-900 mb-2">What Settleroo doesn't do</h2>
          <p>
            Settleroo calculates and displays what each tenant owes — it does not collect, hold, or
            transfer rent or bill payments on anyone's behalf. Any money changes hands directly between
            landlord and tenant, outside the product.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-secondary-900 mb-2">No warranty</h2>
          <p>
            Settleroo is provided "as is." We work hard to keep the splitting math correct — every split is
            designed to sum exactly to the bill total — but we don't guarantee the service will be
            uninterrupted or error-free, and we're not liable for decisions made based on figures the
            product calculates.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-secondary-900 mb-2">Changes</h2>
          <p>
            We may update these terms or the product itself as Settleroo develops. Material changes will be
            reflected here with an updated date.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-secondary-900 mb-2">Governing law</h2>
          <p>These terms are governed by the laws of Victoria, Australia.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-secondary-900 mb-2">Contact</h2>
          <p>
            Questions about these terms:{' '}
            <a href="mailto:chrisluke1221@gmail.com" className="text-primary-600 hover:text-primary-700">
              chrisluke1221@gmail.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  </div>
);

export default Terms;
