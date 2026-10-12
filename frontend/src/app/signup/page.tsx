'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthCard } from '@/components/auth/AuthCard';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SignupErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<SignupErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const validate = (): boolean => {
    const newErrors: SignupErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Full name is required.';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters.';
    }

    if (!email.trim()) {
      newErrors.email = 'Email address is required.';
    } else if (!EMAIL_REGEX.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      newErrors.password = 'Password is required.';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters.';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password.';
    } else if (confirmPassword !== password) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setSuccessMessage(null);
    setErrors({});

    if (!validate()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await signup(name, email, password);

      // Clear sensitive password fields on successful registration
      setPassword('');
      setConfirmPassword('');

      // If the backend returned an access token, AuthContext saved it and authenticated the user
      if (response?.data?.accessToken) {
        router.push('/');
      } else {
        // Fallback in case token was not returned: direct user to log in
        setSuccessMessage(
          response.message || 'Account created successfully! Please log in to continue.'
        );
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.statusCode === 409) {
          setErrors({
            email: err.message,
            general: err.message,
          });
        } else {
          setErrors({
            general: err.message,
          });
        }
      } else if (err instanceof Error) {
        setErrors({
          general: err.message,
        });
      } else {
        setErrors({
          general: 'An unexpected error occurred during signup. Please try again.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthCard
      title="Create Your Account"
      subtitle="Join verified creators and buyers trading YouTube digital assets."
      footerText="Already have a TubeX account?"
      footerLinkText="Log in instead"
      footerLinkHref="/login"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Success Notice Banner */}
        {successMessage && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-lg border border-emerald-500/30 bg-emerald-950/40 p-3 text-xs text-emerald-200"
          >
            <div className="font-semibold text-emerald-300">Account Created Successfully</div>
            <p className="mt-1 text-slate-300">{successMessage}</p>
          </div>
        )}

        {/* General Error Banner */}
        {errors.general && (
          <div
            role="alert"
            className="rounded-lg border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-200"
          >
            {errors.general}
          </div>
        )}

        {/* Full Name Input */}
        <div>
          <label htmlFor="signup-name" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Full Name
          </label>
          <input
            id="signup-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            placeholder="Alex Morgan"
            aria-invalid={errors.name ? 'true' : 'false'}
            aria-describedby={errors.name ? 'signup-name-error' : undefined}
            className={`mt-1.5 block w-full rounded-lg border bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 shadow-sm transition-colors focus:outline-none focus:ring-1 ${
              errors.name
                ? 'border-rose-500 focus:border-rose-400 focus:ring-rose-400'
                : 'border-slate-750 focus:border-cyan-400 focus:ring-cyan-400'
            }`}
          />
          {errors.name && (
            <p id="signup-name-error" className="mt-1.5 text-xs text-rose-400" role="alert">
              {errors.name}
            </p>
          )}
        </div>

        {/* Email Input */}
        <div>
          <label htmlFor="signup-email" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Email Address
          </label>
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            placeholder="creator@example.com"
            aria-invalid={errors.email ? 'true' : 'false'}
            aria-describedby={errors.email ? 'signup-email-error' : undefined}
            className={`mt-1.5 block w-full rounded-lg border bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 shadow-sm transition-colors focus:outline-none focus:ring-1 ${
              errors.email
                ? 'border-rose-500 focus:border-rose-400 focus:ring-rose-400'
                : 'border-slate-750 focus:border-cyan-400 focus:ring-cyan-400'
            }`}
          />
          {errors.email && (
            <p id="signup-email-error" className="mt-1.5 text-xs text-rose-400" role="alert">
              {errors.email}
            </p>
          )}
        </div>

        {/* Password Input */}
        <div>
          <label htmlFor="signup-password" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Password <span className="text-[11px] font-normal text-slate-400">(min. 8 characters)</span>
          </label>
          <div className="relative mt-1.5">
            <input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              placeholder="••••••••"
              aria-invalid={errors.password ? 'true' : 'false'}
              aria-describedby={errors.password ? 'signup-password-error' : undefined}
              className={`block w-full rounded-lg border bg-slate-950 px-3.5 py-2.5 pr-10 text-sm text-slate-100 placeholder-slate-500 shadow-sm transition-colors focus:outline-none focus:ring-1 ${
                errors.password
                  ? 'border-rose-500 focus:border-rose-400 focus:ring-rose-400'
                  : 'border-slate-750 focus:border-cyan-400 focus:ring-cyan-400'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                  />
                </svg>
              ) : (
                <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              )}
            </button>
          </div>
          {errors.password && (
            <p id="signup-password-error" className="mt-1.5 text-xs text-rose-400" role="alert">
              {errors.password}
            </p>
          )}
        </div>

        {/* Confirm Password Input */}
        <div>
          <label htmlFor="signup-confirm-password" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Confirm Password
          </label>
          <div className="relative mt-1.5">
            <input
              id="signup-confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
              }}
              placeholder="••••••••"
              aria-invalid={errors.confirmPassword ? 'true' : 'false'}
              aria-describedby={errors.confirmPassword ? 'signup-confirm-password-error' : undefined}
              className={`block w-full rounded-lg border bg-slate-950 px-3.5 py-2.5 pr-10 text-sm text-slate-100 placeholder-slate-500 shadow-sm transition-colors focus:outline-none focus:ring-1 ${
                errors.confirmPassword
                  ? 'border-rose-500 focus:border-rose-400 focus:ring-rose-400'
                  : 'border-slate-750 focus:border-cyan-400 focus:ring-cyan-400'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
              aria-label={showConfirmPassword ? 'Hide confirmed password' : 'Show confirmed password'}
            >
              {showConfirmPassword ? (
                <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                  />
                </svg>
              ) : (
                <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              )}
            </button>
          </div>
          {errors.confirmPassword && (
            <p id="signup-confirm-password-error" className="mt-1.5 text-xs text-rose-400" role="alert">
              {errors.confirmPassword}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-cyan-500/20 transition-all hover:from-blue-500 hover:to-cyan-400 hover:shadow-cyan-500/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <span>Creating Account...</span>
              </>
            ) : (
              <span>Create Account</span>
            )}
          </button>
        </div>
      </form>
    </AuthCard>
  );
}
