import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private audioContext: AudioContext | null = null;
  private alarmInterval: any = null;

  /**
   * Initializes the AudioContext if it doesn't exist.
   * This is done lazily to comply with browser autoplay policies.
   */
  private createAudioContext(): void {
    if (this.audioContext) return;
    try {
      this.audioContext = new window.AudioContext();
    } catch (e) {
      // Silently fail if AudioContext is not supported.
      console.error('Web Audio API is not supported in this browser.');
    }
  }

  /**
   * Plays the alarm sound sequence once.
   */
  private playSoundSequence(): void {
    if (!this.audioContext) {
      return;
    }

    try {
      const now = this.audioContext.currentTime;
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.type = 'square'; // Alterado de 'sine' para 'square' para um som mais alto
      oscillator.frequency.setValueAtTime(880, now);
      oscillator.frequency.setValueAtTime(660, now + 0.2);
      oscillator.frequency.setValueAtTime(990, now + 0.4);

      gainNode.gain.setValueAtTime(0.0001, now);
      // Use volume 1.0 for maximum loudness.
      gainNode.gain.exponentialRampToValueAtTime(1.0, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

      oscillator.connect(gainNode).connect(this.audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.6);
    } catch (e) {
      // Silencioso, o alarme é uma melhoria progressiva
    }
  }
  
  /**
   * Starts playing the alarm sound intermittently.
   */
  playAlarm(): void {
    this.createAudioContext();
    this.stopAlarm(); // Garante que não haja múltiplos alarmes tocando.

    this.playSoundSequence(); // Toca imediatamente na primeira vez.
    this.alarmInterval = setInterval(() => {
      this.playSoundSequence();
    }, 1000); // Repete a cada 1 segundo.
  }

  /**
   * Plays a short, subtle "tick" sound.
   */
  playTickSound(): void {
    this.createAudioContext();
    if (!this.audioContext) return;

    try {
      const now = this.audioContext.currentTime;
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1200, now); // Frequência alta para um "blip"

      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.exponentialRampToValueAtTime(0.1, now + 0.01); // Volume baixo e rápido
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.05); // Duração curta

      oscillator.connect(gainNode).connect(this.audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.05);
    } catch (e) {
      // Silencioso
    }
  }

  /**
   * Stops the intermittent alarm sound.
   */
  stopAlarm(): void {
    if (this.alarmInterval) {
      clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
  }

  vibrate(pattern: VibratePattern): void {
    if (navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        // Silencioso
      }
    }
  }
}
