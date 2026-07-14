import type { PlayerInput } from '../types/game';
import { clampAnalogInput } from './analogInput';

export type InputAction =
  'forward' | 'backward' | 'left' | 'right' | 'boost' | 'interact';

export interface InputSources {
  keyboardThrottle: number;
  keyboardTurn: number;
  pointerThrottle: number;
  pointerTurn: number;
  touchThrottle: number;
  joystickTurn: number;
  autoThrottle: number;
}

export interface AutoThrottleState {
  enabled: boolean;
  targetThrottle: number;
}

export type AutoThrottleStatus = 'off' | 'active' | 'suspended';

export interface InputDiagnostics extends InputSources {
  throttle: number;
  turn: number;
  boost: boolean;
  interact: boolean;
  autoThrottleStatus: AutoThrottleStatus;
  pointerActive: boolean;
}

const keyActions: Readonly<Record<string, InputAction>> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'backward',
  ArrowDown: 'backward',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'boost',
  ShiftRight: 'boost',
  Space: 'interact',
};

function digitalAxis(
  actions: ReadonlySet<InputAction>,
  positive: InputAction,
  negative: InputAction,
): number {
  return Number(actions.has(positive)) - Number(actions.has(negative));
}

export class InputController {
  private readonly keyboardActions = new Set<InputAction>();
  private readonly pointerActions = new Set<InputAction>();
  private readonly pointerReleaseTimers = new Map<
    InputAction,
    ReturnType<typeof setTimeout>
  >();
  private readonly listeners = new Set<() => void>();
  private touchThrottle = 0;
  private joystickTurn = 0;
  private autoThrottle: AutoThrottleState = {
    enabled: false,
    targetThrottle: 0.72,
  };
  private autoThrottleScale = 1;
  private activePointerCount = 0;

  bindKeyboard(
    target: Window,
    onTogglePause: () => void,
    onRecalculateRoute: () => void = () => undefined,
  ): () => void {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        if (!event.repeat) onTogglePause();
        event.preventDefault();
        return;
      }
      if (
        event.code === 'KeyR' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        if (!event.repeat) onRecalculateRoute();
        event.preventDefault();
        return;
      }

      const action = keyActions[event.code];
      if (!action || event.metaKey || event.ctrlKey || event.altKey) return;
      const sizeBefore = this.keyboardActions.size;
      this.keyboardActions.add(action);
      if (action === 'backward') this.disableAutoThrottle();
      if (this.keyboardActions.size !== sizeBefore) this.notify();
      event.preventDefault();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const action = keyActions[event.code];
      if (!action) return;
      if (this.keyboardActions.delete(action)) this.notify();
      event.preventDefault();
    };

    const clearKeyboard = () => {
      if (this.keyboardActions.size === 0) return;
      this.keyboardActions.clear();
      this.notify();
    };
    const clearInterruptedInput = () => this.clearAllInput();
    target.addEventListener('keydown', handleKeyDown, { passive: false });
    target.addEventListener('keyup', handleKeyUp, { passive: false });
    target.addEventListener('blur', clearInterruptedInput);

    return () => {
      target.removeEventListener('keydown', handleKeyDown);
      target.removeEventListener('keyup', handleKeyUp);
      target.removeEventListener('blur', clearInterruptedInput);
      clearKeyboard();
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setPointerAction(action: InputAction, active: boolean): void {
    const releaseTimer = this.pointerReleaseTimers.get(action);
    if (releaseTimer) clearTimeout(releaseTimer);
    this.pointerReleaseTimers.delete(action);
    const changed = active
      ? !this.pointerActions.has(action)
      : this.pointerActions.has(action);
    if (active) this.pointerActions.add(action);
    else this.pointerActions.delete(action);
    if (active && action === 'backward') this.disableAutoThrottle();
    if (changed) this.notify();
  }

  releasePointerAction(action: InputAction, delayMilliseconds = 0): void {
    const releaseTimer = this.pointerReleaseTimers.get(action);
    if (releaseTimer) clearTimeout(releaseTimer);
    if (delayMilliseconds <= 0) {
      this.pointerReleaseTimers.delete(action);
      if (this.pointerActions.delete(action)) this.notify();
      return;
    }
    this.pointerReleaseTimers.set(
      action,
      setTimeout(() => {
        const changed = this.pointerActions.delete(action);
        this.pointerReleaseTimers.delete(action);
        if (changed) this.notify();
      }, delayMilliseconds),
    );
  }

  setTouchThrottle(value: number): void {
    const next = clampAnalogInput(value);
    if (next < 0) this.disableAutoThrottle();
    if (this.touchThrottle === next) return;
    this.touchThrottle = next;
    this.notify();
  }

  setJoystickTurn(value: number): void {
    const next = clampAnalogInput(value);
    if (this.joystickTurn === next) return;
    this.joystickTurn = next;
    this.notify();
  }

  setAutoThrottle(enabled: boolean, targetThrottle = 0.72): void {
    const next = {
      enabled,
      targetThrottle: Math.max(0, clampAnalogInput(targetThrottle)),
    };
    if (
      this.autoThrottle.enabled === next.enabled &&
      this.autoThrottle.targetThrottle === next.targetThrottle
    ) {
      return;
    }
    this.autoThrottle = next;
    this.notify();
  }

  toggleAutoThrottle(targetThrottle = 0.72): boolean {
    this.setAutoThrottle(!this.autoThrottle.enabled, targetThrottle);
    return this.autoThrottle.enabled;
  }

  disableAutoThrottle(): void {
    if (!this.autoThrottle.enabled) return;
    this.autoThrottle = { ...this.autoThrottle, enabled: false };
    this.notify();
  }

  setAutoThrottleScale(value: number): void {
    const next = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));
    if (this.autoThrottleScale === next) return;
    this.autoThrottleScale = next;
    this.notify();
  }

  setPointerActive(active: boolean): void {
    this.activePointerCount = Math.max(
      0,
      this.activePointerCount + (active ? 1 : -1),
    );
    this.notify();
  }

  clearPointerActions(): void {
    const changed =
      this.pointerActions.size > 0 ||
      this.touchThrottle !== 0 ||
      this.joystickTurn !== 0 ||
      this.activePointerCount !== 0;
    for (const timer of this.pointerReleaseTimers.values()) clearTimeout(timer);
    this.pointerReleaseTimers.clear();
    this.pointerActions.clear();
    this.touchThrottle = 0;
    this.joystickTurn = 0;
    this.activePointerCount = 0;
    if (changed) this.notify();
  }

  clearAllInput(): void {
    const changed =
      this.keyboardActions.size > 0 ||
      this.pointerActions.size > 0 ||
      this.pointerReleaseTimers.size > 0 ||
      this.touchThrottle !== 0 ||
      this.joystickTurn !== 0 ||
      this.autoThrottle.enabled ||
      this.activePointerCount !== 0;
    for (const timer of this.pointerReleaseTimers.values()) clearTimeout(timer);
    this.pointerReleaseTimers.clear();
    this.keyboardActions.clear();
    this.pointerActions.clear();
    this.touchThrottle = 0;
    this.joystickTurn = 0;
    this.autoThrottle = { ...this.autoThrottle, enabled: false };
    this.autoThrottleScale = 1;
    this.activePointerCount = 0;
    if (changed) this.notify();
  }

  getInputSources(): InputSources {
    return {
      keyboardThrottle: digitalAxis(
        this.keyboardActions,
        'forward',
        'backward',
      ),
      keyboardTurn: digitalAxis(this.keyboardActions, 'right', 'left'),
      pointerThrottle: digitalAxis(this.pointerActions, 'forward', 'backward'),
      pointerTurn: digitalAxis(this.pointerActions, 'right', 'left'),
      touchThrottle: this.touchThrottle,
      joystickTurn: this.joystickTurn,
      autoThrottle: this.autoThrottle.enabled
        ? this.autoThrottle.targetThrottle * this.autoThrottleScale
        : 0,
    };
  }

  getAutoThrottleStatus(): AutoThrottleStatus {
    if (!this.autoThrottle.enabled) return 'off';
    const sources = this.getInputSources();
    const manualThrottle = clampAnalogInput(
      sources.keyboardThrottle +
        sources.pointerThrottle +
        sources.touchThrottle,
    );
    return manualThrottle === 0 ? 'active' : 'suspended';
  }

  getDiagnostics(): InputDiagnostics {
    return {
      ...this.getInputSources(),
      ...this.snapshot(),
      autoThrottleStatus: this.getAutoThrottleStatus(),
      pointerActive: this.activePointerCount > 0,
    };
  }

  snapshot(): PlayerInput {
    const sources = this.getInputSources();
    const manualThrottle = clampAnalogInput(
      sources.keyboardThrottle +
        sources.pointerThrottle +
        sources.touchThrottle,
    );
    const manualTurn = clampAnalogInput(
      sources.keyboardTurn + sources.pointerTurn + sources.joystickTurn,
    );

    return {
      throttle: manualThrottle === 0 ? sources.autoThrottle : manualThrottle,
      turn: manualTurn,
      boost:
        this.keyboardActions.has('boost') || this.pointerActions.has('boost'),
      interact:
        this.keyboardActions.has('interact') ||
        this.pointerActions.has('interact'),
    };
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
