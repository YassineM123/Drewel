import 'package:drewel/app/data/apis/api_models/get_add_driver_details_model.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Driver document URL parsing', () {
    test('falls back from blank current fields to legacy URL fields', () {
      final Driver driver = Driver.fromJson(<String, dynamic>{
        'licenseCarUrl': '',
        'carLicenseFrontUrl': 'https://cdn.example.com/car.jpg',
        'licenseDriverUrl': '   ',
        'drivingLicenseUrl': 'https://cdn.example.com/driver.jpg',
        'idDocumentUrl': null,
        'idProofUrl': 'https://cdn.example.com/id.jpg',
      });

      expect(driver.licenseCarUrl, 'https://cdn.example.com/car.jpg');
      expect(driver.carLicenseFrontUrl, 'https://cdn.example.com/car.jpg');
      expect(driver.licenseDriverUrl, 'https://cdn.example.com/driver.jpg');
      expect(
        driver.drivingLicenseFrontUrl,
        'https://cdn.example.com/driver.jpg',
      );
      expect(driver.idDocumentUrl, 'https://cdn.example.com/id.jpg');
      expect(driver.idProofFrontUrl, 'https://cdn.example.com/id.jpg');
    });

    test('keeps the current contract URL when both contracts are populated',
        () {
      final Driver driver = Driver.fromJson(<String, dynamic>{
        'licenseCarUrl': 'https://cdn.example.com/current.jpg',
        'carLicenseFrontUrl': 'https://cdn.example.com/legacy.jpg',
      });

      expect(driver.licenseCarUrl, 'https://cdn.example.com/current.jpg');
      expect(driver.carLicenseFrontUrl, 'https://cdn.example.com/legacy.jpg');
    });
  });

  group('Driver approval stages', () {
    test('parses Request 2 independently from the aggregate status', () {
      final Driver driver = Driver.fromJson(<String, dynamic>{
        'status': 'approved',
        'isApproved': true,
        'profileRequestStatus': 'pending',
        'profileSubmittedAt': '2026-07-18T09:00:00.000Z',
        'profileApprovedAt': null,
        'profileApprovedBy': null,
        'profileRejectionReason': '',
      });

      expect(driver.status, 'approved');
      expect(driver.profileRequestStatus, 'pending');
      expect(driver.profileSubmittedAt, '2026-07-18T09:00:00.000Z');
      expect(driver.profileApprovedAt, isNull);
      expect(driver.toJson()['profileRequestStatus'], 'pending');
    });

    test('preserves Request 2 rejection metadata', () {
      final Driver driver = Driver.fromJson(<String, dynamic>{
        'status': 'approved',
        'profileRequestStatus': 'rejected',
        'profileRejectionReason': 'Passport image is unreadable',
      });

      expect(driver.status, 'approved');
      expect(driver.profileRequestStatus, 'rejected');
      expect(driver.profileRejectionReason, 'Passport image is unreadable');
    });
  });
}
