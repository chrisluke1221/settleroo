import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  Users,
  DollarSign,
  Calculator,
  Shield,
  Zap,
  CheckCircle,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const TITLE = 'RoomieTab — From bill to settled, without you.';
const DESCRIPTION =
  'RoomieTab is the settlement layer for rent-by-the-room. It splits shared bills to the exact day each tenant occupied the property and chases them to settled — no spreadsheets, no awkward group chats.';

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
    description: 'See what each tenant owes for every bill, at a glance.'
  },
  {
    icon: Shield,
    title: 'Secure & Private',
    description: 'Your data is protected by row-level security — only you can see your properties.'
  },
  {
    icon: Zap,
    title: 'Real-time Sync',
    description: 'Data is stored in Supabase, so it persists and syncs across devices.'
  },
  {
    icon: CheckCircle,
    title: 'Payment Status',
    description: 'Mark tenants as paid, pending, or overdue at a glance.'
  }
];

const faqs = [
  {
    question: 'How does RoomieTab split shared bills fairly?',
    answer:
      "Every utility bill is split by exactly how many days each tenant occupied the property during the billing period — move-ins, move-outs, and vacant rooms are all accounted for. The math is deterministic and shown to every tenant, not an AI guess."
  },
  {
    question: 'Does my tenant need to create an account?',
    answer:
      "No. Tenants get a no-login link to view their bill breakdown and confirm payment. RoomieTab never requires a tenant to sign up for anything."
  },
  {
    question: "What happens when someone moves out mid-cycle?",
    answer:
      'Move-outs and vacancy periods are first-class data, not an afterthought — the proration engine accounts for exactly how many days each tenant was in the property, so a mid-cycle move never means manual math.'
  }
];

const Home = () => {
  const { isAuthenticated } = useAuth();

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'RoomieTab',
        description: DESCRIPTION,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
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
        <link rel="canonical" href="https://roomietab.netlify.app/" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      {/* Hero Section */}
      <section className="bg-secondary-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-secondary-900 mb-6">
              From bill to settled,
              <span className="text-primary-600"> without you.</span>
            </h1>
            <p className="text-xl text-secondary-600 mb-8 max-w-3xl mx-auto">
              RoomieTab is the settlement layer for rent-by-the-room. It splits every bill to the exact
              day each tenant occupied the property, and shows them the math — so nobody has to ask.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to={isAuthenticated ? '/dashboard' : '/login'}
                className="btn-primary text-lg px-8 py-3 flex items-center justify-center space-x-2"
              >
                <span>{isAuthenticated ? 'Go to Dashboard' : 'Get Started'}</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
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
              RoomieTab handles the whole loop — bill in, split fairly, chased to settled — so your Sunday
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

      {/* FAQ Section */}
      <section className="py-20 bg-secondary-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-secondary-900 mb-10 text-center">Common questions</h2>
          <div className="space-y-6">
            {faqs.map((faq) => (
              <div key={faq.question} className="card">
                <h3 className="text-lg font-semibold text-secondary-900 mb-2">{faq.question}</h3>
                <p className="text-secondary-600">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to get organized?
          </h2>
          <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
            Add your properties and tenants, and let RoomieTab handle the bill splitting.
          </p>
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
