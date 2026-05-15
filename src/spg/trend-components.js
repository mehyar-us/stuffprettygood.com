export const AMAZON_ASSOCIATES_TAG = 'mehyarmedia-20';

export const trendOfferTargets = {
  'ai-note-takers': [
    { type: 'direct', label: 'AI meeting assistant shortlist', slug: 'ai-note-takers-software', url: '/ai-tool-stack-quiz.html', note: 'Software/referral lane; route to quiz until direct program approval.' },
    { type: 'service', label: 'AI workflow setup audit', slug: 'mehyarsoft-ai-audit', url: '/ai-readiness-score.html', note: 'In-house MehyarSoft setup lead; explicit consent only.' },
  ],
  'portable-power-stations': [
    { type: 'amazon_search', label: 'Portable power stations', slug: 'amazon-portable-power-stations', query: 'portable power station' },
    { type: 'amazon_search', label: 'Solar generator kits', slug: 'amazon-solar-generator-kits', query: 'solar generator kit' },
  ],
  'home-wellness-gadgets': [
    { type: 'amazon_search', label: 'Red light therapy gadgets', slug: 'amazon-red-light-therapy', query: 'red light therapy panel' },
    { type: 'amazon_search', label: 'Home sauna and recovery gadgets', slug: 'amazon-home-recovery-gadgets', query: 'home wellness gadgets' },
  ],
  'air-purifiers': [
    { type: 'amazon_search', label: 'Air purifiers for bedrooms and pets', slug: 'amazon-air-purifiers', query: 'air purifier bedroom pet' },
    { type: 'amazon_search', label: 'Small-space air quality monitors', slug: 'amazon-air-quality-monitors', query: 'air quality monitor indoor' },
  ],
  'walking-pad-desk': [
    { type: 'amazon_search', label: 'Walking pads for under desk', slug: 'amazon-walking-pads', query: 'walking pad under desk' },
    { type: 'amazon_search', label: 'Standing desk accessories', slug: 'amazon-standing-desk-gear', query: 'standing desk accessories' },
  ],
  'meal-prep-starter-kit': [
    { type: 'amazon_search', label: 'Meal prep containers', slug: 'amazon-meal-prep-containers', query: 'meal prep containers' },
    { type: 'amazon_search', label: 'Protein snack storage', slug: 'amazon-protein-snack-storage', query: 'protein snack organizer' },
  ],
  'pet-tech-safety': [
    { type: 'amazon_search', label: 'Dog GPS trackers', slug: 'amazon-dog-gps-trackers', query: 'dog gps tracker' },
    { type: 'amazon_search', label: 'Pet cameras and safety gear', slug: 'amazon-pet-cameras', query: 'pet camera treat dispenser' },
  ],
  'robot-vacuums-smart-home': [
    { type: 'amazon_search', label: 'Robot vacuums and mops', slug: 'amazon-robot-vacuums', query: 'robot vacuum and mop' },
    { type: 'amazon_search', label: 'Smart home helpers', slug: 'amazon-smart-home-helpers', query: 'smart home helper devices' },
  ],
  'travel-tech-esim': [
    { type: 'amazon_search', label: 'Travel tech accessories', slug: 'amazon-travel-tech', query: 'travel tech accessories' },
    { type: 'direct', label: 'eSIM comparison/watchlist', slug: 'travel-esim-watchlist', url: '/trends/travel-tech-esim.html#signup', note: 'Direct/referral program approval needed before monetized routing.' },
  ],
  'sleep-beauty-microtrends': [
    { type: 'amazon_search', label: 'Sleep bonnets and satin caps', slug: 'amazon-sleep-bonnets', query: 'sleep bonnet satin cap' },
    { type: 'amazon_search', label: 'Silk pillowcase and sleep routine', slug: 'amazon-sleep-beauty-routine', query: 'silk pillowcase sleep mask' },
  ],
  'weekend-hobby-kits': [
    { type: 'amazon_search', label: 'Indoor garden kits', slug: 'amazon-indoor-garden-kits', query: 'indoor garden kit with grow light' },
    { type: 'amazon_search', label: 'Weekend hobby starter kits', slug: 'amazon-weekend-hobby-kits', query: 'weekend hobby starter kit' },
  ],
};

export function amazonSearchUrl(query) {
  const url = new URL('https://www.amazon.com/s');
  url.searchParams.set('k', query);
  url.searchParams.set('tag', AMAZON_ASSOCIATES_TAG);
  return url.toString();
}

export function getLaneTargets(lane) {
  return trendOfferTargets[lane.slug] || [
    { type: 'amazon_search', label: lane.title, slug: `amazon-${lane.slug}`, query: lane.seed },
  ];
}

export function laneSeo(lane) {
  const year = new Date().getUTCFullYear();
  return {
    title: `${lane.title} — trending picks and signup guide`,
    description: `Track ${lane.seed} demand, compare practical ${lane.title.toLowerCase()} options, and opt into StuffPrettyGood updates. Updated from Google Trends signals for ${year}.`,
    h1: `${lane.title}: what is trending now`,
  };
}

export function riskCopy(risk) {
  if (risk === 'low') return 'Low-risk editorial lane: keep copy practical, avoid fake rankings, collect preference intent.';
  if (risk === 'medium') return 'Medium-risk lane: use conservative claims, no medical/financial outcomes, and keep affiliate disclosure visible.';
  return 'Needs review before outbound activation.';
}
