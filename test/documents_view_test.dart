import 'dart:async';

import 'package:drewel/app/data/apis/api_models/get_add_driver_details_model.dart';
import 'package:drewel/app/modules/documents/controllers/documents_controller.dart';
import 'package:drewel/app/modules/documents/views/documents_view.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart';

class _DocumentsTestController extends DocumentsController {
  @override
  Future<void> callingGetDriverDetails() async {
    driverDetail = AddDriverDetailModel.fromJson({
      'success': true,
      'driver': {
        '_id': 'driver-1',
        'status': 'approved',
        'isApproved': true,
        'profileRequestStatus': 'approved',
        'city': 'Abu Dhabi',
        'vehicleType': 'Small Pickup',
      },
    });
    setLoadedProfileFields(
      city: 'Abu Dhabi',
      vehicleType: 'Small Pickup',
    );
    isLoadingDetails.value = false;
    loadError.value = '';
    increment();
  }
}

class _PendingDocumentsTestController extends DocumentsController {
  @override
  Future<void> callingGetDriverDetails() async {
    driverDetail = AddDriverDetailModel.fromJson({
      'success': true,
      'driver': {
        '_id': 'driver-1',
        'status': 'approved',
        'isApproved': true,
        'profileRequestStatus': 'pending',
        'city': 'Abu Dhabi',
        'vehicleType': 'Small Pickup',
        'driverLogs': {
          'driverId': 'driver-1',
          'city': 'Dubai',
          'vehicleType': 'Large Pickup',
          'carLicenseFrontUrl': 'https://example.test/pending-front.jpg',
        },
      },
    });
    setLoadedProfileFields(city: 'Dubai', vehicleType: 'Large Pickup');
    isLoadingDetails.value = false;
    loadError.value = '';
    hasPendingApproval.value = true;
    pendingApprovalMessage.value =
        'Your latest changes are waiting for admin approval.';
    increment();
  }
}

class _LoadingDocumentsTestController extends DocumentsController {
  final Completer<void> pendingLoad = Completer<void>();

  @override
  Future<void> callingGetDriverDetails() => pendingLoad.future;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  tearDown(() async {
    await Get.delete<DocumentsController>(force: true);
    Get.reset();
  });

  Future<void> pumpDocuments(
    WidgetTester tester, {
    required Size size,
    DocumentsController? controller,
    bool settle = true,
  }) async {
    await tester.binding.setSurfaceSize(size);
    Get.put<DocumentsController>(controller ?? _DocumentsTestController());
    await tester.pumpWidget(
      const GetMaterialApp(home: DocumentsView()),
    );
    if (settle) {
      await tester.pumpAndSettle();
    } else {
      await tester.pump();
    }
  }

  testWidgets('keeps the original vertical Documents layout on desktop',
      (tester) async {
    await pumpDocuments(tester, size: const Size(1440, 1000));

    expect(find.text('Select City'), findsWidgets);
    expect(find.text('Select Vehicle Type'), findsWidgets);
    expect(find.text('Upload Documents'), findsOneWidget);
    expect(find.text('Update'), findsOneWidget);
    expect(tester.takeException(), isNull);

    final first = tester.getTopLeft(find.text('Car License - Front'));
    final second = tester.getTopLeft(find.text('Car License - Back'));
    expect(second.dy, greaterThan(first.dy));
  });

  testWidgets('keeps the original form visible while driver data is loading',
      (tester) async {
    await pumpDocuments(
      tester,
      size: const Size(360, 800),
      controller: _LoadingDocumentsTestController(),
      settle: false,
    );

    expect(find.byType(LinearProgressIndicator), findsOneWidget);
    expect(find.text('Select City'), findsWidgets);
    expect(find.text('Upload Documents'), findsOneWidget);
    expect(find.text('Update'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('shows required labels consistently and keeps Update in view',
      (tester) async {
    await pumpDocuments(tester, size: const Size(627, 1015));

    expect(find.text('Optional'), findsNWidgets(4));
    expect(find.text('Required'), findsNWidgets(5));
    expect(find.text('Required *'), findsNWidgets(5));
    expect(
      find.text(
        'Missing documents: Car License - Front, Driver License - Front, ID Proof - Front, Profile Image, Passport Copy',
      ),
      findsOneWidget,
    );
    expect(find.byKey(const Key('documents-update-button')), findsOneWidget);
    final Offset bottomRight = tester.getBottomRight(
      find.byKey(const Key('documents-update-button')),
    );
    expect(bottomRight.dy, lessThanOrEqualTo(1015));
    expect(tester.takeException(), isNull);
  });

  testWidgets('allows a pending Request 2 to be amended', (tester) async {
    final controller = _PendingDocumentsTestController();
    await pumpDocuments(
      tester,
      size: const Size(1440, 1000),
      controller: controller,
    );

    expect(controller.isProfileRequestPending, isTrue);
    expect(controller.canEditProfile, isTrue);
    expect(controller.hasUnsavedChanges, isFalse);
    expect(find.byIcon(Icons.lock_outline), findsNothing);
    expect(
      find.text('Your latest changes are waiting for admin approval.'),
      findsOneWidget,
    );

    controller.cityController.text = 'Sharjah';
    controller.documentUrl = List<String>.filled(9, 'already-uploaded');
    controller.increment();
    await tester.pump();
    expect(controller.canSubmit, isTrue);
    expect(tester.takeException(), isNull);
  });
}
