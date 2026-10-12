import React from 'react';

export interface ChannelListing {
  id: string;
  name: string;
  handle: string;
  niche: string;
  subscribers: string;
  subscribersCount: number;
  monthlyViews: string;
  monetized: boolean;
  priceUsd: number;
  verifiedAnalytics: boolean;
  featuredBadge?: string;
  description: string;
}

export const SAMPLE_CHANNELS: ChannelListing[] = [
  {
    id: 'ch-tech-01',
    name: 'Apex Tech Reviews',
    handle: '@apextechreviews',
    niche: 'Technology & Gadgets',
    subscribers: '245K',
    subscribersCount: 245000,
    monthlyViews: '1.2M',
    monetized: true,
    priceUsd: 14500,
    verifiedAnalytics: true,
    featuredBadge: 'High Engagement',
    description: 'Hardware reviews and consumer tech guides with strong tier-1 audience demographics (US/UK/CA).',
  },
  {
    id: 'ch-fin-02',
    name: 'Wealth Matrix Daily',
    handle: '@wealthmatrixdaily',
    niche: 'Finance & Investing',
    subscribers: '180K',
    subscribersCount: 180000,
    monthlyViews: '850K',
    monetized: true,
    priceUsd: 22000,
    verifiedAnalytics: true,
    featuredBadge: 'High RPM',
    description: 'Personal finance breakdowns and market commentary with premium $28+ RPM niche metrics.',
  },
  {
    id: 'ch-game-03',
    name: 'Voxel Realm Studio',
    handle: '@voxelrealmstudio',
    niche: 'Gaming & Esports',
    subscribers: '520K',
    subscribersCount: 520000,
    monthlyViews: '3.4M',
    monetized: true,
    priceUsd: 18500,
    verifiedAnalytics: true,
    featuredBadge: 'Trending',
    description: 'Evergreen sandbox gaming tutorials and community compilations with consistent viral reach.',
  },
  {
    id: 'ch-life-04',
    name: 'Minimal Nordic Living',
    handle: '@nordicminimal',
    niche: 'Lifestyle & Architecture',
    subscribers: '95K',
    subscribersCount: 95000,
    monthlyViews: '420K',
    monetized: true,
    priceUsd: 7800,
    verifiedAnalytics: true,
    featuredBadge: 'Brand Sponsor Magnet',
    description: 'Aesthetic interior design tours and slow living documentation with devoted organic retention.',
  },
  {
    id: 'ch-edu-05',
    name: 'BioCode Academy',
    handle: '@biocodeacademy',
    niche: 'Education & Science',
    subscribers: '310K',
    subscribersCount: 310000,
    monthlyViews: '1.8M',
    monetized: true,
    priceUsd: 19500,
    verifiedAnalytics: true,
    featuredBadge: 'Evergreen Traffic',
    description: 'High-production science and programming explainers with recurring search-driven traffic curves.',
  },
  {
    id: 'ch-fit-06',
    name: 'Kinetic Movement Lab',
    handle: '@kineticlab',
    niche: 'Health & Fitness',
    subscribers: '140K',
    subscribersCount: 140000,
    monthlyViews: '690K',
    monetized: true,
    priceUsd: 9200,
    verifiedAnalytics: true,
    description: 'Home mobility workouts and sports science breakdowns with high brand sponsorship affinity.',
  },
];

interface ChannelCardProps {
  channel: ChannelListing;
}

export function ChannelCard({ channel }: ChannelCardProps) {
  return (
    <article className="group relative flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/80 p-5 backdrop-blur-sm transition-all duration-200 hover:-translate-y-1 hover:border-cyan-500/40 hover:bg-slate-900 hover:shadow-xl hover:shadow-cyan-950/20">
      {/* Top row: Niche badge & Optional featured badge */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center rounded-md bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-cyan-300 ring-1 ring-inset ring-cyan-500/20">
            {channel.niche}
          </span>
          {channel.featuredBadge && (
            <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/20">
              {channel.featuredBadge}
            </span>
          )}
        </div>

        {/* Channel Name & Handle */}
        <div className="mt-3.5">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white group-hover:text-cyan-300">
              {channel.name}
            </h3>
            {channel.monetized && (
              <span
                title="Monetization Active (Illustrative)"
                className="inline-flex h-5 items-center rounded-full bg-emerald-950/80 px-2 text-[10px] font-medium text-emerald-400 ring-1 ring-emerald-500/30"
              >
                Monetized
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">{channel.handle}</p>
        </div>

        {/* Short Description */}
        <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-slate-300">
          {channel.description}
        </p>

        {/* Metrics Grid */}
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-slate-800/80 bg-slate-950/50 p-2.5 text-center">
          <div>
            <span className="block text-[11px] uppercase tracking-wider text-slate-400">Subscribers</span>
            <span className="font-semibold text-slate-100">{channel.subscribers}</span>
          </div>
          <div className="border-l border-slate-800">
            <span className="block text-[11px] uppercase tracking-wider text-slate-400">Monthly Views</span>
            <span className="font-semibold text-slate-100">{channel.monthlyViews}</span>
          </div>
        </div>
      </div>

      {/* Bottom row: Illustrative Price & Action */}
      <div className="mt-5 border-t border-slate-800/80 pt-4">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400">
              Illustrative Price
            </span>
            <span className="text-xl font-bold tracking-tight text-white">
              ${channel.priceUsd.toLocaleString()}
            </span>
            <span className="ml-1 text-xs text-slate-400">USD</span>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-950/40 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-colors hover:border-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
            aria-label={`View sample listing for ${channel.name} (Preview)`}
          >
            Sample Preview
          </button>
        </div>
      </div>
    </article>
  );
}
