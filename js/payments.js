// === ColorForge — Payments & Google Play Billing ===
window.Payments = {

  // Product IDs (configured in Google Play Console)
  products: {
    pro_monthly: 'colorforge.pro.monthly',
    pro_lifetime: 'colorforge.pro.lifetime',
    pack_mandala: 'colorforge.pack.mandala',
    pack_fantasy: 'colorforge.pack.fantasy',
    pack_botanical: 'colorforge.pack.botanical',
    pack_zen: 'colorforge.pack.zen',
  },

  // Check if running in Android/Play Store context
  isPlayStore() {
    return typeof window.Android !== 'undefined' || 
           window.location.href.includes('play.google.com') ||
           navigator.userAgent.includes('Android');
  },

  // Google Play Billing integration
  // This is called when user taps a purchase button
  launchGooglePlayBilling(plan) {
    const productId = this.products[plan] || plan;

    if (typeof window.Android !== 'undefined' && window.Android.launchBilling) {
      // Native Android bridge
      window.Android.launchBilling(JSON.stringify({
        productId,
        plan,
      }));
    } else {
      // Web/development fallback — simulate purchase
      console.log(`[Payments] Would launch Google Play Billing for: ${productId}`);
      this.handlePurchaseResult({ success: true, plan, productId });
    }
  },

  // Called by Google Play Billing callback
  handlePurchaseResult(result) {
    if (result.success) {
      app.upgradeToPro();

      // Track purchase (analytics placeholder)
      console.log('[Payments] Purchase successful:', result);

      // Show confirmation
      app.toast('Purchase successful! Welcome to Pro 🎉');
      app.navigate('discover');
    } else {
      app.toast('Purchase failed. Please try again.');
    }
  },

  // Restore purchases (called on app start)
  async restorePurchases() {
    if (this.isPlayStore()) {
      // Query Google Play for existing purchases
      if (typeof window.Android !== 'undefined' && window.Android.queryPurchases) {
        window.Android.queryPurchases();
      }
    }

    // Check local storage as fallback
    const isPro = localStorage.getItem('colorforge_isPro');
    if (isPro === 'true') {
      app.upgradeToPro();
    }
  },

  // Style pack purchase handler
  purchasePack(packId) {
    if (app.isPro) {
      // Pro users get packs included
      app.toast('Style pack unlocked! 🎉');
      return;
    }
    this.launchGooglePlayBilling(`pack_${packId}`);
  },

  // Setup Google Play Billing Lib bridge
  // Called by native Android code after purchase flow completes
  onPurchaseAcknowledged(productId, purchaseToken) {
    console.log(`[Payments] Purchase acknowledged: ${productId}`);
    this.handlePurchaseResult({ success: true, plan: productId, token: purchaseToken });
  },

  // Google Play Store listing URL
  getStoreUrl() {
    return 'https://play.google.com/store/apps/details?id=com.colorforge.app';
  },
};

// Restore purchases on load
document.addEventListener('DOMContentLoaded', () => {
  Payments.restorePurchases();
});
