package com.bwl.league;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ObjectAnimator;
import android.os.Bundle;
import android.view.View;
import android.view.animation.AnticipateInterpolator;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Install splash screen
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        
        super.onCreate(savedInstanceState);
        
        // Keep splash screen visible for animation
        splashScreen.setKeepOnScreenCondition(() -> false);
        
        // Set up the fade-out animation for splash screen
        splashScreen.setOnExitAnimationListener(splashScreenView -> {
            // Create fade-out animation
            ObjectAnimator fadeOut = ObjectAnimator.ofFloat(
                splashScreenView.getView(),
                View.ALPHA,
                1f,
                0f
            );
            
            // Animation duration: 800ms
            fadeOut.setDuration(800);
            
            // Anticipate interpolator for nice deceleration effect
            fadeOut.setInterpolator(new AnticipateInterpolator());
            
            // Remove splash screen view when animation ends
            fadeOut.addListener(new AnimatorListenerAdapter() {
                @Override
                public void onAnimationEnd(Animator animation) {
                    splashScreenView.remove();
                }
            });
            
            fadeOut.start();
        });
    }
}
