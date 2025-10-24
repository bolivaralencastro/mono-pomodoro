
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WakeLockService {
  private wakeLock: WakeLockSentinel | null = null;

  async requestWakeLock(): Promise<void> {
    if ('wakeLock' in navigator && document.visibilityState === 'visible') {
      try {
        if (!this.wakeLock) {
           this.wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch (err) {
        // Silencioso, pois esta é uma melhoria progressiva
        this.wakeLock = null;
      }
    }
  }

  async releaseWakeLock(): Promise<void> {
    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
        this.wakeLock = null;
      } catch (err) {
         // Silencioso
        this.wakeLock = null;
      }
    }
  }
}
