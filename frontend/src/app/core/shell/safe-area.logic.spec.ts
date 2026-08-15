import {
  applySafeAreaInsets,
  buildApplyInsetsJs,
  estimateBottomFromVisualViewport,
  isUninitializedZeroBridge,
  normalizeInsetPx,
  resolveInset,
  resolveInsets,
  SAFE_AREA_BRIDGE_VARS,
} from './safe-area.logic';

describe('safe-area.logic', () => {
  it('normalizeInsetPx coerces invalid values to 0', () => {
    expect(normalizeInsetPx(undefined)).toBe(0);
    expect(normalizeInsetPx(NaN)).toBe(0);
    expect(normalizeInsetPx(-4)).toBe(0);
    expect(normalizeInsetPx(47.6)).toBe(48);
  });

  it('resolveInset prefers non-zero bridge when env is 0 (Android WebView)', () => {
    expect(resolveInset(0, 48)).toBe(48);
    expect(resolveInset(34, 0)).toBe(34);
    expect(resolveInset(20, 48)).toBe(48);
    expect(resolveInset(0, 0)).toBe(0);
    expect(resolveInset(null, 24)).toBe(24);
  });

  it('resolveInsets / applySafeAreaInsets writes bridge vars, not env', () => {
    const resolved = resolveInsets({ bottom: 0 }, { bottom: 48, top: 24 });
    expect(resolved.bottom).toBe(48);
    expect(resolved.top).toBe(24);

    const props: Record<string, string> = {};
    applySafeAreaInsets(
      { style: { setProperty: (n, v) => (props[n] = v) } },
      resolved
    );
    expect(props[SAFE_AREA_BRIDGE_VARS.bottom]).toBe('48px');
    expect(props[SAFE_AREA_BRIDGE_VARS.top]).toBe('24px');
  });

  it('does not treat a real zero inset as initialized until a non-zero arrives', () => {
    expect(isUninitializedZeroBridge({ top: 0, right: 0, bottom: 0, left: 0 })).toBe(
      true
    );
    expect(isUninitializedZeroBridge({ top: 0, right: 0, bottom: 48, left: 0 })).toBe(
      false
    );
  });

  it('buildApplyInsetsJs uses bridge variable names', () => {
    const js = buildApplyInsetsJs({ top: 24, right: 0, bottom: 48, left: 0 });
    expect(js).toContain(SAFE_AREA_BRIDGE_VARS.bottom);
    expect(js).toContain("'48px'");
    expect(js).not.toContain('--safe-area-inset-bottom');
  });

  it('estimateBottomFromVisualViewport ignores tiny deltas', () => {
    expect(estimateBottomFromVisualViewport(800, 798)).toBe(0);
    expect(estimateBottomFromVisualViewport(800, 752)).toBe(48);
  });
});
