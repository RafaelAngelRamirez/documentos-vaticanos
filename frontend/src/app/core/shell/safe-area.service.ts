import { Injectable } from '@angular/core';
import {
  applySafeAreaInsets,
  readBridgeSafeArea,
  SafeAreaInsets,
} from './safe-area.logic';

declare global {
  interface Window {
    __DV_SAFE_AREA__?: Partial<SafeAreaInsets>;
  }
}

/**
 * Syncs native window insets (Android MainActivity bridge) onto CSS variables.
 * No-op when the bridge is absent (browser / iOS with working env()).
 */
@Injectable({ providedIn: 'root' })
export class SafeAreaService {
  private listening = false;

  /** Call once at app bootstrap. Safe to call multiple times. */
  init(): void {
    if (typeof document === 'undefined') {
      return;
    }
    this.applyFromBridge();
    if (this.listening || typeof window === 'undefined') {
      return;
    }
    this.listening = true;
    window.addEventListener('dv-safe-area', () => this.applyFromBridge());
  }

  /** Re-read window.__DV_SAFE_AREA__ and publish CSS vars. */
  applyFromBridge(): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }
    const bridge = readBridgeSafeArea(window);
    if (!bridge) {
      return;
    }
    applySafeAreaInsets(document.documentElement, bridge);
  }
}
