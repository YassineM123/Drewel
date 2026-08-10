import '../../../data/apis/api_models/get_all_driver_model.dart';

int compareMarketplaceDriversNearestFirst(Drivers a, Drivers b) {
  final int distanceOrder = (a.distanceKm ?? double.infinity)
      .compareTo(b.distanceKm ?? double.infinity);
  if (distanceOrder != 0) return distanceOrder;
  return (a.sId ?? '').compareTo(b.sId ?? '');
}
