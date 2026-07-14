import React from 'react';
import { Link } from 'react-router-dom';
import { Github, Twitter, Mail, Heart } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-white border-t border-secondary-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">R</span>
              </div>
              <span className="text-xl font-bold text-secondary-900">RoomTab</span>
            </div>
            <p className="text-secondary-600 mb-4 max-w-md">
              Split bills and manage shared expenses with friends and roommates. 
              Keep track of who owes what and settle up easily.
            </p>
            <div className="flex space-x-4">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-secondary-400 hover:text-secondary-600 transition-colors duration-200"
              >
                <Github className="w-5 h-5" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-secondary-400 hover:text-secondary-600 transition-colors duration-200"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a
                href="mailto:support@roomtab.com"
                className="text-secondary-400 hover:text-secondary-600 transition-colors duration-200"
              >
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold text-secondary-900 uppercase tracking-wider mb-4">
              Quick Links
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/"
                  className="text-secondary-600 hover:text-secondary-900 transition-colors duration-200"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  to="/properties"
                  className="text-secondary-600 hover:text-secondary-900 transition-colors duration-200"
                >
                  Properties
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-8 pt-8 border-t border-secondary-200">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-secondary-500 text-sm">
              © 2024 RoomTab. All rights reserved.
            </p>
            <p className="text-secondary-500 text-sm flex items-center mt-2 md:mt-0">
              Made with <Heart className="w-4 h-4 mx-1 text-red-500" /> for roommates everywhere
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;