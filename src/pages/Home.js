import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  Users,
  DollarSign,
  Calculator,
  Shield,
  Zap,
  CheckCircle,
  ArrowRight,
  Mail,
  UserX,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const TITLE = 'Settleroo — From bill to settled, without you.';
const DESCRIPTION =
  'Settleroo is the settlement layer for rent-by-the-room. It splits shared bills to the exact day each tenant occupied the property and chases them to settled — no spreadsheets, no awkward group chats.';

const features = [
  {
    icon: Users,
    title: 'Property & Tenant Management',
    description: 'Track every property, room, and tenant in one place.'
  },
  {
    icon: Calculator,
    title: 'Pro-Rated Bill Splitting',
    description: 'Automatically split utility and rent bills by occupancy days and headcount.'
  },
  {
    icon: DollarSign,
    title: 'Balance Tracking',
    description: 'See what each tenant owes across everything — rent and bills combined — at a glance.'
  },
  {
    icon: Shield,
    title: 'Private by Design',
    description: 'Tenants see only their own share, never each other\'s. Your properties are yours alone.'
  },
  {
    icon: Zap,
    title: 'Works Everywhere',
    description: 'Phone at the property, laptop at home — always the same numbers, always up to date.'
  },
  {
    icon: CheckCircle,
    title: 'Chased to Settled',
    description: 'Overdue reminders go out on their own, so you\'re never the one nagging a tenant to pay.'
  }
];

const marqueeItems = [
  'Split by exact occupancy days',
  'Tenants never need an account',
  'Rent bills generate automatically',
  'Free for your first property',
  'No spreadsheets, no group chats',
];

const howItWorks = [
  {
    icon: Mail,
    title: 'A bill lands',
    description: 'The power bill, the water bill, whatever it is — enter the total and the period it covers.'
  },
  {
    icon: Calculator,
    title: 'Settleroo splits it fairly',
    description: 'By the exact number of days each tenant lived there — move-ins, move-outs, and vacant rooms all counted.'
  },
  {
    icon: CheckCircle,
    title: 'Your tenant sees the math',
    description: 'A link, no login, no account — just their share and exactly how it was calculated. They confirm; you\'re done.'
  }
];

const recentlyShipped = [
  'Per-property Pro pricing',
  'Passwordless sign-in with Google',
  'Automatic monthly rent generation',
  'Overdue payment reminders, sent automatically',
];

const workingOn = [
  'Smarter ways to catch a bill before you even enter it',
  'More visibility into who\'s paid and who hasn\'t',
  'Your rental business, at a glance',
];

const faqGroups = [
  {
    heading: 'Before you sign up',
    items: [
      {
        question: 'What problem does Settleroo actually solve?',
        answer:
          "Splitting a shared bill fairly across a room-by-room rental is tedious and creates arguments when the math isn't shown. Settleroo does the math for you — by exact occupancy days, not a rough guess — and shows every tenant exactly how their share was worked out."
      },
      {
        question: 'Do I have to pay for this?',
        answer:
          "Settleroo is free to start — one property, no credit card required. Running more than one? Pro is priced per property, so you only pay for the doors you actually manage."
      },
      {
        question: 'Does my tenant need to create an account?',
        answer:
          "No. Tenants get a no-login link to view their bill breakdown and confirm payment. Settleroo never requires a tenant to sign up for anything."
      },
      {
        question: 'How does Settleroo split shared bills fairly?',
        answer:
          "Every utility bill is split by exactly how many days each tenant occupied the property during the billing period — move-ins, move-outs, and vacant rooms are all accounted for. The math is deterministic and shown to every tenant, not an AI guess."
      },
    ],
  },
  {
    heading: 'Once you\'re using it',
    items: [
      {
        question: "What happens when someone moves out mid-cycle?",
        answer:
          'Move-outs and vacancy periods are first-class data, not an afterthought — the proration engine accounts for exactly how many days each tenant was in the property, so a mid-cycle move never means manual math.'
      },
      {
        question: 'What if a tenant\'s rent changes partway through a bill period?',
        answer:
          "Rent is tracked separately from utility bills, with its own effective-dated rate. If a rent change lands mid-period, Settleroo prorates the old and new rate across the exact days each applied — no manual recalculation."
      },
      {
        question: 'Can I still edit a bill after I\'ve sent it to a tenant?',
        answer:
          "Once a bill has been sent, its split is locked so a tenant never sees the number change under them. If your tenant roster changes afterward, Settleroo flags it and you can explicitly reissue — nothing updates silently."
      },
    ],
  },
];

// A faithful recreation of the real tenant breakdown screen (src/pages/TenantBillView.js),
// built from the same design tokens — not a stock illustration, the actual product.
const BreakdownMockup = () => (
  <div className="card max-w-sm w-full mx-auto">
    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center mb-3">
      <DollarSign className="w-5 h-5 text-primary-600" />
    </div>
    <p className="font-bold text-secondary-900 mb-1">Electricity Bill</p>
    <p className="text-xs text-secondary-500 mb-4">Hi Alice, here's exactly how your share was calculated.</p>

    <div className="bg-primary-50 border border-primary-100 rounded-lg p-3 mb-4 flex items-center justify-between">
      <div className="rounded-lg animate-soft-pulse">
        <p className="text-xs text-secondary-600">You owe</p>
        <p className="text-2xl font-bold text-primary-700 tabular-nums">$40.00</p>
      </div>
      <div className="text-right">
        <p className="text-xs text-secondary-600">of total bill</p>
        <p className="text-sm font-semibold text-secondary-900 tabular-nums">$120.00</p>
      </div>
    </div>

    <div className="border border-secondary-200 rounded-lg overflow-hidden text-xs">
      <div className="bg-secondary-50 px-3 py-1.5 border-b border-secondary-200">
        <p className="font-semibold text-secondary-600 uppercase tracking-wide" style={{ fontSize: '10px' }}>How this was calculated</p>
      </div>
      <div className="divide-y divide-secondary-100">
        <div className="flex justify-between px-3 py-2">
          <span className="text-secondary-600">Your tenant-days = 30 days &times; 1</span>
          <span className="font-medium text-secondary-900 tabular-nums">30</span>
        </div>
        <div className="flex justify-between px-3 py-2 bg-secondary-50">
          <span className="text-secondary-700">Your share = 30 &divide; 90 tenant-days</span>
          <span className="font-semibold text-secondary-900 tabular-nums">33.33%</span>
        </div>
      </div>
    </div>
  </div>
);

// Rotating value-prop strip. The track is the item list duplicated once so
// the CSS animation can translate exactly -50% and loop seamlessly.
const Marquee = () => (
  <div className="py-6 bg-white border-b border-secondary-100 overflow-hidden">
    <div className="flex w-max animate-marquee">
      {[...marqueeItems, ...marqueeItems].map((item, i) => (
        <span
          key={`${item}-${i}`}
          className="flex items-center text-sm font-medium text-secondary-600 whitespace-nowrap mx-6"
        >
          <CheckCircle className="w-4 h-4 text-primary-500 mr-2 flex-shrink-0" />
          {item}
        </span>
      ))}
    </div>
  </div>
);

const FaqItem = ({ item, isOpen, onToggle }) => (
  <div className="card">
    <button onClick={onToggle} className="w-full flex items-center justify-between text-left">
      <h3 className="text-base font-semibold text-secondary-900">{item.question}</h3>
      <ChevronDown className={`w-4 h-4 text-secondary-400 flex-shrink-0 ml-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
    </button>
    {isOpen && <p className="text-secondary-600 mt-3">{item.answer}</p>}
  </div>
);

const Home = () => {
  const { isAuthenticated } = useAuth();
  const [openFaq, setOpenFaq] = useState(null);

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'Settleroo',
        description: DESCRIPTION,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqGroups.flatMap((group) =>
          group.items.map((faq) => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: { '@type': 'Answer', text: faq.answer },
          }))
        ),
      },
    ],
  };

  return (
    <div className="min-h-screen">
      {/*
        Only title/canonical/JSON-LD here — description and OG/Twitter tags
        are left to the static defaults in public/index.html. Helmet can only
        remove tags it added itself, so duplicating those fields here would
        leave two conflicting <meta> tags in the DOM (the static one plus
        Helmet's). OG/Twitter scrapers don't execute JS anyway, so the
        static tags are the ones that actually matter for link previews.
      */}
      <Helmet defer={false}>
        <title>{TITLE}</title>
        <link rel="canonical" href="https://settleroo.netlify.app/" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      {/* Hero — pain first, mechanism second, the real product visible immediately */}
      <section className="bg-secondary-50 py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <p className="text-sm font-semibold text-primary-700 uppercase tracking-wide mb-3">
                Bill splitting for rent-by-the-room landlords
              </p>
              <h1 className="text-4xl md:text-5xl font-bold text-secondary-900 mb-6">
                Splitting the power bill shouldn't take your Sunday afternoon.
              </h1>
              <p className="text-xl text-secondary-600 mb-4 max-w-xl mx-auto lg:mx-0">
                Settleroo splits every shared bill to the exact day each tenant lived there, shows
                them the math on a no-login link, and chases it to settled.
              </p>
              <p className="text-sm text-secondary-500 mb-8">Free for your first property. No credit card.</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link
                  to={isAuthenticated ? '/dashboard' : '/login'}
                  className="btn-primary text-lg px-8 py-3 flex items-center justify-center space-x-2"
                >
                  <span>{isAuthenticated ? 'Go to Dashboard' : 'Get Started Free'}</span>
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  to="/demo-bill"
                  className="btn-secondary text-lg px-8 py-3 flex items-center justify-center space-x-2"
                >
                  <span>See a live example bill</span>
                </Link>
              </div>
            </div>
            <Link to="/demo-bill" className="block hover:opacity-90 transition-opacity duration-200">
              <BreakdownMockup />
            </Link>
          </div>
        </div>
      </section>

      <Marquee />

      {/* The differentiator, promoted to its own moment rather than buried in the FAQ */}
      <section className="py-14 bg-white border-b border-secondary-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <UserX className="w-6 h-6 text-primary-600" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-secondary-900 mb-3">
            Your tenants never need to create an account.
          </h2>
          <p className="text-lg text-secondary-600 max-w-2xl mx-auto">
            No app to download, no password to set. Just a link with their share, and exactly how it
            was worked out.
          </p>
        </div>
      </section>

      {/* How it works — the loop in three steps */}
      <section id="how-it-works" className="py-20 bg-secondary-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-secondary-900 mb-12 text-center">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {howItWorks.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="text-center">
                  <div className="w-14 h-14 bg-primary-600 rounded-full flex items-center justify-center mx-auto mb-4 relative">
                    <Icon className="w-6 h-6 text-white" />
                    <span className="absolute -top-1 -right-1 w-6 h-6 bg-secondary-900 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-secondary-900 mb-2">{step.title}</h3>
                  <p className="text-secondary-600">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-secondary-900 mb-4">
              Built for landlords who rent by the room
            </h2>
            <p className="text-xl text-secondary-600 max-w-2xl mx-auto">
              Settleroo handles the whole loop — bill in, split fairly, chased to settled — so your Sunday
              afternoon stays yours.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="card hover:shadow-lg transition-shadow duration-300">
                  <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-primary-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-secondary-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-secondary-600">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* What's new — momentum proof (shipped) plus a deliberately vague look-ahead,
          no dates or named features so we're never selling a future we haven't built */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-secondary-900 mb-10 text-center">Always moving</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="card">
              <h3 className="text-sm font-semibold text-secondary-500 uppercase tracking-wide mb-4">Recently shipped</h3>
              <ul className="space-y-3">
                {recentlyShipped.map((item) => (
                  <li key={item} className="flex items-start space-x-2">
                    <CheckCircle className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" />
                    <span className="text-secondary-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card">
              <h3 className="text-sm font-semibold text-secondary-500 uppercase tracking-wide mb-4">What we're working on</h3>
              <ul className="space-y-3">
                {workingOn.map((item) => (
                  <li key={item} className="flex items-start space-x-2">
                    <Sparkles className="w-4 h-4 text-secondary-400 mt-0.5 flex-shrink-0" />
                    <span className="text-secondary-600">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section — collapsible, split by who's asking, so it doesn't turn into
          a wall of text as more questions get added */}
      <section id="faq" className="py-20 bg-secondary-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-secondary-900 mb-10 text-center">Common questions</h2>
          {faqGroups.map((group) => (
            <div key={group.heading} className="mb-10 last:mb-0">
              <h3 className="text-xs font-semibold text-secondary-500 uppercase tracking-wide mb-3">{group.heading}</h3>
              <div className="space-y-3">
                {group.items.map((item) => {
                  const id = `${group.heading}-${item.question}`;
                  return (
                    <FaqItem
                      key={id}
                      item={item}
                      isOpen={openFaq === id}
                      onToggle={() => setOpenFaq((cur) => (cur === id ? null : id))}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to get organized?
          </h2>
          <p className="text-xl text-primary-100 mb-2 max-w-2xl mx-auto">
            Add your properties and tenants, and let Settleroo handle the bill splitting.
          </p>
          <p className="text-sm text-primary-200 mb-8">Free for your first property. No credit card.</p>
          <Link
            to={isAuthenticated ? '/dashboard' : '/login'}
            className="inline-flex items-center space-x-2 bg-white text-primary-700 font-semibold px-8 py-3 rounded-lg hover:bg-secondary-50 transition-colors duration-200"
          >
            <span>{isAuthenticated ? 'Go to Dashboard' : 'Get Started Free'}</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
