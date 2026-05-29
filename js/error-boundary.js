// === ColorForge — Error Boundary ===
// Catches unhandled errors and shows a friendly recovery UI
window.ErrorBoundary = {
  init() {
    window.addEventListener('error', (event) => {
      console.error('Unhandled error:', event.error);
      this.showRecovery(event.error?.message || 'Something went wrong');
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      event.preventDefault();
      this.showRecovery(event.reason?.message || 'Something went wrong');
    });
  },

  showRecovery(message) {
    // Don't stack multiple error overlays
    if (document.getElementById('error-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'error-overlay';
    overlay.innerHTML = `
      <div class="error-dialog">
        <div class="error-icon">⚠️</div>
        <h2>Oops! Something went wrong</h2>
        <p class="error-msg">${this.sanitize(message)}</p>
        <div class="error-actions">
          <button class="btn btn-primary" onclick="ErrorBoundary.recover()">🔄 Try Again</button>
          <button class="btn btn-secondary" onclick="ErrorBoundary.goHome()">🏠 Go Home</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  recover() {
    document.getElementById('error-overlay')?.remove();
    window.app.navigate('discover');
    window.app.init();
  },

  goHome() {
    document.getElementById('error-overlay')?.remove();
    window.app.navigate('discover');
  },

  sanitize(msg) {
    const div = document.createElement('div');
    div.textContent = msg;
    return div.innerHTML;
  },
};

// Wrap async operations with safety net
window.safeAsync = async function(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.error('Safe async error:', err);
    if (fallback) return fallback();
    throw err;
  }
};
