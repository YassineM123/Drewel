import 'dart:io';

import 'package:drewel/app/data/apis/api_models/active_ride_model.dart';
import 'package:drewel/app/data/apis/api_models/call_session_model.dart';
import 'package:drewel/app/data/apis/api_models/get_all_driver_model.dart';
import 'package:drewel/app/data/apis/api_models/ride_message_model.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('secure communication models', () {
    test('enables communication only for a backend-authorized active ride', () {
      final ActiveRideModel ride = ActiveRideModel.fromJson(<String, dynamic>{
        '_id': 'ride-1',
        'status': 'accepted',
        'contactAllowed': true,
        'contactExpiresAt': DateTime.now()
            .toUtc()
            .add(const Duration(minutes: 5))
            .toIso8601String(),
      });

      expect(ride.hasBackendRideId, isTrue);
      expect(ride.canCommunicate, isTrue);
      expect(
        ActiveRideModel.fromJson(<String, dynamic>{
          'status': 'accepted',
          'contactAllowed': true,
        }).canCommunicate,
        isFalse,
      );
    });

    test('parses every call state and identifies active states', () {
      for (final CallSessionStatus status in CallSessionStatus.values) {
        expect(CallSessionStatus.fromValue(status.name), status);
      }
      expect(CallSessionStatus.connected.isActive, isTrue);
      expect(CallSessionStatus.ended.isActive, isFalse);
      expect(
          CallSessionStatus.fromValue('unexpected'), CallSessionStatus.failed);
    });

    test('parses Agora credentials only from temporary response payload', () {
      final CallSessionModel call = CallSessionModel.fromJson(<String, dynamic>{
        '_id': 'call-1',
        'rideId': 'ride-1',
        'status': 'accepted',
        'credentials': <String, dynamic>{
          'appId': 'public-app-id',
          'channelName': 'random-channel',
          'uid': 42,
          'token': 'temporary-token',
        },
      });

      expect(call.credentials?.uid, 42);
      expect(call.credentials?.channelName, 'random-channel');
    });

    test('defaults unknown message status to sent', () {
      final RideMessageModel message = RideMessageModel.fromJson(
        <String, dynamic>{
          '_id': 'message-1',
          'rideId': 'ride-1',
          'senderId': 'user-1',
          'text': 'Where are you?',
          'status': 'unknown',
        },
      );
      expect(message.status, RideMessageStatus.sent);
    });
  });

  group('driver discovery privacy', () {
    test('public driver DTO does not serialize private contact or OTP fields',
        () {
      final Drivers driver = Drivers.fromJson(<String, dynamic>{
        '_id': 'driver-1',
        'fullName': 'Assigned Driver',
        'phone': 'secret',
        'whatsappNumber': 'secret',
        'otpCode': '1234',
      });

      expect(driver.toJson(), isNot(contains('phone')));
      expect(driver.toJson(), isNot(contains('whatsappNumber')));
      expect(driver.toJson(), isNot(contains('otpCode')));
    });

    test('ride-contact Flutter flow has no wa.me launcher', () {
      final String userHomeController = File(
        'lib/app/modules/user_home/controllers/user_home_controller.dart',
      ).readAsStringSync();
      final String userHomeView = File(
        'lib/app/modules/user_home/views/user_home_view.dart',
      ).readAsStringSync();

      expect(userHomeController, isNot(contains('wa.me')));
      expect(userHomeController, isNot(contains('openWhatsApp')));
      expect(userHomeView, isNot(contains('icWhatsApp')));
    });
  });
}
