/**
 * Sistema de renovación automática de tokens
 * 
 * - Access token: 15 minutos
 * - Refresh token: 7 días
 * 
 * Este script renueva el access token automáticamente cada 12 minutos
 * para que el usuario nunca experimente una sesión expirada.
 */

(function initAutoRefresh() {
  const REFRESH_INTERVAL = 12 * 60 * 1000; // 12 minutos (antes de que expire el access token de 15 min)
  let refreshTimer = null;

  async function refreshAccessToken() {
    console.log('[Auth] Renovando access token...');
    
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include', // Envía las cookies con refresh_token
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[Auth] Token renovado exitosamente');
        
        // Si el servidor devuelve el nuevo token en JSON, actualizarlo en localStorage
        // (Nota: el nuevo token también viene en la cookie auth_token)
        if (data.token) {
          localStorage.setItem('adminToken', data.token);
        }
        
        return true;
      } else {
        console.warn('[Auth] No se pudo renovar el token:', response.status);
        
        // Si el refresh token también expiró (401 o 403), limpiar y redirigir
        if (response.status === 401 || response.status === 403) {
          console.log('[Auth] Refresh token expirado, cerrando sesión...');
          localStorage.removeItem('adminToken');
          localStorage.removeItem('userName');
          
          // Solo redirigir si estamos en una página protegida
          const isProtectedPage = window.location.pathname.startsWith('/app') || 
                                  window.location.pathname.startsWith('/admin') ||
                                  window.location.pathname === '/cuenta';
          
          if (isProtectedPage) {
            window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
          }
        }
        
        return false;
      }
    } catch (error) {
      console.error('[Auth] Error al renovar token:', error);
      return false;
    }
  }

  function startAutoRefresh() {
    // Solo iniciar si hay un token
    const token = localStorage.getItem('adminToken');
    if (!token) {
      console.log('[Auth] No hay token, auto-refresh no iniciado');
      return;
    }

    console.log('[Auth] Auto-refresh iniciado (cada 12 minutos)');
    
    // Renovar inmediatamente si el token está cerca de expirar
    // (esto es útil si el usuario recarga la página después de varios minutos)
    refreshAccessToken();
    
    // Luego renovar cada 12 minutos
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }
    
    refreshTimer = setInterval(refreshAccessToken, REFRESH_INTERVAL);
  }

  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
      console.log('[Auth] Auto-refresh detenido');
    }
  }

  // Iniciar automáticamente al cargar la página
  startAutoRefresh();

  // Exponer funciones globalmente para control manual si es necesario
  window.authRefresh = {
    start: startAutoRefresh,
    stop: stopAutoRefresh,
    refresh: refreshAccessToken,
  };

  // Limpiar al cerrar/recargar la página
  window.addEventListener('beforeunload', stopAutoRefresh);
})();
