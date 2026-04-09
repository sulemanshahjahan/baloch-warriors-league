# Add project specific ProGuard rules here.

# Keep Capacitor classes
-keep class com.getcapacitor.** { *; }
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# Keep plugin classes
-keep class com.capacitorjs.plugins.** { *; }

# Keep WebView JavaScript interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Firebase Messaging
-keep class com.google.firebase.messaging.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**
