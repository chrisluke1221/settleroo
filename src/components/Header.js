import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Building2,
  LogIn,
  LogOut,
  User,
  Menu,
  X,
  DollarSign,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// Logged-out nav is marketing-site anchor links into Home's own sections —
// zero new pages, and it stops the header looking like a one-product stall
// with a single "Pricing" link. Logged-in nav is the real in-product nav
// (Dashboard/Properties) and keeps its icons; the marketing links don't —
// icons on plain text links read as "internal tool," not marketing site.
const loggedOutNavItems = [
  { name: 'How it works', href: '/#how-it-works' },
  { name: 'Pricing', to: '/pricing' },
  { name: 'FAQ', href: '/#faq' },
];
const loggedInNavItems = [
  { name: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { name: 'Properties', to: '/properties', icon: Building2 },
];

const Header = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItems = isAuthenticated ? loggedInNavItems : loggedOutNavItems;

  const renderNavLink = (item, { mobile } = {}) => {
    const Icon = item.icon;
    const isActive = item.to && location.pathname === item.to;
    const className = `flex items-center ${mobile ? 'space-x-3 px-3 py-2' : 'space-x-2 px-3 py-2'} rounded-lg text-sm font-medium transition-colors duration-200 ${
      isActive
        ? 'bg-primary-100 text-primary-700'
        : 'text-secondary-600 hover:text-secondary-900 hover:bg-secondary-50'
    }`;
    const content = (
      <>
        {Icon && <Icon className="w-4 h-4" />}
        <span>{item.name}</span>
      </>
    );
    if (item.href) {
      return (
        <a key={item.name} href={item.href} className={className} onClick={() => mobile && setIsMobileMenuOpen(false)}>
          {content}
        </a>
      );
    }
    return (
      <Link key={item.name} to={item.to} className={className} onClick={() => mobile && setIsMobileMenuOpen(false)}>
        {content}
      </Link>
    );
  };

  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-secondary-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to={isAuthenticated ? '/dashboard' : '/'} className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-secondary-900">RoomieTab</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-2">
            {navItems.map((item) => renderNavLink(item))}
          </nav>

          {/* User Menu — primary CTA is always acquisition (Get started) or
              the product itself (Dashboard), never plain authentication;
              "Log in" is a de-emphasized text link, not the filled button. */}
          <div className="hidden md:flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-primary-600" />
                  </div>
                  <span className="text-sm font-medium text-secondary-900">
                    {user?.user_metadata?.full_name || user?.email || 'User'}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-secondary-600 hover:text-secondary-900 transition-colors duration-200"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium text-secondary-600 hover:text-secondary-900 transition-colors duration-200"
                >
                  Log in
                </Link>
                <Link
                  to="/login"
                  className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200 font-medium text-sm"
                >
                  <span>Get started free</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-secondary-600 hover:text-secondary-900 hover:bg-secondary-50 transition-colors duration-200"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-secondary-200 py-4"
          >
            <nav className="space-y-2">
              {navItems.map((item) => renderNavLink(item, { mobile: true }))}

              {isAuthenticated ? (
                <div className="pt-4 border-t border-secondary-200">
                  <div className="flex items-center space-x-3 px-3 py-2">
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-primary-600" />
                    </div>
                    <span className="text-sm font-medium text-secondary-900">
                      {user?.user_metadata?.full_name || user?.email || 'User'}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex items-center space-x-3 px-3 py-2 w-full text-left text-sm font-medium text-secondary-600 hover:text-secondary-900 transition-colors duration-200"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </button>
                </div>
              ) : (
                <div className="pt-4 border-t border-secondary-200 space-y-2">
                  <Link
                    to="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center space-x-3 px-3 py-2 bg-primary-600 text-white rounded-lg font-medium text-sm"
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>Get started free</span>
                  </Link>
                  <Link
                    to="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center space-x-3 px-3 py-2 text-sm font-medium text-secondary-600 hover:text-secondary-900 transition-colors duration-200"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Log in</span>
                  </Link>
                </div>
              )}
            </nav>
          </motion.div>
        )}
      </div>
    </header>
  );
};

export default Header;
