import { Injectable } from '@angular/core';
import {
  applySafeAreaInsets,
  estimateBottomFromVisualViewport,
  isUninitializedZeroBridge,
  readBridgeSafeArea,
  readEnvInsetsFromComputed,
  resolveInsets,
  SafeAreaInsets,
} from './safe-area.logic';

declare global {
  interface Window {
    __DV_SAFE_AREA__?: Partial<SafeAreaInsets>;
  }
}

/**
 * Syncs native window insets onto CSS --safe-area-bridge-*.
 * Resolved inset is max(env, bridge) via CSS. Never clobbers env with 0.
 */
@Injectable({ providedIn: 'root' })
export class SafeAreaService {
  private listening = false;
  private sawRealBridge = false;

  init(): void {
    if (typeof document === 'undefined') {
      return;
    }
    this.markShell();
    this.applyFromBridge();
    this.applyViewportFallback();
    if (this.listening || typeof window === 'undefined') {
      return;
    }
    this.listening = true;
    window.addEventListener('dv-safe-area', () => this.applyFromBridge());
    window.addEventListener('resize', () => this.applyViewportFallback());
    window.addEventListener('orientationchange', () => this.applyViewportFallback());
    window.visualViewport?.addEventListener('resize', () =>
      this.applyViewportFallback()
    );
  }

  applyFromBridge(): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }
    const bridge = readBridgeSafeArea(window);
    if (!bridge) {
      return;
    }
    if (isUninitializedZeroBridge(bridge) && !this.sawRealBridge) {
      return;
    }
    this.sawRealBridge = true;
    applySafeAreaInsets(document.documentElement, bridge);
  }

  /** When env and bridge are 0 on Android UA, estimate from visualViewport. */
  applyViewportFallback(): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }
    const ua = navigator.userAgent || '';
    const android = /Android/i.test(ua);
    if (!android) return;

    const computed = getComputedStyle(document.documentElement);
    const env = readEnvInsetsFromComputed((n) => computed.getPropertyValue(n));
    const bridge = readBridgeSafeArea(window);
    const resolved = resolveInsets(env, bridge);
    if (resolved.bottom > 0) return;

    const estimated = estimateBottomFromVisualViewport(
      window.innerHeight,
      window.visualViewport?.height
    );
    if (estimated > 0) {
      applySafeAreaInsets(document.documentElement, { bottom: estimated });
    }
  }

  private markShell(): void {
    if (typeof document === 'undefined' || typeof navigator === 'undefined') {
      return;
    }
    const ua = navigator.userAgent || '';
    let shell = 'web';
    if (/Android/i.test(ua) && /wv|Version\/\d+\.\d+\s+Chrome/i.test(ua)) {
      shell = 'android';
    }
    document.documentElement.dataset['shell'] = shell;
  }
}
