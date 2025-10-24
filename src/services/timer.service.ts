import { Injectable, signal, inject } from '@angular/core';
import { NotificationService } from './notification.service';

export enum PomodoroState {
  SETTING = 'setting',
  COUNTDOWN = 'countdown',
  RUNNING = 'running',
  PAUSED = 'paused',
  FINISHED = 'finished',
  BREATHING = 'breathing',
}

@Injectable({ providedIn: 'root' })
export class TimerService {
  private notificationService = inject(NotificationService);

  readonly state = signal<PomodoroState>(PomodoroState.SETTING);
  readonly minutes = signal(25);
  readonly totalMs = signal(25 * 60 * 1000);
  readonly elapsedMs = signal(0);
  readonly countdownValue = signal(3);
  readonly breathingScale = signal(1);
  readonly prePauseState = signal<PomodoroState | null>(null);
  readonly divisionSteps = signal<number[]>([]);

  private startMs = 0;
  private rafId = 0;
  private countdownInterval: any = null;
  private lastPlayedStep = -1;

  constructor() {}

  setMinutes(newMinutes: number) {
    if (this.state() !== PomodoroState.SETTING) return;
    const clampedMinutes = Math.max(1, Math.min(60, Math.round(newMinutes)));
    this.minutes.set(clampedMinutes);
    this.totalMs.set(clampedMinutes * 60 * 1000);
    this.calculateDivisionSteps();
  }

  startCountdown() {
    if (this.state() !== PomodoroState.SETTING) return;
    this.state.set(PomodoroState.COUNTDOWN);
    this.countdownValue.set(3);
    
    this.countdownInterval = setInterval(() => {
        this.countdownValue.update(v => v - 1);
        if(this.countdownValue() <= 0) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
            this.startTimer();
        }
    }, 1000);
  }

  startBreathingSession() {
    if (this.state() !== PomodoroState.FINISHED) return;
    this.minutes.set(5);
    this.totalMs.set(5 * 60 * 1000);
    this.calculateDivisionSteps();
    this.state.set(PomodoroState.BREATHING);
    this.startTimer();
  }

  private startTimer() {
    this.elapsedMs.set(0);
    this.startMs = performance.now();
    this.lastPlayedStep = -1; // Reseta o rastreador de ticks

    // Se estava na contagem regressiva, muda pra RUNNING. Se não, assume o estado atual (BREATHING).
    if (this.state() === PomodoroState.COUNTDOWN) {
      this.state.set(PomodoroState.RUNNING);
    }
    this.loop();
  }

  pause() {
    const currentState = this.state();
    if (currentState !== PomodoroState.RUNNING && currentState !== PomodoroState.BREATHING) return;
    this.cancelLoop();
    this.prePauseState.set(currentState);
    this.state.set(PomodoroState.PAUSED);
  }
  
  resume() {
    const prePause = this.prePauseState();
    if (this.state() !== PomodoroState.PAUSED || !prePause) return;
    this.state.set(prePause);
    this.prePauseState.set(null);
    this.startMs = performance.now() - this.elapsedMs();
    this.loop();
  }

  /**
   * Reinicia o timer com a mesma duração anterior, começando da contagem regressiva.
   * Chamado a partir da tela de conclusão.
   */
  restart() {
    if (this.state() !== PomodoroState.FINISHED) return;

    this.elapsedMs.set(0);
    this.prePauseState.set(null);
    
    // Inicia diretamente a contagem regressiva
    this.state.set(PomodoroState.COUNTDOWN);
    this.countdownValue.set(3);
    
    this.countdownInterval = setInterval(() => {
        this.countdownValue.update(v => v - 1);
        if(this.countdownValue() <= 0) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
            this.startTimer();
        }
    }, 1000);
  }

  reset(defaultMinutes = 25) {
    this.cancelLoop();
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    this.prePauseState.set(null);
    this.elapsedMs.set(0);
    this.minutes.set(defaultMinutes);
    this.totalMs.set(defaultMinutes * 60 * 1000);
    this.breathingScale.set(1);
    this.calculateDivisionSteps();
    this.lastPlayedStep = -1;
    this.state.set(PomodoroState.SETTING);
  }

  private loop() {
    this.rafId = requestAnimationFrame(() => this.loop());
    const now = performance.now();
    const currentElapsed = now - this.startMs;
    this.elapsedMs.set(currentElapsed);

    // Lógica da animação de respiração procedural
    if (this.state() === PomodoroState.BREATHING) {
      const cycleDuration = 10000; // 10 segundos (4s inalar, 6s exalar)
      const inhaleDuration = 4000;
      const minScale = 0.85;
      const maxScale = 1.0;

      const timeInCycle = currentElapsed % cycleDuration;
      
      let scale;
      if (timeInCycle < inhaleDuration) {
        // Fase de inalação
        const progress = timeInCycle / inhaleDuration;
        scale = minScale + (maxScale - minScale) * progress;
      } else {
        // Fase de exalação
        const progress = (timeInCycle - inhaleDuration) / (cycleDuration - inhaleDuration);
        scale = maxScale - (maxScale - minScale) * progress;
      }
      this.breathingScale.set(scale);
    }
    
    // Lógica para tocar som nos marcadores de tempo
    const progressPercent = (currentElapsed / this.totalMs()) * 100;
    const steps = this.divisionSteps();
    for (const step of steps) {
      if (progressPercent >= step && step > this.lastPlayedStep) {
        this.lastPlayedStep = step;
        this.notificationService.playTickSound();
        break; // Toca apenas um som por frame
      }
    }


    if (currentElapsed >= this.totalMs()) {
      this.elapsedMs.set(this.totalMs());
      this.state.set(PomodoroState.FINISHED);
      this.cancelLoop();
    }
  }
  
  private calculateDivisionSteps(): void {
    const m = this.minutes();
    let numSections: number;

    if (m === 1) numSections = 4;
    else if (m < 10) numSections = m;
    else if (m % 5 === 0) numSections = m / 5;
    else if (m % 2 === 0) numSections = m / 2;
    else numSections = m;

    if (numSections <= 1) {
      this.divisionSteps.set([]);
      return;
    }

    const steps = [];
    const stepSize = 100 / numSections;
    for (let i = 1; i < numSections; i++) {
      steps.push(i * stepSize);
    }
    this.divisionSteps.set(steps);
  }

  private cancelLoop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }
}