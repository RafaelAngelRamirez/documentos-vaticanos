package org.vaticana.documentos;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.appcompat.app.AppCompatActivity;

/**
 * Contrato safe-area (plan congruencia UI / narrador).
 *
 * - Escuchar insets en el WebView (no solo en onCreate).
 * - Usar getInsetsIgnoringVisibility(systemBars | displayCutout).
 * - No publicar 0,0,0,0: si el sistema aún no midió, no tocar CSS.
 * - El JS debe escribir --safe-area-bridge-* (nunca --safe-area-inset-*).
 *
 * El JS canónico está en frontend/src/app/core/shell/safe-area.logic.ts
 * (buildApplyInsetsJs).
 */
public class MainActivity extends AppCompatActivity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
  }

  public static void attachSafeAreaListener(WebView webView) {
    ViewCompat.setOnApplyWindowInsetsListener(webView, (v, insets) -> {
      Insets bars = insets.getInsetsIgnoringVisibility(
          WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
      if (bars.left == 0 && bars.top == 0 && bars.right == 0 && bars.bottom == 0) {
        return insets;
      }
      // Equivalente Java de buildApplyInsetsJs (safe-area.logic.ts).
      String js = "(function(){var r=document.documentElement;"
          + "r.style.setProperty('--safe-area-bridge-top','" + bars.top + "px');"
          + "r.style.setProperty('--safe-area-bridge-right','" + bars.right + "px');"
          + "r.style.setProperty('--safe-area-bridge-bottom','" + bars.bottom + "px');"
          + "r.style.setProperty('--safe-area-bridge-left','" + bars.left + "px');"
          + "window.__DV_SAFE_AREA__={top:" + bars.top + ",right:" + bars.right
          + ",bottom:" + bars.bottom + ",left:" + bars.left + "};"
          + "try{window.dispatchEvent(new CustomEvent('dv-safe-area',{detail:window.__DV_SAFE_AREA__}));}catch(e){}})();";
      webView.evaluateJavascript(js, null);
      return insets;
    });
    ViewCompat.requestApplyInsets(webView);
  }
}
