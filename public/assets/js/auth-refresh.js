/**
 * Renovación automática del access token via HttpOnly cookie.
 * El refresh_token viaja en cookie — no se almacena nada en localStorage.
 *
 * - Access token: 15 min
 * - Refresh token: 7 días
 * - Intervalo de renovación: 12 min
 */

(function initAutoRefresh() {
  const REFRESH_INTERVAL = 12 * 60 * 1000;
  let refreshTimer = null;

  const PROTECTED_PREFIXES = ['/app', '/admin', '/cuenta'];

  function isProtectedPage() {
    return PROTECTED_PREFIXES.some(p => window.location.pathname.startsWith(p));
  }

  async function refreshAccessToken() {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        return true;
      }

      if (response.status === 401 || response.status === 403) {
        stopAutoRefresh();
        if (isProtectedPage()) {
          window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(refreshAccessToken, REFRESH_INTERVAL);
  }

  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  // Arrancar siempre — si no hay sesión activa, el primer refresh retorna 401
  // y se detiene sin redirigir (salvo que sea página protegida).
  startAutoRefresh();

  window.authRefresh = { start: startAutoRefresh, stop: stopAutoRefresh, refresh: refreshAccessToken };
  window.addEventListener('beforeunload', stopAutoRefresh);
})();
