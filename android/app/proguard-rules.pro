############## Flutter + Plugins ##############

# Keep Flutter embedding + plugins
-keep class io.flutter.plugins.** { *; }
-keep class io.flutter.embedding.** { *; }

############## Kotlin / Metadata ##############
-keepclassmembers class kotlin.Metadata { *; }


############## Google SmartAuth ##############
-keep class com.google.android.gms.auth.api.credentials.** { *; }
-dontwarn com.google.android.gms.auth.api.credentials.**

############## Google Play Core (SplitInstall) ##############
-keep class com.google.android.play.core.** { *; }
-dontwarn com.google.android.play.core.**

############## Keep all @Keep annotations ##############
-keep class ** {
    @androidx.annotation.Keep *;
}



