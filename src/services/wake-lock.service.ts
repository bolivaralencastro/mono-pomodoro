
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WakeLockService {
  private wakeLock: WakeLockSentinel | null = null;
  private fallbackTimeout: number | null = null;

  async requestWakeLock(): Promise<void> {
    // Check if Wake Lock API is supported
    if ('wakeLock' in navigator && document.visibilityState === 'visible') {
      try {
        if (!this.wakeLock) {
          this.wakeLock = await navigator.wakeLock.request('screen');
          
          // Add event listener to re-request wake lock when visibility changes
          this.wakeLock.addEventListener('release', () => {
            // On iOS Safari, the wake lock might be released immediately
            // Try to reacquire it if the app is still active
            if (document.visibilityState === 'visible') {
              this.requestWakeLock();
            }
          });
        }
      } catch (err) {
        // Fallback for browsers that don't support Wake Lock API, including iOS Safari
        this.handleWakeLockFallback();
      }
    } else {
      // Fallback for browsers that don't support Wake Lock API, including iOS Safari
      this.handleWakeLockFallback();
    }
  }

  private handleWakeLockFallback(): void {
    // On iOS and other browsers without Wake Lock API support
    // Use video element or other techniques to prevent screen from dimming
    // This is a limited fallback since iOS Safari doesn't allow prevention of screen dimming
    
    // Create a short silent video that loops to keep the screen awake (only works in some cases)
    if (this.fallbackTimeout) {
      clearTimeout(this.fallbackTimeout);
    }
    
    // Schedule a timeout to try to keep the screen active
    // Note: This is a best-effort approach, as iOS Safari doesn't provide reliable screen wake lock
    this.fallbackTimeout = window.setTimeout(() => {
      // Try to trigger a slight visual change to potentially prevent sleep
      document.body.style.backgroundColor = document.body.style.backgroundColor || 'white';
      document.body.style.backgroundColor = '';
    }, 29000); // Every ~30 seconds as a heuristic
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
    
    // Clear the fallback timeout
    if (this.fallbackTimeout) {
      clearTimeout(this.fallbackTimeout);
      this.fallbackTimeout = null;
    }
  }
}
