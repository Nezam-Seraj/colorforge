// === ColorForge — Discover Screen Data ===
// Content feeds, daily challenges, style data

window.DiscoverData = {
  // Daily challenges rotate weekly
  weeklyChallenges: [
    { title: 'Enchanted Forest', desc: 'Mystical woodland with hidden creatures', mood: 'meditative', style: 'botanical' },
    { title: 'Cosmic Mandala', desc: 'Stars and planets in perfect harmony', mood: 'creative', style: 'mandala' },
    { title: 'Ocean Depths', desc: 'Coral reefs and sea creatures', mood: 'meditative', style: 'zen' },
    { title: 'Steampunk Workshop', desc: 'Gears and Victorian machinery', mood: 'bored', style: 'architecture' },
    { title: 'Japanese Garden', desc: 'Koi ponds and cherry blossoms', mood: 'anxious', style: 'zen' },
    { title: 'Dragon\'s Lair', desc: 'A sleeping dragon with treasure', mood: 'creative', style: 'fantasy' },
    { title: 'Neon City', desc: 'Futuristic skyline at twilight', mood: 'bored', style: 'architecture' },
    { title: 'Wildflower Meadow', desc: 'Rolling hills of wild blooms', mood: 'meditative', style: 'botanical' },
  ],

  trendingStyles: [
    { icon: '🕉️', name: 'Mandala', count: '2.4k pages', style: 'mandala' },
    { icon: '🐉', name: 'Fantasy', count: '1.8k pages', style: 'fantasy' },
    { icon: '🌿', name: 'Botanical', count: '1.5k pages', style: 'botanical' },
    { icon: '🌀', name: 'Abstract', count: '1.2k pages', style: 'abstract' },
    { icon: '📐', name: 'Geometric', count: '980 pages', style: 'geometric' },
    { icon: '🧘', name: 'Zen Garden', count: '820 pages', style: 'zen' },
  ],

  stylePacks: [
    { name: 'Mandala Mastery', pages: 50, price: '$3.99', icon: '🕉️', id: 'mandala' },
    { name: 'Fantasy Realms', pages: 40, price: '$3.99', icon: '🐉', id: 'fantasy' },
    { name: 'Zen & Meditation', pages: 35, price: '$2.99', icon: '🧘', id: 'zen' },
    { name: 'Floral Collection', pages: 45, price: '$3.99', icon: '🌺', id: 'botanical' },
  ],

  // Get daily challenge based on date
  getDailyChallenge() {
    const today = new Date();
    const weekIndex = Math.floor(today.getTime() / (7 * 86400000)) % this.weeklyChallenges.length;
    return this.weeklyChallenges[weekIndex];
  },
};
