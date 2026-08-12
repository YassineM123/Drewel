package com.drewel

import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine

/**
 * Drewel branded notification channels.
 *
 * Channel ids are deliberately versioned (e.g. `drewel_rides`). Android keeps
 * channel settings after the user configures them, so changing a channel's
 * sound in a future release must use a NEW channel id instead of mutating an
 * existing one; mutating a channel that was already created is ignored by the
 * OS.
 */
class MainActivity : FlutterActivity() {

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        createNotificationChannels()
    }

    private fun soundUri(name: String): Uri =
        Uri.parse("android.resource://${packageName}/raw/$name")

    private fun audioAttributes(
        usage: Int = AudioAttributes.USAGE_NOTIFICATION,
        contentType: Int = AudioAttributes.CONTENT_TYPE_SONIFICATION
    ) = AudioAttributes.Builder()
        .setUsage(usage)
        .setContentType(contentType)
        .build()

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java)

        val channels = listOf(
            NotificationChannel(
                "drewel_rides",
                "Ride updates",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "General ride updates such as driver accepted, nearby and ride completed."
                setShowBadge(true)
                enableLights(true)
                setSound(soundUri("drewel_notification"), audioAttributes())
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 160, 80, 160)
            },
            NotificationChannel(
                "drewel_ride_requests",
                "New ride requests",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "A new ride request is available for the driver."
                setShowBadge(true)
                enableLights(true)
                setSound(soundUri("drewel_ride_request"), audioAttributes())
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 220, 90, 200, 90, 360)
            },
            NotificationChannel(
                "drewel_messages",
                "Messages",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "New messages in an active ride chat."
                enableVibration(true)
                setSound(soundUri("drewel_message"), audioAttributes())
                vibrationPattern = longArrayOf(0, 60, 50, 60)
            },
            NotificationChannel(
                "drewel_calls",
                "Calls",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Incoming Drewel voice calls."
                setShowBadge(true)
                enableLights(true)
                setSound(soundUri("drewel_call"), audioAttributes())
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 1500, 500, 1500)
            },
            NotificationChannel(
                "drewel_system",
                "System notifications",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Account updates and important system messages."
                setSound(soundUri("drewel_notification"), audioAttributes())
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 200, 100, 200)
            }
        )
        for (channel in channels) manager.createNotificationChannel(channel)
    }
}