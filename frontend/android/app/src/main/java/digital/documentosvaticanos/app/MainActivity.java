package digital.documentosvaticanos.app;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

/**
 * Edge-to-edge shell: draw full-bleed under system bars, then publish real
 * window insets to the WebView as CSS variables (--safe-area-inset-*).
 *
 * Android WebView often reports CSS env(safe-area-inset-bottom) as 0 under
 * targetSdk 35, which would leave app-bnav overlapping system navigation.
 * Variable names must stay in sync with safe-area.logic.ts.
 */
public class MainActivity extends BridgeActivity {

    private int lastTopDp = 0;
    private int lastRightDp = 0;
    private int lastBottomDp = 0;
    private int lastLeftDp = 0;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Full-bleed viewport; chrome clearance comes from injected CSS insets.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        installSafeAreaInsetBridge();
    }

    @Override
    public void onStart() {
        super.onStart();
        // Re-publish after bridge/WebView is fully up (SPA first paint race).
        publishSafeArea(lastTopDp, lastRightDp, lastBottomDp, lastLeftDp);
        View content = findViewById(android.R.id.content);
        if (content != null) {
            content.postDelayed(
                () ->
                    publishSafeArea(
                        lastTopDp, lastRightDp, lastBottomDp, lastLeftDp
                    ),
                300
            );
        }
    }

    private void installSafeAreaInsetBridge() {
        final View content = findViewById(android.R.id.content);
        if (content == null) {
            return;
        }
        ViewCompat.setOnApplyWindowInsetsListener(
            content,
            (v, windowInsets) -> {
                Insets bars =
                    windowInsets.getInsets(
                        WindowInsetsCompat.Type.systemBars() |
                        WindowInsetsCompat.Type.displayCutout()
                    );
                float density = getResources().getDisplayMetrics().density;
                if (density <= 0f) {
                    density = 1f;
                }
                // CSS pixels ≈ device px / density (same basis as env() when it works).
                int top = Math.round(bars.top / density);
                int right = Math.round(bars.right / density);
                int bottom = Math.round(bars.bottom / density);
                int left = Math.round(bars.left / density);
                lastTopDp = top;
                lastRightDp = right;
                lastBottomDp = bottom;
                lastLeftDp = left;
                publishSafeArea(top, right, bottom, left);
                return windowInsets;
            }
        );
        ViewCompat.requestApplyInsets(content);
    }

    private void publishSafeArea(int top, int right, int bottom, int left) {
        if (getBridge() == null) {
            return;
        }
        final WebView webView = getBridge().getWebView();
        if (webView == null) {
            return;
        }
        // Keep property names in sync with frontend/src/app/core/shell/safe-area.logic.ts
        final String js =
            "(function(){var r=document.documentElement;" +
            "r.style.setProperty('--safe-area-inset-top','" +
            top +
            "px');" +
            "r.style.setProperty('--safe-area-inset-right','" +
            right +
            "px');" +
            "r.style.setProperty('--safe-area-inset-bottom','" +
            bottom +
            "px');" +
            "r.style.setProperty('--safe-area-inset-left','" +
            left +
            "px');" +
            "window.__DV_SAFE_AREA__={top:" +
            top +
            ",right:" +
            right +
            ",bottom:" +
            bottom +
            ",left:" +
            left +
            "};" +
            "try{window.dispatchEvent(new CustomEvent('dv-safe-area',{detail:window.__DV_SAFE_AREA__}));}catch(e){}})();";
        webView.post(() -> webView.evaluateJavascript(js, null));
    }
}
