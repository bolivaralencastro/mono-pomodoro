import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FullscreenService {

  /**
   * Requests to enter fullscreen mode for the entire document.
   */
  async enterFullscreen(): Promise<void> {
    const element = document.documentElement;
    if (element.requestFullscreen) {
      try {
        await element.requestFullscreen();
      } catch (err) {
        // Silencioso, pois o usuário pode negar a permissão.
      }
    }
  }

  /**
   * Exits fullscreen mode if the document is currently in it.
   */
  async exitFullscreen(): Promise<void> {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch (err) {
        // Silencioso
      }
    }
  }
}
