import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, ArrowRight, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const Login = () => {
  const { signInWithGoogle, sendMagicLink, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [linkSent, setLinkSent] = useState(false);

  // Defense in depth against the auth-loading race: if a session lands a
  // moment after this page renders (e.g. a magic-link redirect that briefly
  // bounced here before the session finished committing), send the user
  // straight back into the app instead of leaving them stranded on /login.
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleGoogle = async () => {
    setGoogleSubmitting(true);
    setError('');
    try {
      await signInWithGoogle();
      // Supabase redirects to Google; the browser navigates away from here.
    } catch (err) {
      console.error('Google sign-in error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
      setGoogleSubmitting(false);
    }
  };

  const handleMagicLink = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Enter your email address');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      await sendMagicLink(email.trim());
      setLinkSent(true);
    } catch (err) {
      console.error('Magic link error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-secondary-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full"
      >
        <div className="card">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-secondary-900 mb-2">Welcome</h2>
            <p className="text-secondary-600">Sign in to manage your properties and tenants — no password needed.</p>
          </div>

          {linkSent ? (
            <div className="p-4 bg-success-50 border border-success-100 rounded-lg text-center">
              <p className="text-success-700 font-medium mb-1">Check your email</p>
              <p className="text-success-700 text-sm">
                We sent a sign-in link to <span className="font-medium">{email}</span>. Click it to continue.
              </p>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={handleGoogle}
                disabled={googleSubmitting}
                className="w-full flex items-center justify-center space-x-3 border border-secondary-300 rounded-lg py-2.5 px-4 font-medium text-secondary-700 hover:bg-secondary-50 transition-colors duration-200 disabled:opacity-50"
              >
                <GoogleIcon />
                <span>{googleSubmitting ? 'Redirecting...' : 'Continue with Google'}</span>
              </button>

              <div className="flex items-center my-6">
                <div className="flex-1 border-t border-secondary-200" />
                <span className="px-3 text-xs text-secondary-400 uppercase tracking-wide">or</span>
                <div className="flex-1 border-t border-secondary-200" />
              </div>

              <form onSubmit={handleMagicLink} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-secondary-900 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError('');
                      }}
                      placeholder="you@example.com"
                      className="input-field pr-10"
                      required
                    />
                    <Mail className="absolute right-3 top-1/2 transform -translate-y-1/2 text-secondary-400 w-5 h-5" />
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-danger-50 border border-danger-100 rounded-lg">
                    <p className="text-danger-600 text-sm">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary w-full flex items-center justify-center space-x-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <span>Send me a sign-in link</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="mt-8 text-center">
          <p className="text-secondary-600">
            <Link to="/" className="text-primary-600 hover:text-primary-700 font-medium">
              Go back home
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
