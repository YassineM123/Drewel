import '../app/data/constants/icons_constant.dart';

String canonicalVehicleTypeKey(String? value) {
  final Iterable<RegExpMatch> matches =
      RegExp(r'[a-z0-9]+').allMatches((value ?? '').toLowerCase());
  final List<String> tokens = matches.map((match) => match.group(0)!).toList();
  return tokens.join('_');
}

String vehicleTypeDisplayLabel(String? value) {
  final String key = canonicalVehicleTypeKey(value);
  if (key.isEmpty) return '';
  switch (key) {
    case 'small_pickup':
      return 'Small Pickup';
    case 'large_pickup':
      return 'Large Pickup';
    case 'delivery_truck':
    case 'truck':
      return 'Truck';
    case 'motorbike':
      return 'Motorbike';
    case 'van':
      return 'Van';
    case 'moving':
      return 'Moving';
    case 'gas_truck':
    case 'gas_delivery':
      return 'Gas Truck';
    case 'water_tanker':
      return 'Water Tanker';
    case 'recovery':
      return 'Recovery';
    case 'construction':
      return 'Construction';
    default:
      return key
          .split('_')
          .where((segment) => segment.isNotEmpty)
          .map((segment) =>
              segment[0].toUpperCase() + segment.substring(1).toLowerCase())
          .join(' ');
  }
}

String vehicleMarkerAssetPath(String? value) {
  switch (canonicalVehicleTypeKey(value)) {
    case 'small_pickup':
      return IconConstants.icSmallPickUp;
    case 'large_pickup':
      return IconConstants.icLargePickUp;
    case 'moving':
      return IconConstants.icMoving;
    case 'gas_truck':
    case 'gas_delivery':
      return IconConstants.icGasTruck;
    case 'recovery':
      return IconConstants.icRecovery;
    case 'construction':
      return IconConstants.icConstruction;
    case 'water_tanker':
      return IconConstants.icWaterTanker;
    case 'truck':
    case 'delivery_truck':
      return IconConstants.icTruck;
    case 'motorbike':
      return IconConstants.icCar;
    case 'van':
      return IconConstants.icDeliveryTruck;
    default:
      return IconConstants.icDeliveryTruckInactive;
  }
}

