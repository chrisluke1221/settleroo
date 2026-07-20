import React from 'react';
import { Helmet } from 'react-helmet-async';

const TITLE = 'Privacy Policy — RoomieTab';
const LAST_UPDATED = '20 July 2026';

// Baseline, plain-language privacy policy — not a substitute for legal
// advice, but real coverage rather than a placeholder. Its absence is a
// stronger negative signal to a skeptical landlord than its presence is a
// positive one, so this exists before any external user is asked to trust
// the product with tenant financial data.
const Privacy = () => (
  <div className="min-h-screen py-16">
    <Helmet defer={false}>
      <title>{TITLE}</title>
      <meta name="robots" content="noindex" />
    </Helmet>
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-secondary-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-secondary-500 mb-10">Last updated {LAST_UPDATED}</p>

      <div className="space-y-8 text-secondary-700">
        <section>
          <h2 className="text-lg font-semibold text-secondary-900 mb-2">What we collect</h2>
          <p>
            When you sign up as a landlord, we collect your email address and, optionally, your name.
            Everything else — your properties, rooms, tenants, and bills — is data you enter yourself to
            use the product.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-secondary-900 mb-2">Your tenants</h2>
          <p>
            Tenants never create a RoomieTab account. They access their own bill share through a single,
            revocable link that shows only their own information — never another tenant's, and never your
            full property or financial overview. You can revoke a tenant's link at any time.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-secondary-900 mb-2">Private by design</h2>
          <p>
            Every landlord account is isolated at the database level — your properties, tenants, and bills
            are never visible to another account, and no landlord can see another landlord's data. This
            isolation is enforced by the database itself, not just by application code.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-secondary-900 mb-2">How we use your data</h2>
          <p>
            To run the product: storing your properties and bills, sending transactional emails (bill
            notifications, magic-link sign-in, overdue reminders) via our email provider, and letting you
            sign in via email or Google. We don't sell your data, and we don't use it for advertising.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-secondary-900 mb-2">Payments</h2>
          <p>
            RoomieTab never handles a tenant's rent or bill payment — it tracks who owes what and lets a
            landlord mark a split as paid. Pro plan upgrades are currently arranged directly by email; we
            don't collect or store card details ourselves. As self-serve billing is introduced, it will be
            handled by Stripe, and this section will be updated accordingly.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-secondary-900 mb-2">Data retention & deletion</h2>
          <p>
            You can delete a property (and everything under it) at any time from within the app. If you'd
            like your account and all associated data removed entirely, email us and we'll action it.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-secondary-900 mb-2">Questions</h2>
          <p>
            This is a plain-language summary, not a substitute for legal advice, and may be updated as the
            product grows. If anything here is unclear, or you have a question about your data, email{' '}
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

export default Privacy;
