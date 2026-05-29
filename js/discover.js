// === ColorForge — Discover/Social Module ===
window.Discover = {
  loadTrending() {
    const styles = [
      { icon: 'circle', name: 'Mandala', count: '2.4k pages', style: 'mandala' },
      { icon: 'sword', name: 'Fantasy', count: '1.8k pages', style: 'fantasy' },
      { icon: 'leaf', name: 'Botanical', count: '1.5k pages', style: 'botanical' },
      { icon: 'orbit', name: 'Abstract', count: '1.2k pages', style: 'abstract' },
      { icon: 'shapes', name: 'Geometric', count: '980 pages', style: 'geometric' },
      { icon: 'flower-2', name: 'Zen Garden', count: '820 pages', style: 'zen' },
    ];
    return styles;
  },
  loadPacks() {
    const packs = [
      { name: 'Mandala Mastery', pages: 50, price: '$3.99', icon: 'circle', id: 'mandala' },
      { name: 'Fantasy Realms', pages: 40, price: '$3.99', icon: 'sword', id: 'fantasy' },
      { name: 'Zen & Meditation', pages: 35, price: '$2.99', icon: 'flower-2', id: 'zen' },
      { name: 'Floral Collection', pages: 45, price: '$3.99', icon: 'leaf', id: 'botanical' },
    ];
    return packs;
  },
};
