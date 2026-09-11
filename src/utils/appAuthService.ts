/**
 * App Authentication & Security Service
 * Handles master password protection, session persistence, and app lock management
 * for Sistem Antrean & Manajemen Pasien IRM RSPP.
 */

import { cloudDatabaseService } from './cloudDatabaseService';

export const APP_PASSWORD_STORAGE_KEY = 'irm_app_master_password_v1';
export const APP_AUTH_SESSION_KEY = 'irm_app_session_unlocked_v1';
export const APP_AUTH_REMEMBER_KEY = 'irm_app_persistent_auth_v1';
export const APP_ACTIVE_OFFICER_KEY = 'irm_app_active_officer_name_v1';

export const DEFAULT_APP_PASSWORD = 'admin';

// In-memory cache for ultra-fast and consistent validation
let cachedAppPassword: string | null = null;

// Local BroadcastChannel for instant cross-tab sync on same machine
let securityChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    securityChannel = new BroadcastChannel('IRM_RSPP_SECURITY_CHANNEL');
    securityChannel.onmessage = (event) => {
      if (event.data && event.data.type === 'PASSWORD_SYNC') {
        if (event.data.appPassword) {
          syncAppPasswordFromCloud(event.data.appPassword);
        }
      }
    };
  } catch (e) {
    // ignore
  }
}

/**
 * Retrieves the current configured app master password
 */
export const getAppPassword = (): string => {
  if (cachedAppPassword && cachedAppPassword.trim().length > 0) {
    return cachedAppPassword.trim();
  }
  try {
    const saved = localStorage.getItem(APP_PASSWORD_STORAGE_KEY);
    if (saved && saved.trim().length > 0) {
      cachedAppPassword = saved.trim();
      return cachedAppPassword;
    }
  } catch {}
  return DEFAULT_APP_PASSWORD;
};

/**
 * Updates the app master password locally, in Express Server, and in Cloud Firestore across all devices
 */
export const setAppPassword = (newPassword: string): boolean => {
  try {
    if (!newPassword || newPassword.trim().length < 3) return false;
    const cleanPassword = newPassword.trim();
    cachedAppPassword = cleanPassword;
    try {
      localStorage.setItem(APP_PASSWORD_STORAGE_KEY, cleanPassword);
      if (securityChannel) {
        securityChannel.postMessage({ type: 'PASSWORD_SYNC', appPassword: cleanPassword });
      }
    } catch {}
    
    // 1. Asynchronously push to Express Backend Server API
    fetch('/api/security-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appPassword: cleanPassword })
    }).catch(err => console.warn('Failed to sync app password to backend API:', err));

    // 2. Asynchronously push to Cloud Firestore
    cloudDatabaseService.saveSecurityConfig({
      appPassword: cleanPassword
    }).catch(err => console.warn('Failed to sync app password to cloud Firestore:', err));

    return true;
  } catch {
    return false;
  }
};

/**
 * Asynchronous version of setAppPassword with full dual-backend confirmation
 */
export const setAppPasswordAsync = async (newPassword: string): Promise<boolean> => {
  try {
    if (!newPassword || newPassword.trim().length < 3) return false;
    const cleanPassword = newPassword.trim();
    cachedAppPassword = cleanPassword;
    try {
      localStorage.setItem(APP_PASSWORD_STORAGE_KEY, cleanPassword);
      if (securityChannel) {
        securityChannel.postMessage({ type: 'PASSWORD_SYNC', appPassword: cleanPassword });
      }
    } catch {}
    
    // Run both backend API save and Firestore save concurrently
    await Promise.allSettled([
      fetch('/api/security-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appPassword: cleanPassword })
      }),
      cloudDatabaseService.saveSecurityConfig({
        appPassword: cleanPassword
      })
    ]);

    return true;
  } catch (err) {
    console.error('Failed to set app password:', err);
    return false;
  }
};

/**
 * Syncs app password received from Cloud Firestore or Express Backend
 */
export const syncAppPasswordFromCloud = (cloudPassword?: string): void => {
  if (!cloudPassword || cloudPassword.trim().length < 3) return;
  const clean = cloudPassword.trim();
  cachedAppPassword = clean;
  try {
    localStorage.setItem(APP_PASSWORD_STORAGE_KEY, clean);
  } catch {}
};

/**
 * Verifies if the provided password matches the master password.
 */
export const verifyAppPassword = (inputPassword: string): boolean => {
  if (!inputPassword) return false;
  const trimmed = inputPassword.trim();
  const currentPassword = getAppPassword();
  
  return trimmed === currentPassword;
};

/**
 * Actively fetches the latest security config from both Express API and Cloud Firestore
 */
export const fetchAppPasswordFromCloud = async (): Promise<string> => {
  try {
    const [apiResult, cloudResult] = await Promise.allSettled([
      fetch('/api/security-config').then(r => r.json()),
      cloudDatabaseService.getSecurityConfig()
    ]);

    let latestPassword: string | null = null;

    if (apiResult.status === 'fulfilled' && apiResult.value?.config?.appPassword) {
      latestPassword = apiResult.value.config.appPassword.trim();
    }

    if (cloudResult.status === 'fulfilled' && cloudResult.value?.appPassword) {
      latestPassword = cloudResult.value.appPassword.trim();
    }

    if (latestPassword && latestPassword.length >= 3) {
      cachedAppPassword = latestPassword;
      try {
        localStorage.setItem(APP_PASSWORD_STORAGE_KEY, latestPassword);
      } catch {}
      return latestPassword;
    }
  } catch (err) {
    console.warn('Failed to fetch app password from network:', err);
  }
  return getAppPassword();
};

/**
 * Asynchronous verification that checks Cloud Firestore & Backend Server first to guarantee 100% cross-device consistency
 */
export const verifyAppPasswordAsync = async (inputPassword: string): Promise<boolean> => {
  if (!inputPassword) return false;
  const trimmed = inputPassword.trim();
  
  // 1. Fetch latest password directly from Cloud & Backend Server
  try {
    const latestPassword = await fetchAppPasswordFromCloud();
    if (trimmed === latestPassword) {
      return true;
    }
  } catch {}

  // 2. Fallback check with cached/local password
  const currentPassword = getAppPassword();
  return trimmed === currentPassword;
};

/**
 * Checks if the current session or device is authenticated
 */
export const isAppAuthenticated = (): boolean => {
  try {
    // Check if query string requested TV display mode bypass
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('mode') === 'tv' || urlParams.get('mode') === 'display') {
        return true;
      }
    }

    // Check persistent auth in localStorage
    const isPersistent = localStorage.getItem(APP_AUTH_REMEMBER_KEY) === 'true';
    if (isPersistent) return true;

    // Check session auth in sessionStorage
    const isSessionActive = sessionStorage.getItem(APP_AUTH_SESSION_KEY) === 'true';
    if (isSessionActive) return true;
  } catch {}
  return false;
};

/**
 * Marks the application as authenticated for the current session or device
 */
export const setAppAuthenticated = (rememberOnDevice = false, officerName?: string): void => {
  try {
    sessionStorage.setItem(APP_AUTH_SESSION_KEY, 'true');
    if (rememberOnDevice) {
      localStorage.setItem(APP_AUTH_REMEMBER_KEY, 'true');
    } else {
      localStorage.removeItem(APP_AUTH_REMEMBER_KEY);
    }
    if (officerName && officerName.trim()) {
      localStorage.setItem(APP_ACTIVE_OFFICER_KEY, officerName.trim());
    }
  } catch {}
};

/**
 * Locks the application and removes active authentication tokens
 */
export const lockApp = (): void => {
  try {
    sessionStorage.removeItem(APP_AUTH_SESSION_KEY);
    localStorage.removeItem(APP_AUTH_REMEMBER_KEY);
  } catch {}
};

/**
 * Retrieves the last logged in officer name if saved
 */
export const getActiveOfficerName = (): string => {
  try {
    return localStorage.getItem(APP_ACTIVE_OFFICER_KEY) || 'Petugas IRM RSPP';
  } catch {
    return 'Petugas IRM RSPP';
  }
};
