import 'package:drewel/app/data/apis/api_models/active_ride_model.dart';
import 'package:drewel/app/data/constants/app_translations.dart';
import 'package:drewel/app/modules/communication/controllers/call_state_controller.dart';
import 'package:drewel/app/modules/user_home/views/user_home_view.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('running app catalog exposes Balance and رصيد wording', () {
    final keys = AppTranslations().keys;
    expect(keys['en']?['points.my_points'], 'My Balance');
    expect(keys['en']?['points.available'], 'Available balance');
    expect(keys['ar']?['points.my_points'], 'رصيدي');
    expect(keys['ar']?['points.available'], 'الرصيد المتاح');
  });

  test('passenger marketplace is hidden for an active assigned ride', () {
    const active = ActiveRideModel(
      id: 'ride-1',
      status: 'driver_on_the_way',
      contactAllowed: true,
    );
    const completed = ActiveRideModel(
      id: 'ride-2',
      status: 'completed',
      contactAllowed: true,
    );

    expect(shouldShowPassengerMarketplace(null), isTrue);
    expect(shouldShowPassengerMarketplace(active), isFalse);
    expect(shouldShowPassengerMarketplace(completed), isTrue);
  });

  test('successful contact expiry starts the full authoritative cooldown', () {
    final now = DateTime.utc(2026, 9, 4, 12);
    expect(
      CallStateController.cooldownSecondsUntil(
        now.add(const Duration(seconds: 45)),
        now,
      ),
      45,
    );
    expect(
      CallStateController.cooldownSecondsUntil(
        now.subtract(const Duration(seconds: 1)),
        now,
      ),
      0,
    );
  });
}
