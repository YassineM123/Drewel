bool isGpsTimestampFresh(
  DateTime? recordedAt, {
  required DateTime now,
  Duration maxAge = const Duration(seconds: 45),
  Duration maxFutureSkew = const Duration(seconds: 30),
}) {
  if (recordedAt == null) return false;
  final Duration age = now.toUtc().difference(recordedAt.toUtc());
  return age >= -maxFutureSkew && age <= maxAge;
}

double normalizeGpsAccuracy(
  double accuracyM, {
  double browserFallbackM = 100,
}) {
  if (accuracyM.isFinite && accuracyM >= 0) return accuracyM;
  return browserFallbackM;
}

Map<String, dynamic> buildGpsFixPayload({
  required double latitude,
  required double longitude,
  required DateTime recordedAt,
  required double accuracyM,
  double? heading,
  double? speed,
}) {
  return <String, dynamic>{
    'lat': latitude,
    'long': longitude,
    'recordedAt': recordedAt.toUtc().toIso8601String(),
    'accuracyM': normalizeGpsAccuracy(accuracyM),
    if (heading != null && heading.isFinite) 'heading': heading,
    if (speed != null && speed.isFinite) 'speed': speed,
  };
}
