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

Map<String, dynamic> buildGpsFixPayload({
  required double latitude,
  required double longitude,
  required DateTime recordedAt,
  required double accuracyM,
}) {
  return <String, dynamic>{
    'lat': latitude,
    'long': longitude,
    'recordedAt': recordedAt.toUtc().toIso8601String(),
    'accuracyM': accuracyM,
  };
}
