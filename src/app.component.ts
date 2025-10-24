import { Component, ChangeDetectionStrategy, signal, computed, effect, inject, HostListener } from '@angular/core';
import { PomodoroState, TimerService } from './services/timer.service';
import { WakeLockService } from './services/wake-lock.service';
import { NotificationService } from './services/notification.service';
import { FullscreenService } from './services/fullscreen.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private timerService = inject(TimerService);
  private wakeLockService = inject(WakeLockService);
  private notificationService = inject(NotificationService);
  private fullscreenService = inject(FullscreenService);

  // Expondo sinais do serviço para o template
  state = this.timerService.state;
  minutes = this.timerService.minutes;
  countdownValue = this.timerService.countdownValue;
  breathingScale = this.timerService.breathingScale;
  
  // Sinais computados para controle da UI
  isSetting = computed(() => this.state() === PomodoroState.SETTING);
  isCountdown = computed(() => this.state() === PomodoroState.COUNTDOWN);
  isPaused = computed(() => this.state() === PomodoroState.PAUSED);
  isRunningOrPaused = computed(() => this.state() === PomodoroState.RUNNING || this.state() === PomodoroState.PAUSED);
  isBreathing = computed(() => this.state() === PomodoroState.BREATHING);
  isFinished = computed(() => this.state() === PomodoroState.FINISHED);
  
  /**
   * Determina se o timer estava no modo de respiração antes de ser pausado.
   * Essencial para renderizar a UI de pausa correta.
   */
  wasBreathing = computed(() => this.timerService.prePauseState() === PomodoroState.BREATHING);

  isTimerActive = computed(() => {
    const activeStates = [PomodoroState.RUNNING, PomodoroState.PAUSED, PomodoroState.BREATHING, PomodoroState.FINISHED];
    return activeStates.includes(this.state());
  });


  fillHeight = computed(() => {
    const total = this.timerService.totalMs();
    if (total === 0) return 0;
    const elapsed = this.timerService.elapsedMs();
    const ratio = Math.min(1, elapsed / total);
    return ratio * 100;
  });

  /**
   * Determina se os elementos da UI superior (reset, tempo) devem usar cores claras.
   * Isso acontece quando o fundo de preenchimento escuro está quase no topo da tela,
   * e APENAS se não estivermos no modo de respiração.
   */
  isLightOnDark = computed(() => this.fillHeight() > 95 && !this.isBreathing());

  timeDisplay = computed(() => {
    const remainingMs = this.timerService.totalMs() - this.timerService.elapsedMs();
    const s = Math.max(0, Math.ceil(remainingMs / 1000));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  });

  /**
   * Obtém as posições das linhas divisórias do serviço.
   */
  divisionLines = computed(() => {
    return this.timerService.divisionSteps().map(step => ({ bottom: step }));
  });

  buttonClasses = computed(() => {
    const staticClasses = 'absolute top-3.5 right-3.5 w-9 h-9 grid place-items-center cursor-pointer text-lg leading-none select-none active:scale-95 focus-visible:outline-dashed focus-visible:outline-2 focus-visible:outline-offset-[3px]';
    const dynamicClasses = this.isLightOnDark()
      ? 'text-white focus-visible:outline-white'
      : 'text-black focus-visible:outline-black';
    return `${staticClasses} ${dynamicClasses}`;
  });
  
  timeDisplayClasses = computed(() => {
    const staticClasses = 'absolute top-3.5 left-4 text-xs opacity-60';
    const dynamicClasses = this.isLightOnDark() ? 'text-white' : 'text-black';
    return `${staticClasses} ${dynamicClasses}`;
  });

  // Estado local para interações de arrastar
  private isDragging = signal(false);
  private startY = 0;
  private startMinutes = 0;

  constructor() {
    // Efeitos para reagir a mudanças de estado
    effect(() => {
      const currentState = this.state();

      if (currentState === PomodoroState.COUNTDOWN || currentState === PomodoroState.BREATHING) {
        this.fullscreenService.enterFullscreen();
      }
      
      if (currentState === PomodoroState.RUNNING || currentState === PomodoroState.BREATHING) {
        this.wakeLockService.requestWakeLock();
      } else {
        this.wakeLockService.releaseWakeLock();
      }

      if (currentState === PomodoroState.FINISHED) {
        this.notificationService.playAlarm();
        this.notificationService.vibrate([120, 80, 120]);
      }
    });
  }

  // ===== Listeners de Eventos Globais =====

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    // Enable audio on user interaction (required for iOS Safari)
    this.notificationService.enableAudio();
    
    if (event.key.toLowerCase() === 'r') {
      this.resetAll();
      return;
    }

    if (this.state() === PomodoroState.SETTING) {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.timerService.setMinutes(this.minutes() + 1);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.timerService.setMinutes(this.minutes() - 1);
      }
    }
  }

  @HostListener('document:visibilitychange')
  handleVisibilityChange() {
    const currentState = this.state();
    if (document.visibilityState === 'visible' && (currentState === PomodoroState.RUNNING || currentState === PomodoroState.BREATHING)) {
      this.wakeLockService.requestWakeLock();
    }
  }

  // ===== Manipuladores de Interação do Usuário =====

  onPointerDown(event: PointerEvent): void {
    event.preventDefault();
    // Enable audio on user interaction (required for iOS Safari)
    this.notificationService.enableAudio();
    
    switch (this.state()) {
      case PomodoroState.SETTING:
        this.isDragging.set(true);
        this.startY = event.clientY;
        this.startMinutes = this.minutes();
        break;
      case PomodoroState.RUNNING:
      case PomodoroState.BREATHING:
        this.timerService.pause();
        break;
      case PomodoroState.PAUSED:
        this.timerService.resume();
        break;
    }
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.isDragging() || this.state() !== PomodoroState.SETTING) return;
    const dy = this.startY - event.clientY; // Arrastar para cima aumenta
    const deltaMinutes = dy / 10; // Sensibilidade
    const newMinutes = this.startMinutes + deltaMinutes;
    this.timerService.setMinutes(newMinutes);
  }

  onPointerUp(event: PointerEvent): void {
    if (this.isDragging() && this.state() === PomodoroState.SETTING) {
      // Se for apenas um toque (pouco movimento), inicia o timer
      const distanceMoved = Math.abs(event.clientY - this.startY);
      if (distanceMoved < 5) {
        this.timerService.startCountdown();
      }
    }
    this.isDragging.set(false);
  }

  onWheel(event: WheelEvent): void {
    if (this.state() !== PomodoroState.SETTING) return;
    event.preventDefault();
    const step = -Math.sign(event.deltaY); // Invertido para ser mais intuitivo
    this.timerService.setMinutes(this.minutes() + step);
  }

  startBreathing(): void {
    this.notificationService.enableAudio(); // Enable audio on user interaction
    this.notificationService.stopAlarm();
    this.timerService.startBreathingSession();
  }

  restartPomodoro(): void {
    this.notificationService.enableAudio(); // Enable audio on user interaction
    this.notificationService.stopAlarm();
    this.timerService.restart();
  }

  resetAll(): void {
    this.notificationService.enableAudio(); // Enable audio on user interaction
    this.notificationService.stopAlarm();
    this.fullscreenService.exitFullscreen();
    this.timerService.reset(25);
  }
}