import React from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-white border-t border-secondary-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="flex items-center space-x-4 text-sm">
            <span className="font-semibold text-secondary-900">RoomieTab</span>
            <Link to="/" className="text-secondary-500 hover:text-secondary-900 transition-colors duration-200">
              Home
            </Link>
            <a
              href="mailto:support@roomietab.com"
              className="text-secondary-500 hover:text-secondary-900 transition-colors duration-200 flex items-center space-x-1"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Support</span>
            </a>
          </div>
          <p className="text-secondary-400 text-xs">© {new Date().getFullYear()} RoomieTab. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
