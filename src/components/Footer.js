import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, CheckCircle2 } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-white border-t border-secondary-200 mt-auto">
      {/* Mechanism proof instead of volume proof — no fake logos or user
          counts pre-launch, just the one invariant that's actually true and
          actually matters to a landlord deciding whether to trust the math. */}
      <div className="border-b border-secondary-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-center text-center">
          <p className="text-sm text-secondary-500 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-primary-500 flex-shrink-0" />
            <span>Every split sums to the cent — enforced by an invariant, not a promise.</span>
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2 text-sm">
            <span className="font-semibold text-secondary-900">RoomieTab</span>
            <Link to="/" className="text-secondary-500 hover:text-secondary-900 transition-colors duration-200">
              Home
            </Link>
            <Link to="/pricing" className="text-secondary-500 hover:text-secondary-900 transition-colors duration-200">
              Pricing
            </Link>
            <Link to="/privacy" className="text-secondary-500 hover:text-secondary-900 transition-colors duration-200">
              Privacy
            </Link>
            <Link to="/terms" className="text-secondary-500 hover:text-secondary-900 transition-colors duration-200">
              Terms
            </Link>
            <a
              href="mailto:chrisluke1221@gmail.com"
              className="text-secondary-500 hover:text-secondary-900 transition-colors duration-200 flex items-center space-x-1"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Support</span>
            </a>
          </div>
          <p className="text-secondary-400 text-xs text-center">
            © {new Date().getFullYear()} RoomieTab. Made in Australia 🇦🇺
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
