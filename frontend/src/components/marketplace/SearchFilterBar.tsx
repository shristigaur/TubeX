import React, { useState, useEffect } from 'react';

export interface FilterValues {
  niche: string;
  subscribers: string;
  budget: string;
}

export const NICHE_LABEL_MAP: Record<string, string> = {
  all: 'All Niches',
  tech: 'Technology & Gadgets',
  finance: 'Finance & Investing',
  gaming: 'Gaming & Esports',
  lifestyle: 'Lifestyle & Architecture',
  education: 'Education & Science',
  fitness: 'Health & Fitness',
};

export const SUBSCRIBERS_LABEL_MAP: Record<string, string> = {
  all: 'Any Subscriber Count',
  '10k-50k': '10K – 50K',
  '50k-100k': '50K – 100K',
  '100k-500k': '100K – 500K',
  '500k+': '500K+',
};

export const BUDGET_LABEL_MAP: Record<string, string> = {
  all: 'Any Budget',
  'under-5k': 'Under $5,000',
  '5k-15k': '$5,000 – $15,000',
  '15k-30k': '$15,000 – $30,000',
  '30k+': '$30,000+',
};

export const DEFAULT_FILTERS: FilterValues = {
  niche: 'all',
  subscribers: 'all',
  budget: 'all',
};

interface SearchFilterBarProps {
  values?: FilterValues;
  onChange?: (field: keyof FilterValues, value: string) => void;
  onApplyFilters?: () => void;
  onResetFilters?: () => void;
  resultCount?: number;
  totalCount?: number;
  isFiltered?: boolean;
  isLoading?: boolean;
  resetSignal?: number;
}

export function SearchFilterBar({
  values = DEFAULT_FILTERS,
  onChange,
  onApplyFilters,
  onResetFilters,
  resultCount = 0,
  totalCount = 0,
  isFiltered = false,
  isLoading = false,
  resetSignal,
}: SearchFilterBarProps) {
  const [notice, setNotice] = useState<string | null>(null);

  // Reset notice when resetSignal changes from parent
  useEffect(() => {
    if (resetSignal) {
      setNotice(null);
    }
  }, [resetSignal]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onApplyFilters?.();

    const nicheLabel = NICHE_LABEL_MAP[values.niche] || values.niche;
    const subsLabel = SUBSCRIBERS_LABEL_MAP[values.subscribers] || values.subscribers;
    const budgetLabel = BUDGET_LABEL_MAP[values.budget] || values.budget;

    setNotice(
      `Filters applied: [Niche: ${nicheLabel}, Subs: ${subsLabel}, Budget: ${budgetLabel}].`
    );
  };

  const handleResetClick = () => {
    setNotice(null);
    onResetFilters?.();
  };

  return (
    <div
      id="marketplace-filters"
      className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 sm:p-6 shadow-2xl shadow-blue-950/30 backdrop-blur-md"
    >
      <form onSubmit={handleFilterSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        {/* Niche selector */}
        <div>
          <label htmlFor="filter-niche" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Channel Niche
          </label>
          <select
            id="filter-niche"
            value={values.niche}
            onChange={(e) => onChange?.('niche', e.target.value)}
            className="mt-1.5 block w-full rounded-lg border border-slate-750 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 shadow-sm focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          >
            <option value="all">All Niches</option>
            <option value="tech">Technology &amp; Gadgets</option>
            <option value="finance">Finance &amp; Investing</option>
            <option value="gaming">Gaming &amp; Esports</option>
            <option value="lifestyle">Lifestyle &amp; Architecture</option>
            <option value="education">Education &amp; Science</option>
            <option value="fitness">Health &amp; Fitness</option>
          </select>
        </div>

        {/* Subscriber Range */}
        <div>
          <label htmlFor="filter-subscribers" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Subscriber Count
          </label>
          <select
            id="filter-subscribers"
            value={values.subscribers}
            onChange={(e) => onChange?.('subscribers', e.target.value)}
            className="mt-1.5 block w-full rounded-lg border border-slate-750 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 shadow-sm focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          >
            <option value="all">Any Subscriber Count</option>
            <option value="10k-50k">10K – 50K</option>
            <option value="50k-100k">50K – 100K</option>
            <option value="100k-500k">100K – 500K</option>
            <option value="500k+">500K+</option>
          </select>
        </div>

        {/* Budget Range */}
        <div>
          <label htmlFor="filter-budget" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Budget Range
          </label>
          <select
            id="filter-budget"
            value={values.budget}
            onChange={(e) => onChange?.('budget', e.target.value)}
            className="mt-1.5 block w-full rounded-lg border border-slate-750 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 shadow-sm focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          >
            <option value="all">Any Budget</option>
            <option value="under-5k">Under $5,000</option>
            <option value="5k-15k">$5,000 – $15,000</option>
            <option value="15k-30k">$15,000 – $30,000</option>
            <option value="30k+">$30,000+</option>
          </select>
        </div>

        {/* Actions: Submit & Reset */}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-cyan-500/20 transition-all hover:from-blue-500 hover:to-cyan-400 hover:shadow-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
          >
            {isLoading ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Filtering...
              </>
            ) : (
              <>
                <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Filter Channels
              </>
            )}
          </button>
          {isFiltered && (
            <button
              type="button"
              onClick={handleResetClick}
              disabled={isLoading}
              title="Reset all filters"
              className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
            >
              Reset
            </button>
          )}
        </div>
      </form>

      {/* Filter feedback notice */}
      {notice && (
        <div
          role="status"
          aria-live="polite"
          className="mt-3.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cyan-500/30 bg-cyan-950/40 px-3.5 py-2.5 text-xs text-cyan-200"
        >
          <div>
            <span className="font-semibold text-cyan-300">Active Filters:</span> {notice}
            <span className="ml-1 text-slate-400">
              ({resultCount} of {totalCount} matches)
            </span>
          </div>
          {isFiltered && (
            <button
              type="button"
              onClick={handleResetClick}
              className="font-medium text-cyan-400 underline underline-offset-2 hover:text-cyan-200"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
