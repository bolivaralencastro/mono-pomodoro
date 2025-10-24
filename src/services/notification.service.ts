import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private audioContext: AudioContext | null = null;
  private alarmInterval: any = null;
  private audioEnabled: boolean = false;
  private audioUnlocked: boolean = false;

  /**
   * Initializes the AudioContext if it doesn't exist.
   * This is done lazily to comply with browser autoplay policies.
   * On iOS, we need user interaction to enable audio.
   */
  private createAudioContext(): void {
    if (this.audioContext) return;
    try {
      // iOS Safari requires different approach for Web Audio API
      const contextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new contextClass();
      
      // Handle iOS specific state issues
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
    } catch (e) {
      console.error('Web Audio API is not supported in this browser.');
    }
  }

  /**
   * Unlocks audio on the first user interaction (required for iOS Safari).
   * This is necessary because iOS Safari blocks Web Audio until user interaction.
   */
  enableAudio(): void {
    // Check if we need to unlock audio
    if (!this.audioUnlocked) {
      this.unlockAudio();
    }
    
    this.createAudioContext();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    this.audioEnabled = true;
  }

  private unlockAudio(): void {
    if (this.audioUnlocked || !this.audioContext) return;
    
    // Create a short silent buffer to play on the first user interaction
    const unlock = () => {
      if (this.audioContext) {
        // Create a silent buffer and play it to unlock audio
        const buffer = this.audioContext.createBuffer(1, 1, 22050);
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);
        source.start(0);
        
        // Clean up
        if (source.onended) {
          source.onended = null;
        }
        
        source.onended = () => {
          source.disconnect();
          this.audioUnlocked = true;
          
          // Remove the event listeners to prevent multiple unlocks
          document.body.removeEventListener('touchstart', unlock, true);
          document.body.removeEventListener('touchend', unlock, true);
          document.body.removeEventListener('mousedown', unlock, true);
          document.body.removeEventListener('keydown', unlock, true);
        };
      }
    };
    
    // Try to unlock audio on various user interaction events
    document.body.addEventListener('touchstart', unlock, true);
    document.body.addEventListener('touchend', unlock, true);
    document.body.addEventListener('mousedown', unlock, true);
    document.body.addEventListener('keydown', unlock, true);
    
    // Also try to unlock immediately when context is created
    unlock();
  }

  /**
   * Plays the alarm sound sequence once.
   */
  private playSoundSequence(): void {
    // On iOS, we need to ensure audio is unlocked first
    if (!this.audioUnlocked && this.audioContext && this.audioContext.state === 'suspended') {
      return; // Wait for user interaction to unlock audio
    }

    this.createAudioContext();
    if (!this.audioContext) return;

    try {
      // Resume context if suspended (common after user interaction on iOS)
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      // Create audio nodes
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.type = 'square'; // Alterado de 'sine' para 'square' para um som mais alto
      oscillator.frequency.setValueAtTime(880, this.audioContext.currentTime);
      oscillator.frequency.setValueAtTime(660, this.audioContext.currentTime + 0.2);
      oscillator.frequency.setValueAtTime(990, this.audioContext.currentTime + 0.4);

      gainNode.gain.setValueAtTime(0.0001, this.audioContext.currentTime);
      // Use volume 1.0 for maximum loudness.
      gainNode.gain.exponentialRampToValueAtTime(1.0, this.audioContext.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.6);

      oscillator.connect(gainNode).connect(this.audioContext.destination);
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.6);
      
      // Keep context alive on iOS by connecting to a dummy node if needed
      if (this.audioContext.state === 'running') {
        // Audio is playing, context is unlocked
        this.audioUnlocked = true;
      }
    } catch (e) {
      console.warn('Audio playback failed:', e);
      // Silencioso, o alarme é uma melhoria progressiva
    }
  }
  
  /**
   * Starts playing the alarm sound intermittently.
   */
  playAlarm(): void {
    this.enableAudio(); // Ensure audio is unlocked before playing alarm
    this.stopAlarm(); // Garante que não haja múltiplos alarmes tocando.

    // Try to play immediately
    this.playSoundSequence();
    
    // Then set up interval for continuous playing
    this.alarmInterval = setInterval(() => {
      if (this.audioUnlocked) {
        this.playSoundSequence();
      }
    }, 1000); // Repete a cada 1 segundo.
  }

  /**
   * Plays a short, subtle "tick" sound.
   */
  playTickSound(): void {
    this.enableAudio(); // Ensure audio is unlocked
    
    this.createAudioContext();
    if (!this.audioContext) return;

    // Resume context if suspended (common after user interaction on iOS)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    try {
      // Create audio nodes
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1200, this.audioContext.currentTime); // Frequência alta para um "blip"

      gainNode.gain.setValueAtTime(0.0001, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.1, this.audioContext.currentTime + 0.01); // Volume baixo e rápido
      gainNode.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.05); // Duração curta

      oscillator.connect(gainNode).connect(this.audioContext.destination);
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.05);
      
      // Confirm that audio is unlocked
      if (this.audioContext.state === 'running') {
        this.audioUnlocked = true;
      }
    } catch (e) {
      console.warn('Tick sound playback failed:', e);
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
