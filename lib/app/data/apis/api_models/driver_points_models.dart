int _integer(dynamic value) => value is num ? value.toInt() : 0;
double _decimal(dynamic value) => value is num ? value.toDouble() : 0;
DateTime? _date(dynamic value) =>
    DateTime.tryParse((value ?? '').toString())?.toLocal();

class DriverPointsWallet {
  const DriverPointsWallet({
    required this.availablePoints,
    required this.reservedPoints,
    required this.purchasedPoints,
    required this.bonusPoints,
    required this.equivalentAvailableRides,
    required this.offerPointsCost,
    required this.canSendOffer,
    required this.balanceState,
    required this.version,
    required this.welcomeBonusGranted,
    this.availablePointsAfterOfferReservation,
    this.welcomeBonusGrantedAt,
    this.commissionRate,
    this.pointsPerAED,
    this.equivalentAED,
  });

  final int availablePoints;
  final int reservedPoints;
  final int purchasedPoints;
  final int bonusPoints;
  final int equivalentAvailableRides;
  final int offerPointsCost;
  final int? availablePointsAfterOfferReservation;
  final bool canSendOffer;
  final String balanceState;
  final int version;
  final bool welcomeBonusGranted;
  final DateTime? welcomeBonusGrantedAt;
  final double? commissionRate;
  final double? pointsPerAED;
  final double? equivalentAED;

  factory DriverPointsWallet.fromJson(Map<String, dynamic> json) {
    final int available = _integer(json['availablePoints']);
    final int reserved = _integer(json['reservedPoints']);
    final int purchased = _integer(json['availablePurchasedPoints']);
    final int bonus = _integer(json['availableBonusPoints']);
    final int offerCost = json['offerPointsCost'] != null
        ? _integer(json['offerPointsCost'])
        : 20;
    final int? afterRes = json['availablePointsAfterOfferReservation'] != null
        ? _integer(json['availablePointsAfterOfferReservation'])
        : (available >= offerCost ? available - offerCost : null);
    final bool canSend = json['canSendOffer'] != null
        ? json['canSendOffer'] == true
        : (available >= offerCost);
    final int rides = json['equivalentAvailableRides'] != null
        ? _integer(json['equivalentAvailableRides'])
        : (offerCost > 0 ? (available ~/ offerCost) : 0);

    return DriverPointsWallet(
      availablePoints: available,
      reservedPoints: reserved,
      purchasedPoints: purchased,
      bonusPoints: bonus,
      equivalentAvailableRides: rides,
      offerPointsCost: offerCost,
      availablePointsAfterOfferReservation: afterRes,
      canSendOffer: canSend,
      balanceState: (json['balanceState'] ?? (available == 0 ? 'zero' : 'normal')).toString(),
      version: _integer(json['version']),
      welcomeBonusGranted: json['welcomeBonusGranted'] == true,
      welcomeBonusGrantedAt: _date(json['welcomeBonusGrantedAt']),
      commissionRate: json['commissionRate'] is num
          ? (json['commissionRate'] as num).toDouble()
          : null,
      pointsPerAED: json['pointsPerAED'] is num
          ? (json['pointsPerAED'] as num).toDouble()
          : null,
      equivalentAED: json['equivalentAED'] is num
          ? (json['equivalentAED'] as num).toDouble()
          : null,
    );
  }
}

class PointTransaction {
  const PointTransaction({
    required this.id,
    required this.type,
    required this.status,
    required this.points,
    required this.createdAt,
    this.offerId,
    this.rideId,
    this.reason,
  });

  final String id;
  final String type;
  final String status;
  final int points;
  final DateTime? createdAt;
  final String? offerId;
  final String? rideId;
  final String? reason;

  bool get isDebit => const <String>{
        'OFFER_RESERVE',
        'RIDE_CHARGE',
        'RIDE_COMMISSION',
        'ADMIN_DEBIT',
        'PENALTY',
      }.contains(type);

  bool get isRelease => type == 'OFFER_RELEASE' || type == 'TECHNICAL_REFUND';

  factory PointTransaction.fromJson(Map<String, dynamic> json) =>
      PointTransaction(
        id: (json['_id'] ?? json['id'] ?? '').toString(),
        type: (json['type'] ?? '').toString().toUpperCase(),
        status: (json['status'] ?? '').toString().toUpperCase(),
        points: _integer(json['points']),
        createdAt: _date(json['createdAt']),
        offerId: json['offerId']?.toString(),
        rideId: json['rideId']?.toString(),
        reason: json['reason']?.toString(),
      );
}

class PointPack {
  const PointPack({
    required this.id,
    required this.name,
    required this.points,
    required this.price,
    required this.currency,
  });

  final String id;
  final String name;
  final int points;
  final double price;
  final String currency;

  factory PointPack.fromJson(Map<String, dynamic> json) => PointPack(
        id: (json['_id'] ?? json['id'] ?? '').toString(),
        name: (json['name'] ?? '').toString(),
        points: _integer(json['points']),
        price: _decimal(json['price']),
        currency: (json['currency'] ?? '').toString().toUpperCase(),
      );
}

class PointPurchaseRequest {
  const PointPurchaseRequest({
    required this.id,
    required this.reference,
    required this.status,
    required this.points,
    required this.createdAt,
    this.packName,
    this.price,
    this.currency,
  });

  final String id;
  final String reference;
  final String status;
  final int points;
  final DateTime? createdAt;
  final String? packName;
  final double? price;
  final String? currency;

  factory PointPurchaseRequest.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> snapshot = json['packSnapshot'] is Map
        ? Map<String, dynamic>.from(json['packSnapshot'] as Map)
        : const <String, dynamic>{};
    final String id = (json['_id'] ?? json['id'] ?? '').toString();
    return PointPurchaseRequest(
      id: id,
      reference:
          (json['reference'] ?? json['clientRequestId'] ?? id).toString(),
      status: (json['status'] ?? 'pending').toString().toLowerCase(),
      points: _integer(snapshot['points'] ?? json['requestedPoints']),
      createdAt: _date(json['createdAt']),
      packName: snapshot['name']?.toString(),
      price: snapshot['price'] is num
          ? (snapshot['price'] as num).toDouble()
          : null,
      currency: snapshot['currency']?.toString(),
    );
  }
}

class TripOffer {
  const TripOffer({
    required this.id,
    required this.contactRideId,
    required this.status,
    required this.reservationState,
    required this.pointsCost,
    required this.stateVersion,
    this.rideId,
    this.expiresAt,
    this.offeredPrice,
    this.currency,
    this.pickup,
    this.destination,
    this.note,
  });

  final String id;
  final String contactRideId;
  final String status;
  final String reservationState;
  final int pointsCost;
  final int stateVersion;
  final String? rideId;
  final DateTime? expiresAt;
  final double? offeredPrice;
  final String? currency;
  final Map<String, dynamic>? pickup;
  final Map<String, dynamic>? destination;
  final String? note;

  factory TripOffer.fromJson(Map<String, dynamic> json) => TripOffer(
        id: (json['id'] ?? json['_id'] ?? '').toString(),
        contactRideId: (json['contactRideId'] ?? '').toString(),
        status: (json['status'] ?? '').toString().toLowerCase(),
        reservationState:
            (json['reservationState'] ?? '').toString().toLowerCase(),
        pointsCost: _integer(json['pointsCost']),
        stateVersion: _integer(json['stateVersion']),
        rideId: json['rideId']?.toString(),
        expiresAt: _date(json['expiresAt']),
        offeredPrice: json['offeredPrice'] is num
            ? (json['offeredPrice'] as num).toDouble()
            : double.tryParse((json['offeredPrice'] ?? '').toString()),
        currency: json['currency']?.toString(),
        pickup: json['pickup'] is Map
            ? Map<String, dynamic>.from(json['pickup'] as Map)
            : null,
        destination: json['destination'] is Map
            ? Map<String, dynamic>.from(json['destination'] as Map)
            : null,
        note: json['note']?.toString(),
      );
}

class TripOfferDraft {
  const TripOfferDraft({
    required this.contactRideId,
    required this.offeredPrice,
    required this.currency,
    required this.pickup,
    required this.destination,
    this.vehicleType = '',
    this.note = '',
  });

  final String contactRideId;
  final double offeredPrice;
  final String currency;
  final Map<String, dynamic> pickup;
  final Map<String, dynamic> destination;
  final String vehicleType;
  final String note;
}
