import 'package:drewel/app/data/apis/api_models/ride_message_model.dart';
import 'package:drewel/app/data/services/voice_player_manager.dart';
import 'package:drewel/app/modules/communication/widgets/voice_message_bubble.dart'
    show formatVoiceDuration;
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('VoicePlayerManager.resolveApiUrl', () {
    test('strips the duplicated /api segment from backend audio paths', () {
      final Uri uri = VoicePlayerManager.resolveApiUrl(
        '/api/rides/ride-1/messages/msg-1/audio',
      );

      expect(uri.toString(), endsWith('/api/rides/ride-1/messages/msg-1/audio'));
      expect(uri.toString().contains('/api//api'), isFalse,
          reason: 'baseUrl already ends with /api; the path must not repeat it');
    });

    test('keeps absolute URLs untouched', () {
      final Uri uri = VoicePlayerManager.resolveApiUrl(
        'https://cdn.example.com/audio/note.m4a',
      );

      expect(uri.host, 'cdn.example.com');
      expect(uri.path, '/audio/note.m4a');
    });
  });

  group('RideMessageModel voice parsing', () {
    test('fromJson reads voice metadata and the top-level idempotency key',
        () {
      final RideMessageModel message = RideMessageModel.fromJson(
        <String, dynamic>{
          '_id': 'msg-1',
          'rideId': 'ride-1',
          'text': '',
          'senderId': 'driver-1',
          'status': 'sent',
          'messageType': 'voice',
          'clientMessageId': 'client-1',
          'audioUrl': '/api/rides/ride-1/messages/msg-1/audio',
          'audioDuration': 7.5,
          'audioMimeType': 'audio/mp4',
          'audioSize': 65432,
          'createdAt': '2026-08-21T10:00:00.000Z',
        },
      );

      expect(message.isVoice, isTrue);
      expect(message.isTripRequest, isFalse);
      expect(message.clientMessageId, 'client-1');
      expect(message.audioUrl, '/api/rides/ride-1/messages/msg-1/audio');
      expect(message.audioDuration, 7.5);
      expect(message.audioMimeType, 'audio/mp4');
      expect(message.audioSize, 65432);
    });

    test('fromFlat reads the realtime ride:message payload shape', () {
      final RideMessageModel message = RideMessageModel.fromFlat(
        id: 'msg-2',
        rideId: 'ride-9',
        data: <String, dynamic>{
          'messageId': 'ignored-because-id-is-explicit',
          'senderId': 'passenger-1',
          'senderRole': 'passenger',
          'text': '',
          'messageType': 'voice',
          'status': 'sent',
          'clientMessageId': 'client-2',
          'audioUrl': '/api/rides/ride-9/messages/msg-2/audio',
          'audioDuration': 12,
          'createdAt': '2026-08-21T10:05:00.000Z',
        },
        fallbackSenderId: '',
      );

      expect(message.id, 'msg-2');
      expect(message.isVoice, isTrue);
      expect(message.clientMessageId, 'client-2');
      expect(message.audioDuration, 12);
    });

    test('text messages are not classified as voice or trip requests', () {
      final RideMessageModel message = RideMessageModel.fromJson(
        <String, dynamic>{'_id': 'm', 'text': 'Hello', 'messageType': 'text'},
      );

      expect(message.isVoice, isFalse);
      expect(message.isTripRequest, isFalse);
      expect(message.clientMessageId, isNull);
      expect(message.audioUrl, isNull);
    });
  });

  group('formatVoiceDuration', () {
    test('renders minutes and zero-padded seconds', () {
      expect(formatVoiceDuration(Duration.zero), '0:00');
      expect(formatVoiceDuration(const Duration(seconds: 7)), '0:07');
      expect(formatVoiceDuration(const Duration(seconds: 59)), '0:59');
      expect(formatVoiceDuration(const Duration(minutes: 2)), '2:00');
      expect(
        formatVoiceDuration(const Duration(minutes: 1, seconds: 5)),
        '1:05',
      );
    });
  });
}
