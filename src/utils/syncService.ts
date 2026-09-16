import { QueueBox, PatientItem, CallHistoryRecord, AppNotification, SavedOfficer, RanapQueueItem, CommunicationNote } from '../types';
import { cloudDatabaseService } from './cloudDatabaseService';
import { syncAppPasswordFromCloud } from './appAuthService';
import { syncDatabasePasswordFromCloud } from './databaseService';

export interface SyncDataState {
  boxes: QueueBox[];
  patients: PatientItem[];
  callLogs: CallHistoryRecord[];
  notifications: AppNotification[];
  savedOfficers?: SavedOfficer[];
  ranapQueue?: RanapQueueItem[];
  communicationNotes?: CommunicationNote[];
  deletedCommunicationNoteIds?: string[];
  currentCallingPatient?: PatientItem | null;
  currentCallingBox?: QueueBox | null;
  lastUpdated?: string;
  lastResetAt?: string;
  boxOrderUpdatedAt?: string | null;
  _senderDeviceId?: string;
  senderDeviceId?: string;
  deletedPatientIds?: string[];
  preResetPatientIds?: string[];
  deletedBoxIds?: string[];
  deletedRanapIds?: string[];
  isExplicitReset?: boolean;
  resetConfirmed?: boolean;
}

type SyncCallback = (data: SyncDataState) => void;

const DEVICE_ID = typeof window !== 'undefined' 
  ? 'device_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now()
  : 'server';

class RealtimeSyncManager {
  private listeners: Set<SyncCallback> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private eventSource: EventSource | null = null;
  private isConnected: boolean = false;
  private connectionStatusListeners: Set<(connected: boolean) => void> = new Set();
  private isCloudConnected: boolean = false;
  private retryCount: number = 0;
  private reconnectTimeoutId: any = null;
  private periodicReconciliationId: any = null;
  private lastBlurTime: number = 0;
  private lastReconcileTime: number = 0;
  private lastKnownFingerprint: string = '';

  constructor() {
    this.initBroadcastChannel();
    this.initLocalStorageAndNetworkListeners();
    this.initSSEConnection();
    this.initCloudFirestoreSync();
    this.startPeriodicReconciliation();
  }

  private initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('IRM_RSPP_QUEUE_CHANNEL');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && event.data.type === 'STATE_UPDATE' && event.data.senderDeviceId !== DEVICE_ID) {
            const incomingState = event.data.state;
            if (incomingState) {
              this.lastKnownFingerprint = `${incomingState.lastUpdated || ''}_${incomingState.patients?.length || 0}_${incomingState.boxes?.length || 0}_${incomingState.callLogs?.length || 0}_${incomingState.ranapQueue?.length || 0}`;
            }
            this.notifyListeners(incomingState);
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel not supported or blocked:', e);
      }
    }
  }

  private initLocalStorageAndNetworkListeners() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === 'IRM_RSPP_QUEUE_SYNC_STORAGE' && event.newValue) {
          try {
            const parsed = JSON.parse(event.newValue);
            if (parsed._senderDeviceId !== DEVICE_ID) {
              this.lastKnownFingerprint = `${parsed.lastUpdated || ''}_${parsed.patients?.length || 0}_${parsed.boxes?.length || 0}_${parsed.callLogs?.length || 0}_${parsed.ranapQueue?.length || 0}`;
              this.notifyListeners(parsed);
            }
          } catch (e) {
            // ignore
          }
        }
      });

      window.addEventListener('blur', () => {
        this.lastBlurTime = Date.now();
      });

      const handleWakeOrFocus = (force = false) => {
        const now = Date.now();
        // If window was just blurred for less than 4 seconds (e.g. native select dropdown, file picker, or quick click),
        // skip reconciliation to prevent re-rendering and flickering active UI elements
        if (!force && this.lastBlurTime > 0 && now - this.lastBlurTime < 4000) {
          return;
        }
        // Throttle focus reconciliation: at least 8 seconds between focus checks
        if (!force && now - this.lastReconcileTime < 8000) {
          return;
        }
        this.reconcileWithServer();
      };

      window.addEventListener('focus', () => handleWakeOrFocus(false));
      window.addEventListener('online', () => {
        handleWakeOrFocus(true);
        this.reconnectSSE();
      });

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          handleWakeOrFocus(false);
        }
      });
    }
  }

  public reconcileWithServer(): Promise<void> {
    this.lastReconcileTime = Date.now();
    return fetch('/api/queue')
      .then(res => res.json())
      .then(data => {
        if (data.status === 'ok' && data.state) {
          const boxImagesHash = (data.state.boxes || []).map((b: any) => `${b.id}:${(b.instructionImageUrls || []).length}:${b.instructionImageUrl || ''}`).join('|');
          const fingerprint = `${data.state.lastUpdated || ''}_${data.state.patients?.length || 0}_${data.state.boxes?.length || 0}_${boxImagesHash}_${data.state.callLogs?.length || 0}_${data.state.ranapQueue?.length || 0}`;
          if (fingerprint === this.lastKnownFingerprint) {
            // State is identical, skip triggering re-renders
            return;
          }
          this.lastKnownFingerprint = fingerprint;
          this.notifyListeners(data.state);
        }
      })
      .catch((err) => {
        console.warn('[Sync] Reconciliation fetch error:', err);
      });
  }

  private startPeriodicReconciliation() {
    if (typeof window === 'undefined') return;
    // Periodic background reconciliation every 30s as fail-safe for 30 devices
    if (this.periodicReconciliationId) clearInterval(this.periodicReconciliationId);
    this.periodicReconciliationId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.reconcileWithServer();
      }
    }, 30000);
  }

  private initSSEConnection() {
    if (typeof window === 'undefined') return;

    // Initial immediate state fetch
    this.reconcileWithServer();

    try {
      if (this.eventSource) {
        try {
          this.eventSource.close();
        } catch {}
        this.eventSource = null;
      }

      this.eventSource = new EventSource('/api/events');

      this.eventSource.onopen = () => {
        this.setConnected(true);
        this.retryCount = 0;
        // On connection open, reconcile once to ensure zero missed state packets
        this.reconcileWithServer();
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.senderDeviceId && data.senderDeviceId === DEVICE_ID) {
            return;
          }
          if ((data.type === 'INIT_STATE' || data.type === 'SYNC_STATE') && data.state) {
            this.notifyListeners(data.state);
          } else if (data.type === 'SECURITY_CONFIG_UPDATE' && data.config) {
            if (data.config.appPassword) {
              syncAppPasswordFromCloud(data.config.appPassword);
            }
            if (data.config.databasePassword) {
              syncDatabasePasswordFromCloud(data.config.databasePassword);
            }
          }
        } catch (err) {
          console.error('[SSE] Error parsing event data:', err);
        }
      };

      this.eventSource.onerror = () => {
        this.setConnected(false);
        this.scheduleSSEReconnect();
      };
    } catch (err) {
      console.warn('[SSE] Connection failed:', err);
      this.setConnected(false);
      this.scheduleSSEReconnect();
    }
  }

  private scheduleSSEReconnect() {
    if (this.reconnectTimeoutId) return;

    // Exponential backoff with jitter: 1s, 2s, 4s, ... max 10s
    const baseDelay = Math.min(1000 * Math.pow(1.8, this.retryCount), 10000);
    const jitter = Math.random() * 500;
    const delay = baseDelay + jitter;
    this.retryCount++;

    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      this.initSSEConnection();
    }, delay);
  }

  public reconnectSSE() {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    this.retryCount = 0;
    this.initSSEConnection();
  }

  // Cloud Firestore Realtime Sync
  private initCloudFirestoreSync() {
    if (typeof window === 'undefined') return;

    try {
      cloudDatabaseService.subscribeQueueState((cloudState) => {
        if (cloudState && cloudState._senderDeviceId !== DEVICE_ID) {
          this.isCloudConnected = true;
          this.setConnected(true);
          this.notifyListeners(cloudState);
        }
      }, (err) => {
        console.warn('Cloud Firestore listener warning:', err);
      });

      // Also listen to security config updates in Firestore
      cloudDatabaseService.subscribeSecurityConfig((config) => {
        if (config) {
          if (config.appPassword) {
            syncAppPasswordFromCloud(config.appPassword);
          }
          if (config.databasePassword) {
            syncDatabasePasswordFromCloud(config.databasePassword);
          }
        }
      }, (err) => {
        console.warn('Cloud Firestore security config subscription warning:', err);
      });
    } catch (err) {
      console.warn('Failed to start Cloud Firestore subscription:', err);
    }
  }

  private setConnected(status: boolean) {
    this.isConnected = status;
    this.connectionStatusListeners.forEach((fn) => fn(status));
  }

  public getDeviceId() {
    return DEVICE_ID;
  }

  public subscribe(callback: SyncCallback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public subscribeStatus(callback: (connected: boolean) => void) {
    this.connectionStatusListeners.add(callback);
    callback(this.isConnected);
    return () => {
      this.connectionStatusListeners.delete(callback);
    };
  }

  private notifyListeners(data: SyncDataState) {
    this.listeners.forEach((callback) => {
      try {
        callback(data);
      } catch (e) {
        console.error('Error executing sync listener:', e);
      }
    });
  }

  public async broadcastState(state: SyncDataState) {
    this.lastKnownFingerprint = `${state.lastUpdated || ''}_${state.patients?.length || 0}_${state.boxes?.length || 0}_${state.callLogs?.length || 0}_${state.ranapQueue?.length || 0}`;
    const payloadWithDevice = {
      ...state,
      _senderDeviceId: DEVICE_ID,
      senderDeviceId: DEVICE_ID,
      _timestamp: Date.now()
    };

    // 1. Notify local cross-tab BroadcastChannel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: 'STATE_UPDATE', state: payloadWithDevice, senderDeviceId: DEVICE_ID });
      } catch (e) {
        // ignore
      }
    }

    // 2. LocalStorage sync trigger
    try {
      localStorage.setItem('IRM_RSPP_QUEUE_SYNC_STORAGE', JSON.stringify({ ...payloadWithDevice, _ts: Date.now() }));
    } catch (e) {
      // ignore
    }

    // 3. Post to Express backend server for local network & SSE clients.
    // NOTE: Browser TIDAK lagi menulis langsung ke Cloud Firestore di sini.
    // Dulu ada 2 penulis independen ke dokumen Firestore yang sama (browser di sini
    // + server lewat mirror-nya sendiri) yang bisa saling menimpa penuh (last-write-wins,
    // tanpa merge) kalau 2 device menyimpan hampir bersamaan. Sekarang server adalah
    // SATU-SATUNYA penulis ke Firestore (server.ts: mirrorStateToFirestore, dipanggil
    // setelah reconcileQueueStates menggabungkan state dengan benar). Browser tetap
    // membaca update real-time dari Firestore lewat subscribeQueueState/getQueueState.
    try {
      if (state.isExplicitReset) {
        await fetch('/api/queue/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lastResetAt: state.lastResetAt,
            deletedPatientIds: state.deletedPatientIds,
            senderDeviceId: DEVICE_ID,
          }),
        });
      } else {
        await fetch('/api/queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadWithDevice),
        });
      }
    } catch (err) {
      console.warn('Failed to post state update to server:', err);
    }
  }
}

export const realtimeSync = new RealtimeSyncManager();
