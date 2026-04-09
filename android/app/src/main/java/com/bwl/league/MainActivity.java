package com.bwl.league;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ObjectAnimator;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.view.animation.AnticipateInterpolator;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);

        splashScreen.setKeepOnScreenCondition(() -> false);
        splashScreen.setOnExitAnimationListener(splashScreenView -> {
            ObjectAnimator fadeOut = ObjectAnimator.ofFloat(
                splashScreenView.getView(), View.ALPHA, 1f, 0f
            );
            fadeOut.setDuration(800);
            fadeOut.setInterpolator(new AnticipateInterpolator());
            fadeOut.addListener(new AnimatorListenerAdapter() {
                @Override
                public void onAnimationEnd(Animator animation) {
                    splashScreenView.remove();
                }
            });
            fadeOut.start();
        });

        // Handle notification tap — navigate to URL from FCM data
        handleNotificationIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleNotificationIntent(intent);
    }

    private void handleNotificationIntent(Intent intent) {
        if (intent == null || intent.getExtras() == null) return;

        String url = intent.getStringExtra("url");
        if (url != null && !url.isEmpty()) {
            // Store URL — the WebView will pick it up after loading
            getIntent().putExtra("bwl_notification_url", url);

            // Navigate after a delay to ensure WebView is ready
            getBridge().getWebView().postDelayed(() -> {
                String js = "window.location.href='" + url + "';";
                getBridge().eval(js, null);
            }, 2000);
        }
    }
}
