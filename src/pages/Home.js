import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
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

const Home = () => {
  const { isAuthenticated } = useAuth();

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

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-50 to-indigo-100 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl md:text-6xl font-bold text-secondary-900 mb-6"
            >
              Manage Properties &
              <span className="text-primary-600"> Split Bills</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-xl text-secondary-600 mb-8 max-w-3xl mx-auto"
            >
              Track your properties and tenants, and automatically split utility
              and rent bills based on occupancy.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link
                to={isAuthenticated ? '/properties' : '/login'}
                className="btn-primary text-lg px-8 py-3 flex items-center justify-center space-x-2"
              >
                <span>{isAuthenticated ? 'Go to Properties' : 'Get Started'}</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-secondary-900 mb-4">
              Everything you need to manage shared expenses
            </h2>
            <p className="text-xl text-secondary-600 max-w-2xl mx-auto">
              RoomTab provides all the tools you need to split bills and track expenses with friends and roommates.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="card hover:shadow-lg transition-shadow duration-300"
                >
                  <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-primary-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-secondary-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-secondary-600">
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary-600 to-primary-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to get organized?
          </h2>
          <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
            Add your properties and tenants, and let RoomTab handle the bill splitting.
          </p>
          <Link
            to={isAuthenticated ? '/properties' : '/login'}
            className="inline-flex items-center space-x-2 bg-white text-primary-600 font-semibold px-8 py-3 rounded-lg hover:bg-secondary-50 transition-colors duration-200"
          >
            <span>{isAuthenticated ? 'Go to Properties' : 'Get Started Free'}</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;