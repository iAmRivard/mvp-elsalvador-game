import type { PlayerInput } from '../types/game';
import {
  mobileBoostConfig,
  mobileCruiseConfig,
  type MobileBoostState,
} from '../config/mobileControls.config';
import { clampAnalogInput } from './analogInput';
import {
  mobileCruiseGear,
  mobileCruiseThrottle,
  stoppedMobileCruiseTarget,
  updateCruiseTarget,
  type MobileCruiseTarget,
} from './mobileCruise';

export type InputAction =
  'forward' | 'backward' | 'left' | 'right' | 'boost' | 'interact';

export interface InputSources {
  keyboardThrottle: number;
  keyboardTurn: number;
  pointerThrottle: number;
  pointerTurn: number;
  touchThrottle: number;
  joystickThrottle: number;
  joystickTurn: number;
  autoThrottle: number;
  mobileCruiseThrottle: number;
  mobileCruiseVerticalIntent: number;
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
  mobileBoost: MobileBoostState;
  mobileCruise: MobileCruiseTarget;
}

export interface MobileBoostAvailability {
  fuel: number;
  condition: number;
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
  KeyE: 'interact',
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
  private joystickThrottle = 0;
  private joystickTurn = 0;
  private autoThrottle: AutoThrottleState = {
    enabled: false,
    targetThrottle: 0.72,
  };
  private autoThrottleScale = 1;
  private mobileCruiseEnabled = false;
  private mobileCruiseVerticalIntent = 0;
  private mobileCruiseThrottle = 0;
  private mobileCruiseTarget: MobileCruiseTarget = {
    ...stoppedMobileCruiseTarget,
  };
  private reverseIntentMilliseconds = 0;
  private lastCruiseNotificationAt = 0;
  private lastNotifiedCruiseTarget = 0;
  private readonly activePointerIds = new Set<number>();
  private mobileBoostActiveUntil = 0;
  private mobileBoostCooldownUntil = 0;
  private mobileBoostRecoveryUntil = 0;
  private mobileBoostTimer: ReturnType<typeof setTimeout> | null = null;
  private mobileBoostState: MobileBoostState = {
    active: false,
    remainingMilliseconds: 0,
    cooldownRemainingMilliseconds: 0,
  };

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
      if (action === 'backward') {
        this.disableAutoThrottle();
        this.cancelActiveMobileBoostPreservingCooldown();
      }
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
    if (active && action === 'backward') {
      this.disableAutoThrottle();
      this.cancelActiveMobileBoostPreservingCooldown();
    }
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
    if (next < 0) {
      this.disableAutoThrottle();
      this.cancelActiveMobileBoostPreservingCooldown();
    }
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

  setDriveJoystick(throttle: number, turn: number): void {
    const nextThrottle = clampAnalogInput(throttle);
    const nextTurn = clampAnalogInput(turn);
    if (nextThrottle < 0) {
      this.disableAutoThrottle();
      this.cancelActiveMobileBoostPreservingCooldown();
    }
    if (
      this.joystickThrottle === nextThrottle &&
      this.joystickTurn === nextTurn
    ) {
      return;
    }
    this.joystickThrottle = nextThrottle;
    this.joystickTurn = nextTurn;
    this.notify();
  }

  setMobileCruiseEnabled(enabled: boolean): void {
    if (this.mobileCruiseEnabled === enabled) return;
    this.mobileCruiseEnabled = enabled;
    this.joystickThrottle = 0;
    this.mobileCruiseVerticalIntent = 0;
    this.mobileCruiseThrottle = 0;
    this.reverseIntentMilliseconds = 0;
    this.mobileCruiseTarget = { ...stoppedMobileCruiseTarget };
    if (enabled) this.disableAutoThrottle();
    this.notify();
  }

  setTargetSpeedJoystick(verticalIntent: number, turn: number): void {
    const nextIntent = clampAnalogInput(verticalIntent);
    const nextTurn = clampAnalogInput(turn);
    if (
      this.mobileCruiseVerticalIntent === nextIntent &&
      this.joystickTurn === nextTurn
    ) {
      return;
    }
    this.mobileCruiseVerticalIntent = nextIntent;
    this.joystickTurn = nextTurn;
    if (nextIntent >= 0 && this.mobileCruiseTarget.reversing) {
      this.reverseIntentMilliseconds = 0;
      this.mobileCruiseTarget = {
        ...this.mobileCruiseTarget,
        braking: false,
        reversing: false,
      };
    }
    this.notify();
  }

  advanceMobileCruise(
    currentSpeedMetersPerSecond: number,
    deltaTimeSeconds: number,
  ): void {
    if (!this.mobileCruiseEnabled) return;
    this.updateMobileBoostState();
    const previous = this.mobileCruiseTarget;
    const intent = this.mobileCruiseVerticalIntent;
    const deltaTime = Math.max(
      0,
      Number.isFinite(deltaTimeSeconds) ? deltaTimeSeconds : 0,
    );
    let targetSpeedKilometersPerHour = previous.reversing
      ? 0
      : updateCruiseTarget(
          previous.targetSpeedKilometersPerHour,
          intent,
          deltaTime,
        );
    let reversing = previous.reversing;

    if (intent >= 0) {
      reversing = false;
      this.reverseIntentMilliseconds = 0;
    } else if (
      targetSpeedKilometersPerHour <= 0.5 &&
      Math.abs(currentSpeedMetersPerSecond) <=
        mobileCruiseConfig.stoppedSpeedMetersPerSecond
    ) {
      targetSpeedKilometersPerHour = 0;
      this.reverseIntentMilliseconds += deltaTime * 1_000;
      reversing =
        this.reverseIntentMilliseconds >=
        mobileCruiseConfig.reverseActivationDelayMilliseconds;
    } else if (!reversing) {
      this.reverseIntentMilliseconds = 0;
    }

    const next: MobileCruiseTarget = {
      targetSpeedKilometersPerHour,
      selectedGear: mobileCruiseGear(targetSpeedKilometersPerHour),
      braking: intent < 0 && !reversing,
      reversing,
    };
    this.mobileCruiseTarget = next;
    const effectiveTarget = this.mobileBoostState.active
      ? {
          ...next,
          targetSpeedKilometersPerHour:
            mobileCruiseConfig.boostTargetSpeedKilometersPerHour,
        }
      : next;
    const requestedThrottle = mobileCruiseThrottle(
      effectiveTarget,
      currentSpeedMetersPerSecond,
      intent,
    );
    this.mobileCruiseThrottle =
      !this.mobileBoostState.active &&
      Date.now() < this.mobileBoostRecoveryUntil &&
      intent >= 0 &&
      requestedThrottle < 0
        ? Math.max(
            requestedThrottle,
            -mobileCruiseConfig.boostRecoveryMaximumBrake,
          )
        : requestedThrottle;

    const now = performance.now();
    const immediateStateChange =
      previous.selectedGear !== next.selectedGear ||
      previous.braking !== next.braking ||
      previous.reversing !== next.reversing;
    const roundedTarget = Math.round(next.targetSpeedKilometersPerHour);
    if (
      immediateStateChange ||
      (roundedTarget !== this.lastNotifiedCruiseTarget &&
        now - this.lastCruiseNotificationAt >=
          mobileCruiseConfig.diagnosticsUpdateIntervalMilliseconds)
    ) {
      this.lastCruiseNotificationAt = now;
      this.lastNotifiedCruiseTarget = roundedTarget;
      this.notify();
    }
  }

  getMobileCruiseTarget(): MobileCruiseTarget {
    return this.mobileCruiseTarget;
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

  activateMobileBoost(
    availability: MobileBoostAvailability = { fuel: 1, condition: 1 },
  ): boolean {
    const state = this.mobileBoostState;
    if (
      availability.fuel <= 0 ||
      availability.condition <= 0 ||
      state.active ||
      state.cooldownRemainingMilliseconds > 0
    ) {
      return false;
    }
    const now = Date.now();
    this.mobileBoostActiveUntil = now + mobileBoostConfig.durationMilliseconds;
    this.mobileBoostCooldownUntil =
      this.mobileBoostActiveUntil + mobileBoostConfig.cooldownMilliseconds;
    this.updateMobileBoostState();
    this.startMobileBoostTicker();
    this.notify();
    return true;
  }

  cancelActiveMobileBoostPreservingCooldown(): void {
    this.updateMobileBoostState();
    if (!this.mobileBoostState.active) return;
    this.mobileBoostActiveUntil = 0;
    this.updateMobileBoostState();
    this.startMobileBoostTicker();
    this.notify();
  }

  resetMobileBoostCompletely(): void {
    if (this.clearMobileBoostState()) this.notify();
  }

  getMobileBoostState(): MobileBoostState {
    return this.mobileBoostState;
  }

  private updateMobileBoostState(): void {
    const now = Date.now();
    const wasActive = this.mobileBoostState.active;
    const remainingMilliseconds = Math.max(
      0,
      this.mobileBoostActiveUntil - now,
    );
    const active = remainingMilliseconds > 0;
    this.mobileBoostState = {
      active,
      remainingMilliseconds,
      cooldownRemainingMilliseconds: active
        ? 0
        : Math.max(0, this.mobileBoostCooldownUntil - now),
    };
    if (wasActive && !active) {
      this.mobileBoostRecoveryUntil =
        now + mobileCruiseConfig.boostRecoveryMilliseconds;
    }
  }

  setAutoThrottleScale(value: number): void {
    const next = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));
    if (this.autoThrottleScale === next) return;
    this.autoThrottleScale = next;
    this.notify();
  }

  setPointerActive(pointerId: number, active: boolean): void {
    const changed = active
      ? !this.activePointerIds.has(pointerId)
      : this.activePointerIds.has(pointerId);
    if (active) this.activePointerIds.add(pointerId);
    else this.activePointerIds.delete(pointerId);
    if (changed) this.notify();
  }

  clearPointerActions(): void {
    const boostWasActive = this.mobileBoostState.active;
    this.cancelActiveMobileBoostPreservingCooldown();
    const changed =
      this.pointerActions.size > 0 ||
      this.touchThrottle !== 0 ||
      this.joystickThrottle !== 0 ||
      this.joystickTurn !== 0 ||
      this.mobileCruiseVerticalIntent !== 0 ||
      this.mobileCruiseTarget.braking ||
      this.mobileCruiseTarget.reversing ||
      this.activePointerIds.size > 0 ||
      boostWasActive;
    for (const timer of this.pointerReleaseTimers.values()) clearTimeout(timer);
    this.pointerReleaseTimers.clear();
    this.pointerActions.clear();
    this.touchThrottle = 0;
    this.joystickThrottle = 0;
    this.joystickTurn = 0;
    this.mobileCruiseVerticalIntent = 0;
    this.reverseIntentMilliseconds = 0;
    this.mobileCruiseTarget = {
      ...this.mobileCruiseTarget,
      braking: false,
      reversing: false,
    };
    this.activePointerIds.clear();
    if (changed) this.notify();
  }

  clearAllInput(): void {
    const boostWasActive = this.mobileBoostState.active;
    this.cancelActiveMobileBoostPreservingCooldown();
    const changed =
      this.keyboardActions.size > 0 ||
      this.pointerActions.size > 0 ||
      this.pointerReleaseTimers.size > 0 ||
      this.touchThrottle !== 0 ||
      this.joystickThrottle !== 0 ||
      this.joystickTurn !== 0 ||
      this.mobileCruiseVerticalIntent !== 0 ||
      this.mobileCruiseThrottle !== 0 ||
      this.mobileCruiseTarget.targetSpeedKilometersPerHour !== 0 ||
      this.autoThrottle.enabled ||
      this.activePointerIds.size > 0 ||
      boostWasActive;
    for (const timer of this.pointerReleaseTimers.values()) clearTimeout(timer);
    this.pointerReleaseTimers.clear();
    this.keyboardActions.clear();
    this.pointerActions.clear();
    this.touchThrottle = 0;
    this.joystickThrottle = 0;
    this.joystickTurn = 0;
    this.mobileCruiseVerticalIntent = 0;
    this.mobileCruiseThrottle = 0;
    this.mobileCruiseTarget = { ...stoppedMobileCruiseTarget };
    this.reverseIntentMilliseconds = 0;
    this.lastNotifiedCruiseTarget = 0;
    this.autoThrottle = { ...this.autoThrottle, enabled: false };
    this.autoThrottleScale = 1;
    this.activePointerIds.clear();
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
      joystickThrottle: this.joystickThrottle,
      joystickTurn: this.joystickTurn,
      autoThrottle: this.autoThrottle.enabled
        ? this.autoThrottle.targetThrottle * this.autoThrottleScale
        : 0,
      mobileCruiseThrottle: this.mobileCruiseEnabled
        ? this.mobileCruiseThrottle
        : 0,
      mobileCruiseVerticalIntent: this.mobileCruiseEnabled
        ? this.mobileCruiseVerticalIntent
        : 0,
    };
  }

  getAutoThrottleStatus(): AutoThrottleStatus {
    if (!this.autoThrottle.enabled) return 'off';
    const sources = this.getInputSources();
    const manualThrottle = clampAnalogInput(
      sources.keyboardThrottle +
        sources.pointerThrottle +
        sources.touchThrottle +
        sources.joystickThrottle,
    );
    return manualThrottle === 0 ? 'active' : 'suspended';
  }

  getDiagnostics(): InputDiagnostics {
    return {
      ...this.getInputSources(),
      ...this.snapshot(),
      autoThrottleStatus: this.getAutoThrottleStatus(),
      pointerActive: this.activePointerIds.size > 0,
      mobileBoost: this.getMobileBoostState(),
      mobileCruise: this.getMobileCruiseTarget(),
    };
  }

  snapshot(): PlayerInput {
    const sources = this.getInputSources();
    const manualThrottle = clampAnalogInput(
      sources.keyboardThrottle +
        sources.pointerThrottle +
        sources.touchThrottle +
        sources.joystickThrottle,
    );
    const manualTurn = clampAnalogInput(
      sources.keyboardTurn + sources.pointerTurn + sources.joystickTurn,
    );

    return {
      throttle:
        manualThrottle === 0
          ? this.mobileCruiseEnabled
            ? sources.mobileCruiseThrottle
            : sources.autoThrottle
          : manualThrottle,
      turn: manualTurn,
      boost:
        this.keyboardActions.has('boost') ||
        this.pointerActions.has('boost') ||
        this.getMobileBoostState().active,
      interact:
        this.keyboardActions.has('interact') ||
        this.pointerActions.has('interact'),
    };
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  private clearMobileBoostState(): boolean {
    const changed =
      this.mobileBoostActiveUntil > 0 ||
      this.mobileBoostCooldownUntil > 0 ||
      this.mobileBoostTimer !== null;
    if (this.mobileBoostTimer) clearTimeout(this.mobileBoostTimer);
    this.mobileBoostTimer = null;
    this.mobileBoostActiveUntil = 0;
    this.mobileBoostCooldownUntil = 0;
    this.mobileBoostRecoveryUntil = 0;
    this.mobileBoostState = {
      active: false,
      remainingMilliseconds: 0,
      cooldownRemainingMilliseconds: 0,
    };
    return changed;
  }

  private startMobileBoostTicker(): void {
    if (this.mobileBoostTimer) clearTimeout(this.mobileBoostTimer);
    const tick = () => {
      this.mobileBoostTimer = null;
      this.updateMobileBoostState();
      const state = this.mobileBoostState;
      if (!state.active && state.cooldownRemainingMilliseconds <= 0) {
        this.mobileBoostActiveUntil = 0;
        this.mobileBoostCooldownUntil = 0;
        this.notify();
        return;
      }
      this.notify();
      this.mobileBoostTimer = setTimeout(tick, 50);
    };
    this.mobileBoostTimer = setTimeout(tick, 50);
  }
}
