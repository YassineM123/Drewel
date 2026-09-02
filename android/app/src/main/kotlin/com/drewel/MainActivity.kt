package com.drewel

import android.app.Notification
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
                "drewel_ride_requests",
                "Ride Requests",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "High priority ride requests for drivers."
                setShowBadge(true)
                enableLights(true)
                setSound(soundUri("drewel_ride_request"), audioAttributes())
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 220, 90, 200, 90, 360)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            },
            NotificationChannel(
                "drewel_ride_updates",
                "Ride Updates",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Live ride updates such as driver arrived, trip started and completed."
                setShowBadge(true)
                enableLights(true)
                setSound(soundUri("drewel_notification"), audioAttributes())
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 160, 80, 160)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            },
            NotificationChannel(
                "drewel_rides",
                "Ride Updates (Legacy)",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "General ride status updates."
                setShowBadge(true)
                enableLights(true)
                setSound(soundUri("drewel_notification"), audioAttributes())
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 160, 80, 160)
            },
            NotificationChannel(
                "drewel_messages",
                "Messages",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Chat and voice messages in active rides."
                setShowBadge(true)
                enableLights(true)
                enableVibration(true)
                setSound(soundUri("drewel_message"), audioAttributes())
                vibrationPattern = longArrayOf(0, 60, 50, 60)
                lockscreenVisibility = Notification.VISIBILITY_PRIVATE
            },
            NotificationChannel(
                "drewel_calls",
                "Calls",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Incoming and missed calls."
                setShowBadge(true)
                enableLights(true)
                setSound(soundUri("drewel_call"), audioAttributes(usage = AudioAttributes.USAGE_NOTIFICATION_RINGTONE))
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 200, 500, 200, 500)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            },
            NotificationChannel(
                "drewel_payments",
                "Payments & Points",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Points balance, transactions, and purchase requests."
                setShowBadge(true)
                enableLights(true)
                setSound(soundUri("drewel_success"), audioAttributes())
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 140, 70, 140)
            },
            NotificationChannel(
                "drewel_general",
                "General Notifications",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Account, verification and system announcements."
                setShowBadge(true)
                setSound(soundUri("drewel_notification"), audioAttributes())
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 100, 50, 100)
            },
            NotificationChannel(
                "drewel_system",
                "System notifications",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Account updates and background system messages."
                setSound(soundUri("drewel_notification"), audioAttributes())
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 200, 100, 200)
            }
        )
        for (channel in channels) manager.createNotificationChannel(channel)
    }
}
