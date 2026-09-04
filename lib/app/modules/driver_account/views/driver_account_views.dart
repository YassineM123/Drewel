import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';

import '../../../../common/colors.dart';
import '../../../../common/drewel_app_bar.dart';
import '../../../../common/legal_document_body.dart';
import '../../../../common/text_styles.dart';
import '../../../data/apis/api_models/active_ride_model.dart';
import '../../../data/apis/api_models/driver_points_models.dart';
import '../../../data/apis/api_models/get_add_driver_details_model.dart';
import '../../../data/apis/api_models/passenger_account_models.dart';
import '../../../routes/app_pages.dart';
import '../controllers/driver_account_controller.dart';

const Color _pageColor = Color(0xFFF6F7F9);
const Color _lineColor = Color(0xFFE7E8EC);
const double _radius = 8;

class DriverProfileView extends GetView<DriverAccountController> {
  const DriverProfileView({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar:
            const DrewelAppBar(title: 'Driver Profile', showBackButton: true),
        backgroundColor: _pageColor,
        body: SafeArea(
          child: Obx(() {
            if (controller.loading.value && controller.driver.value == null) {
              return const Center(
                child: CircularProgressIndicator(color: primaryColor),
              );
            }
            if (controller.error.value.isNotEmpty &&
                controller.driver.value == null) {
              return _StateMessage(
                icon: Icons.wifi_off_rounded,
                title: 'Unable to load driver account',
                message: controller.error.value,
                actionLabel: 'Retry',
                onAction: controller.refreshAll,
              );
            }
            final Driver? driver = controller.driver.value;
            return RefreshIndicator(
              onRefresh: controller.refreshAll,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
                children: <Widget>[
                  _DriverIdentityHeader(driver: driver),
                  const SizedBox(height: 18),
                  _UrgentDriverBanners(
                      driver: driver, wallet: controller.wallet),
                  _Section(
                    title: 'Account',
                    children: <Widget>[
                      _MenuRow(
                        icon: Icons.person_outline_rounded,
                        title: 'Personal Information',
                        subtitle: 'Photo, name, phone and WhatsApp',
                        onTap: () => Get.toNamed(Routes.DRIVER_EDIT_PROFILE),
                      ),
                      _MenuRow(
                        icon: Icons.directions_car_outlined,
                        title: 'Vehicle',
                        subtitle: _vehicleSummary(driver),
                        onTap: () => Get.toNamed(Routes.DRIVER_VEHICLE),
                      ),
                      _MenuRow(
                        icon: Icons.file_copy_outlined,
                        title: 'Documents',
                        subtitle: _documentSummary(driver),
                        onTap: () => Get.toNamed(Routes.DOCUMENTS),
                      ),
                    ],
                  ),
                  _Section(
                    title: 'Work',
                    children: <Widget>[
                      _MenuRow(
                        icon: Icons.history_rounded,
                        title: 'Ride History',
                        subtitle: 'Completed, cancelled and active rides',
                        onTap: () => Get.toNamed(Routes.DRIVER_RIDE_HISTORY),
                      ),
                      _MenuRow(
                        icon: Icons.insights_rounded,
                        title: 'Earnings / Activity',
                        subtitle: 'Real ride totals from your history',
                        onTap: () => Get.toNamed(Routes.DRIVER_EARNINGS),
                      ),
                      _MenuRow(
                        icon: Icons.toll_rounded,
                        title: 'Balance',
                        subtitle: _pointsSummary(controller.wallet),
                        onTap: () => Get.toNamed(Routes.MY_POINTS),
                      ),
                      _MenuRow(
                        icon: Icons.query_stats_rounded,
                        title: 'Performance',
                        subtitle: 'Completion and activity statistics',
                        onTap: () => Get.toNamed(Routes.DRIVER_PERFORMANCE),
                      ),
                    ],
                  ),
                  _Section(
                    title: 'Communication',
                    children: <Widget>[
                      _MenuRow(
                        icon: Icons.chat_bubble_outline_rounded,
                        title: 'Messages',
                        subtitle: 'Ride-linked passenger conversations',
                        onTap: () => Get.toNamed(Routes.MESSAGES),
                      ),
                      _MenuRow(
                        icon: Icons.notifications_none_rounded,
                        title: 'Notifications',
                        subtitle: 'Ride, message, balance and system updates',
                        onTap: () => Get.toNamed(Routes.NOTIFICATIONS),
                      ),
                    ],
                  ),
                  _Section(
                    title: 'Support',
                    children: <Widget>[
                      _MenuRow(
                        icon: Icons.support_agent_rounded,
                        title: 'Support',
                        subtitle: 'Get help from Drewel support',
                        onTap: () => Get.toNamed(Routes.DRIVER_HELP_SUPPORT),
                      ),
                      _MenuRow(
                        icon: Icons.flag_outlined,
                        title: 'Report a Problem',
                        subtitle:
                            'Passenger, ride, balance, document or app issue',
                        onTap: () => Get.toNamed(Routes.DRIVER_REPORT_PROBLEM),
                      ),
                    ],
                  ),
                  _Section(
                    title: 'Settings',
                    children: <Widget>[
                      _MenuRow(
                        icon: Icons.settings_outlined,
                        title: 'Settings',
                        subtitle: 'Language, privacy, security and app info',
                        onTap: () => Get.toNamed(Routes.DRIVER_SETTINGS),
                      ),
                      _MenuRow(
                        icon: Icons.language_rounded,
                        title: 'Language',
                        subtitle: 'English and Arabic',
                        onTap: () => Get.toNamed(Routes.DRIVER_LANGUAGE),
                      ),
                      _MenuRow(
                        icon: Icons.privacy_tip_outlined,
                        title: 'Privacy',
                        subtitle: 'Location and communication privacy',
                        onTap: () => Get.toNamed(
                          Routes.DRIVER_LEGAL,
                          parameters: {'type': 'privacy'},
                        ),
                      ),
                      _MenuRow(
                        icon: Icons.security_rounded,
                        title: 'Security',
                        subtitle: 'Login and verified contact protection',
                        onTap: () => Get.toNamed(Routes.DRIVER_SECURITY),
                      ),
                    ],
                  ),
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: primaryColor,
                      minimumSize: const Size.fromHeight(50),
                      side: const BorderSide(color: primaryColor),
                    ),
                    onPressed: controller.logout,
                    icon: const Icon(Icons.logout_rounded),
                    label: Text('logout'.tr),
                  ),
                ],
              ),
            );
          }),
        ),
      );
}

class DriverEditProfileView extends StatefulWidget {
  const DriverEditProfileView({super.key});

  @override
  State<DriverEditProfileView> createState() => _DriverEditProfileViewState();
}

class _DriverEditProfileViewState extends State<DriverEditProfileView> {
  final DriverAccountController controller =
      Get.find<DriverAccountController>();
  late final TextEditingController firstName;
  late final TextEditingController lastName;
  late final TextEditingController phone;
  late final TextEditingController email;
  late final TextEditingController whatsapp;

  @override
  void initState() {
    super.initState();
    final Driver? driver = controller.driver.value;
    firstName = TextEditingController(text: driver?.firstName ?? '');
    lastName = TextEditingController(text: driver?.lastName ?? '');
    phone = TextEditingController(text: driver?.phone ?? '');
    email = TextEditingController(text: driver?.email ?? '');
    whatsapp = TextEditingController(text: driver?.whatsappNumber ?? '');
  }

  @override
  void dispose() {
    firstName.dispose();
    lastName.dispose();
    phone.dispose();
    email.dispose();
    whatsapp.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: const DrewelAppBar(
            title: 'Personal Information', showBackButton: true),
        backgroundColor: _pageColor,
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: <Widget>[
            Obx(() {
              final Driver? driver = controller.driver.value;
              return Center(
                child: Stack(
                  children: <Widget>[
                    _Avatar(url: driver?.profileImageUrl, radius: 48),
                    Positioned(
                      right: 0,
                      bottom: 0,
                      child: IconButton.filled(
                        style: IconButton.styleFrom(
                          backgroundColor: primaryColor,
                          foregroundColor: Colors.white,
                        ),
                        onPressed: controller.changePhoto,
                        icon: const Icon(Icons.camera_alt_rounded),
                      ),
                    ),
                  ],
                ),
              );
            }),
            const SizedBox(height: 28),
            _TextField(label: 'First name', controller: firstName),
            _TextField(label: 'Last name', controller: lastName),
            _TextField(
              label: 'Phone',
              controller: phone,
              keyboardType: TextInputType.phone,
            ),
            _TextField(
              label: 'WhatsApp number',
              controller: whatsapp,
              keyboardType: TextInputType.phone,
            ),
            _TextField(
              label: 'email'.tr,
              controller: email,
              keyboardType: TextInputType.emailAddress,
            ),
            Text(
              'verified_identity_notice'.tr,
              style: const TextStyle(color: text2Color, fontSize: 13),
            ),
            const SizedBox(height: 24),
            Obx(
              () => FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: primaryColor,
                  minimumSize: const Size.fromHeight(52),
                ),
                onPressed: controller.saving.value
                    ? null
                    : () => controller.saveProfile(
                          firstName: firstName.text,
                          lastName: lastName.text,
                          phone: phone.text,
                          email: email.text,
                          whatsappNumber: whatsapp.text,
                        ),
                child: controller.saving.value
                    ? const CircularProgressIndicator()
                    : Text('save'.tr),
              ),
            ),
          ],
        ),
      );
}

class DriverVehicleView extends GetView<DriverAccountController> {
  const DriverVehicleView({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: const DrewelAppBar(title: 'Vehicle', showBackButton: true),
        backgroundColor: _pageColor,
        body: Obx(() {
          final Driver? driver = controller.driver.value;
          return RefreshIndicator(
            onRefresh: controller.refreshAll,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: <Widget>[
                _StatusBanner(
                  icon: Icons.verified_rounded,
                  title: _verificationLabel(driver),
                  message: _verificationMessage(driver),
                ),
                _InfoBlock(
                    'Vehicle category', driver?.vehicleType ?? 'Not available'),
                _InfoBlock('Model', driver?.vehicleModel ?? 'Not available'),
                _InfoBlock(
                    'Plate number', driver?.registration ?? 'Not available'),
                _InfoBlock(
                    'City / service area', driver?.city ?? 'Not available'),
                _InfoBlock('Company licence',
                    driver?.licenseCompany ?? 'Not available'),
                _InfoBlock('Approval status', _driverStatus(driver)),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: () => Get.toNamed(Routes.DOCUMENTS),
                  icon: const Icon(Icons.file_copy_outlined),
                  label: Text('manage_documents'.tr),
                ),
              ],
            ),
          );
        }),
      );
}

class DriverRideHistoryView extends GetView<DriverAccountController> {
  const DriverRideHistoryView({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: const DrewelAppBar(title: 'Ride History', showBackButton: true),
        backgroundColor: _pageColor,
        body: Column(
          children: <Widget>[
            _RideFilters(controller: controller),
            Expanded(
              child: Obx(() {
                final List<ActiveRideModel> rides = controller.filteredRides;
                if (rides.isEmpty) {
                  return const _StateMessage(
                    icon: Icons.route_outlined,
                    title: 'No rides found',
                    message:
                        'Your driver rides appear here after real ride activity.',
                  );
                }
                return RefreshIndicator(
                  onRefresh: controller.refreshAll,
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: rides.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, int index) => _RideTile(
                      ride: rides[index],
                      onTap: () => Get.toNamed(
                        Routes.DRIVER_RIDE_DETAILS,
                        arguments: rides[index],
                      ),
                    ),
                  ),
                );
              }),
            ),
          ],
        ),
      );
}

class DriverRideDetailsView extends StatelessWidget {
  const DriverRideDetailsView({super.key});

  @override
  Widget build(BuildContext context) {
    final ActiveRideModel ride = Get.arguments as ActiveRideModel;
    return Scaffold(
      appBar: const DrewelAppBar(title: 'Ride Details', showBackButton: true),
      backgroundColor: _pageColor,
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: <Widget>[
          _InfoBlock('Ride ID', ride.reference ?? ride.id),
          _InfoBlock('Passenger', ride.passenger?.firstName ?? 'Passenger'),
          _InfoBlock('Status', _statusLabel(ride.status)),
          _InfoBlock('Pickup', ride.pickup?.address ?? 'Not available'),
          _InfoBlock(
              'Destination', ride.destination?.address ?? 'Not available'),
          _InfoBlock('Vehicle', ride.vehicleType ?? 'Not available'),
          _InfoBlock(
              'Ride value',
              ride.agreedPrice == null
                  ? 'Not available'
                  : '${ride.agreedPrice}'),
          _InfoBlock(
              'Updated',
              ride.updatedAt == null
                  ? 'Not available'
                  : _date(ride.updatedAt!)),
          FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: primaryColor),
            onPressed: () => Get.toNamed(
              Routes.DRIVER_REPORT_PROBLEM,
              parameters: {'rideId': ride.id, 'category': 'ride'},
            ),
            icon: const Icon(Icons.flag_outlined),
            label: Text('report_problem'.tr),
          ),
          OutlinedButton.icon(
            onPressed: () => Get.toNamed(Routes.MESSAGES),
            icon: const Icon(Icons.chat_bubble_outline_rounded),
            label: Text('view_messages'.tr),
          ),
        ],
      ),
    );
  }
}

class DriverEarningsView extends GetView<DriverAccountController> {
  const DriverEarningsView({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: const DrewelAppBar(
            title: 'Earnings / Activity', showBackButton: true),
        backgroundColor: _pageColor,
        body: Obx(() {
          final DriverPerformanceSummary stats = controller.performance;
          return RefreshIndicator(
            onRefresh: controller.refreshAll,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: <Widget>[
                _MetricGrid(metrics: <_MetricData>[
                  _MetricData('Completed rides', '${stats.completed}'),
                  _MetricData('Active rides', '${stats.active}'),
                  _MetricData('Cancelled rides', '${stats.cancelled}'),
                  _MetricData(
                      'Ride value',
                      stats.totalValue == 0
                          ? '0'
                          : stats.totalValue.toStringAsFixed(2)),
                ]),
                const SizedBox(height: 16),
                const _StatusBanner(
                  icon: Icons.info_outline_rounded,
                  title: 'Driver earnings',
                  message:
                      'This screen shows real ride activity and ride value only. Payout logic is not shown unless Drewel configures it in the backend.',
                ),
              ],
            ),
          );
        }),
      );
}

class DriverPerformanceView extends GetView<DriverAccountController> {
  const DriverPerformanceView({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: const DrewelAppBar(title: 'Performance', showBackButton: true),
        backgroundColor: _pageColor,
        body: Obx(() {
          final DriverPerformanceSummary stats = controller.performance;
          final Driver? driver = controller.driver.value;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: <Widget>[
              _MetricGrid(metrics: <_MetricData>[
                _MetricData('Completed', '${stats.completed}'),
                _MetricData('Cancelled', '${stats.cancelled}'),
                _MetricData('Completion rate', _percent(stats.completionRate)),
                _MetricData(
                    'Cancellation rate', _percent(stats.cancellationRate)),
                _MetricData(
                    'Average rating',
                    driver?.rating == null
                        ? 'Not supported'
                        : '${driver!.rating}'),
                _MetricData('Status', driver?.availabilityStatus ?? 'Offline'),
              ]),
            ],
          );
        }),
      );
}

class DriverSettingsView extends StatelessWidget {
  const DriverSettingsView({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: const DrewelAppBar(title: 'Settings', showBackButton: true),
        backgroundColor: _pageColor,
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: <Widget>[
            const _PageIntro(
              icon: Icons.settings_outlined,
              title: 'Driver settings',
              message: 'Manage language, alerts, privacy and security.',
            ),
            _MenuRow(
              icon: Icons.language_rounded,
              title: 'Language',
              onTap: () => Get.toNamed(Routes.DRIVER_LANGUAGE),
            ),
            _MenuRow(
              icon: Icons.notifications_none_rounded,
              title: 'Notification Preferences',
              onTap: () => Get.toNamed(Routes.DRIVER_NOTIFICATION_PREFERENCES),
            ),
            _MenuRow(
              icon: Icons.privacy_tip_outlined,
              title: 'Privacy',
              onTap: () => Get.toNamed(Routes.DRIVER_LEGAL,
                  parameters: {'type': 'privacy'}),
            ),
            _MenuRow(
              icon: Icons.security_rounded,
              title: 'Security',
              onTap: () => Get.toNamed(Routes.DRIVER_SECURITY),
            ),
            _MenuRow(
              icon: Icons.info_outline_rounded,
              title: 'About Drewel',
              onTap: () => Get.toNamed(Routes.DRIVER_ABOUT),
            ),
          ],
        ),
      );
}

class DriverLanguageView extends GetView<DriverAccountController> {
  const DriverLanguageView({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: const DrewelAppBar(title: 'Language', showBackButton: true),
        backgroundColor: _pageColor,
        body: Obx(() {
          final String selected =
              controller.preferences.value?.language ?? 'en';
          return ListView(
            padding: const EdgeInsets.all(16),
            children: <Widget>[
              const _PageIntro(
                icon: Icons.language_rounded,
                title: 'Choose app language',
                message: 'This updates Drewel labels immediately.',
              ),
              _RadioRow(
                title: 'English',
                selected: selected == 'en',
                onTap: () => controller.updateLanguage('en'),
              ),
              _RadioRow(
                title: 'Arabic',
                selected: selected == 'ar',
                onTap: () => controller.updateLanguage('ar'),
              ),
            ],
          );
        }),
      );
}

class DriverNotificationPreferencesView
    extends GetView<DriverAccountController> {
  const DriverNotificationPreferencesView({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar:
            const DrewelAppBar(title: 'Notifications', showBackButton: true),
        backgroundColor: _pageColor,
        body: Obx(() {
          final NotificationPreferenceModel prefs =
              controller.preferences.value?.notifications ??
                  const NotificationPreferenceModel(
                    rideUpdates: true,
                    messages: true,
                    accountUpdates: true,
                    sounds: true,
                    vibration: true,
                  );
          return ListView(
            padding: const EdgeInsets.all(16),
            children: <Widget>[
              const _PageIntro(
                icon: Icons.notifications_none_rounded,
                title: 'Notification controls',
                message: 'Manage ride, message, balance and system alerts.',
              ),
              _SwitchRow(
                  title: 'Ride updates',
                  value: prefs.rideUpdates,
                  onChanged: null),
              _SwitchRow(
                title: 'Messages',
                value: prefs.messages,
                onChanged: (bool value) =>
                    controller.updateNotificationPreference(
                        prefs.copyWith(messages: value)),
              ),
              _SwitchRow(
                title: 'Account updates',
                value: prefs.accountUpdates,
                onChanged: (bool value) =>
                    controller.updateNotificationPreference(
                        prefs.copyWith(accountUpdates: value)),
              ),
              _SwitchRow(
                title: 'Sounds',
                value: prefs.sounds,
                onChanged: (bool value) =>
                    controller.updateNotificationPreference(
                        prefs.copyWith(sounds: value)),
              ),
              _SwitchRow(
                title: 'Vibration',
                value: prefs.vibration,
                onChanged: (bool value) =>
                    controller.updateNotificationPreference(
                        prefs.copyWith(vibration: value)),
              ),
            ],
          );
        }),
      );
}

class DriverLegalView extends GetView<DriverAccountController> {
  const DriverLegalView({super.key});

  @override
  Widget build(BuildContext context) {
    final String type = Get.parameters['type'] ?? 'privacy';
    final String language = controller.preferences.value?.language ??
        Get.locale?.languageCode ??
        'en';
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (controller.legalContent.value == null ||
          controller.legalType.value != type ||
          controller.legalLanguage.value != language) {
        controller.loadLegal(type);
      }
    });
    return Scaffold(
      appBar: DrewelAppBar(
        title: type == 'driver-terms'
            ? 'Driver Terms & Conditions'
            : type == 'terms'
                ? 'Terms & Conditions'
                : 'Privacy',
        showBackButton: true,
      ),
      backgroundColor: _pageColor,
      body: Obx(() {
        final LegalContentModel? legal = controller.legalContent.value;
        if (legal == null) {
          if (controller.error.value.isNotEmpty) {
            return _StateMessage(
              icon: Icons.description_outlined,
              title: 'Content unavailable',
              message: controller.error.value,
              actionLabel: 'Retry',
              onAction: () => controller.loadLegal(type),
            );
          }
          return const Center(child: CircularProgressIndicator());
        }
        if (legal.body.trim().isEmpty) {
          return const _StateMessage(
            icon: Icons.description_outlined,
            title: 'Legal content not configured',
            message:
                'The backend will show approved Drewel legal content once configured.',
          );
        }
        return LegalDocumentBody(legal: legal);
      }),
    );
  }
}

class DriverSecurityView extends StatelessWidget {
  const DriverSecurityView({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: const DrewelAppBar(title: 'Security', showBackButton: true),
        backgroundColor: _pageColor,
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: const <Widget>[
            _PageIntro(
              icon: Icons.security_rounded,
              title: 'Protected by verified login',
              message:
                  'Password and session controls will appear here when the backend exposes driver-safe security actions.',
            ),
            _InfoBlock('Login', 'Verified phone / WhatsApp OTP'),
            _InfoBlock(
                'Private messages', 'Passenger phone numbers stay hidden'),
            _InfoBlock(
                'Account changes', 'Sensitive updates go through review'),
          ],
        ),
      );
}

class DriverHelpSupportView extends StatelessWidget {
  const DriverHelpSupportView({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: const DrewelAppBar(title: 'Support', showBackButton: true),
        backgroundColor: _pageColor,
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: <Widget>[
            const _PageIntro(
              icon: Icons.support_agent_rounded,
              title: 'How can we help?',
              message:
                  'Pick the closest topic so support gets the right context.',
            ),
            _MenuRow(
                icon: Icons.route_outlined,
                title: 'Ride issue',
                subtitle: 'Pickup, destination or ride status',
                onTap: () => _report('ride')),
            _MenuRow(
                icon: Icons.person_pin_outlined,
                title: 'Passenger issue',
                subtitle: 'Behavior, safety or contact problem',
                onTap: () => _report('passenger')),
            _MenuRow(
                icon: Icons.toll_rounded,
                title: 'Balance issue',
                subtitle: 'Balance, transactions or recharge request',
                onTap: () => _report('points')),
            _MenuRow(
                icon: Icons.file_copy_outlined,
                title: 'Document issue',
                subtitle: 'Approval, rejection or expiry concern',
                onTap: () => _report('document')),
            _MenuRow(
                icon: Icons.bug_report_outlined,
                title: 'Technical issue',
                subtitle: 'App, map, notification or connection problem',
                onTap: () => _report('technical')),
            _MenuRow(
                icon: Icons.support_agent_rounded,
                title: 'Contact Drewel Support',
                subtitle: 'Open secure support chat',
                onTap: () => Get.toNamed(Routes.SUPPORT_CHAT)),
          ],
        ),
      );

  void _report(String category) => Get.toNamed(
        Routes.DRIVER_REPORT_PROBLEM,
        parameters: {'category': category},
      );
}

class DriverReportProblemView extends StatefulWidget {
  const DriverReportProblemView({super.key});

  @override
  State<DriverReportProblemView> createState() =>
      _DriverReportProblemViewState();
}

class _DriverReportProblemViewState extends State<DriverReportProblemView> {
  final DriverAccountController controller =
      Get.find<DriverAccountController>();
  late String category = Get.parameters['category'] ?? 'ride';
  late String rideId = Get.parameters['rideId'] ?? '';
  final TextEditingController description = TextEditingController();

  @override
  void dispose() {
    description.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar:
            const DrewelAppBar(title: 'Report a Problem', showBackButton: true),
        backgroundColor: _pageColor,
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: <Widget>[
            const _PageIntro(
              icon: Icons.flag_outlined,
              title: 'Send a clear report',
              message: 'Add the ride when relevant and describe what happened.',
            ),
            DropdownButtonFormField<String>(
              initialValue: category,
              decoration: _inputDecoration('Issue category'),
              items: const <String>[
                'ride',
                'passenger',
                'safety',
                'pickup',
                'points',
                'document',
                'technical',
                'account',
                'other',
              ]
                  .map((String item) => DropdownMenuItem<String>(
                        value: item,
                        child: Text(item.capitalizeFirst ?? item),
                      ))
                  .toList(growable: false),
              onChanged: (String? value) =>
                  setState(() => category = value ?? category),
            ),
            const SizedBox(height: 14),
            DropdownButtonFormField<String>(
              initialValue: rideId.isEmpty ? null : rideId,
              decoration: _inputDecoration('Related ride'),
              items: controller.rides
                  .map((ActiveRideModel ride) => DropdownMenuItem<String>(
                        value: ride.id,
                        child: Text(ride.reference ?? ride.id),
                      ))
                  .toList(growable: false),
              onChanged: (String? value) =>
                  setState(() => rideId = value ?? ''),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: description,
              minLines: 5,
              maxLines: 8,
              decoration: _inputDecoration('Description'),
            ),
            const SizedBox(height: 24),
            Obx(
              () => FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: primaryColor,
                  minimumSize: const Size.fromHeight(52),
                ),
                onPressed: controller.saving.value
                    ? null
                    : () => controller.reportProblem(
                          category: category,
                          rideId: rideId,
                          description: description.text,
                        ),
                child: controller.saving.value
                    ? const CircularProgressIndicator()
                    : Text('send_report'.tr),
              ),
            ),
          ],
        ),
      );
}

class DriverAboutView extends GetView<DriverAccountController> {
  const DriverAboutView({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: const DrewelAppBar(title: 'About Drewel', showBackButton: true),
        backgroundColor: _pageColor,
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: <Widget>[
            _PageIntro(
              icon: Icons.local_taxi_rounded,
              title: 'Drewel Driver',
              message:
                  'Driver marketplace operations, secure ride communication and balance.',
              footer: Obx(
                () => Text(
                  controller.appVersion.value.isEmpty
                      ? 'Version unavailable'
                      : 'Version ${controller.appVersion.value}',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
            ),
            _MenuRow(
              icon: Icons.description_outlined,
              title: 'Terms & Conditions',
              onTap: () => Get.toNamed(Routes.DRIVER_LEGAL,
                  parameters: {'type': 'driver-terms'}),
            ),
            _MenuRow(
              icon: Icons.privacy_tip_outlined,
              title: 'Privacy',
              onTap: () => Get.toNamed(Routes.DRIVER_LEGAL,
                  parameters: {'type': 'privacy'}),
            ),
            _MenuRow(
              icon: Icons.support_agent_rounded,
              title: 'Support',
              onTap: () => Get.toNamed(Routes.DRIVER_HELP_SUPPORT),
            ),
          ],
        ),
      );
}

class _DriverIdentityHeader extends StatelessWidget {
  const _DriverIdentityHeader({required this.driver});

  final Driver? driver;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(_radius),
          border: Border.all(color: _lineColor),
        ),
        child: Row(
          children: <Widget>[
            _Avatar(url: driver?.profileImageUrl, radius: 36),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    _driverName(driver),
                    style: MyTextStyle.titleStyle20bb,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${driver?.countryCode ?? ''} ${driver?.phone ?? ''}'
                        .trim(),
                    style: const TextStyle(color: text2Color),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: <Widget>[
                      _Pill(_verificationLabel(driver)),
                      _Pill(driver?.availabilityStatus ??
                          (driver?.isOnline == true ? 'Online' : 'Offline')),
                      if (driver?.rating != null)
                        _Pill('${driver!.rating} rating'),
                    ],
                  ),
                ],
              ),
            ),
            IconButton(
              tooltip: 'Edit profile',
              onPressed: () => Get.toNamed(Routes.DRIVER_EDIT_PROFILE),
              icon: const Icon(Icons.edit_outlined),
            ),
          ],
        ),
      );
}

class _UrgentDriverBanners extends StatelessWidget {
  const _UrgentDriverBanners({required this.driver, required this.wallet});

  final Driver? driver;
  final DriverPointsWallet? wallet;

  @override
  Widget build(BuildContext context) {
    final List<Widget> banners = <Widget>[];
    if (driver?.isRestricted == true) {
      banners.add(const _StatusBanner(
          icon: Icons.block_rounded,
          title: 'Account restricted',
          message: 'Contact Drewel support before going online.'));
    } else if (driver?.isApproved != true || driver?.status != 'completed') {
      banners.add(_StatusBanner(
          icon: Icons.pending_actions_rounded,
          title: _verificationLabel(driver),
          message: _verificationMessage(driver)));
    }
    if (wallet != null && wallet!.balanceState == 'low') {
      banners.add(_StatusBanner(
          icon: Icons.toll_rounded,
          title: 'Low balance',
          message: 'Recharge balance before sending more offers.',
          actionLabel: 'Recharge',
          onAction: () => Get.toNamed(Routes.BUY_POINTS)));
    }
    if (banners.isEmpty) return const SizedBox(height: 6);
    return Column(children: <Widget>[...banners, const SizedBox(height: 8)]);
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 22),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Padding(
              padding: const EdgeInsets.only(left: 4, bottom: 6),
              child: Text(title, style: MyTextStyle.titleStyle16bb),
            ),
            DecoratedBox(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(_radius),
                border: Border.all(color: _lineColor),
              ),
              child: Column(children: children),
            ),
          ],
        ),
      );
}

class _MenuRow extends StatelessWidget {
  const _MenuRow(
      {required this.icon,
      required this.title,
      this.subtitle,
      required this.onTap});

  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => ListTile(
        onTap: onTap,
        minLeadingWidth: 42,
        leading: _IconBadge(icon),
        title: Text(
          title,
          style: const TextStyle(fontWeight: FontWeight.w700),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: subtitle == null
            ? null
            : Text(
                subtitle!,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
        trailing: const Icon(Icons.chevron_right_rounded, color: text2Color),
      );
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.url, required this.radius});

  final String? url;
  final double radius;

  @override
  Widget build(BuildContext context) => CircleAvatar(
        radius: radius,
        backgroundColor: primaryColor.withValues(alpha: 0.10),
        backgroundImage:
            url?.trim().isNotEmpty == true ? NetworkImage(url!.trim()) : null,
        child: url?.trim().isNotEmpty == true
            ? null
            : const Icon(Icons.person_rounded, color: primaryColor),
      );
}

class _Pill extends StatelessWidget {
  const _Pill(this.label);
  final String label;

  @override
  Widget build(BuildContext context) => DecoratedBox(
        decoration: BoxDecoration(
          color: primaryColor.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          child: Text(label,
              style: const TextStyle(
                  color: primaryColor,
                  fontSize: 12,
                  fontWeight: FontWeight.w700)),
        ),
      );
}

class _IconBadge extends StatelessWidget {
  const _IconBadge(this.icon);

  final IconData icon;

  @override
  Widget build(BuildContext context) => Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: primaryColor.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(_radius),
        ),
        child: Icon(icon, color: primaryColor, size: 21),
      );
}

class _PageIntro extends StatelessWidget {
  const _PageIntro({
    required this.icon,
    required this.title,
    required this.message,
    this.footer,
  });

  final IconData icon;
  final String title;
  final String message;
  final Widget? footer;

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(bottom: 14),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(_radius),
          border: Border.all(color: _lineColor),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            _IconBadge(icon),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(title,
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  Text(message, style: const TextStyle(color: text2Color)),
                  if (footer != null) ...<Widget>[
                    const SizedBox(height: 10),
                    footer!,
                  ],
                ],
              ),
            ),
          ],
        ),
      );
}

class _StatusBanner extends StatelessWidget {
  const _StatusBanner(
      {required this.icon,
      required this.title,
      required this.message,
      this.actionLabel,
      this.onAction});

  final IconData icon;
  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(_radius),
          border: Border.all(color: const Color(0xFFE9E9E9)),
        ),
        child: Row(
          children: <Widget>[
            Icon(icon, color: primaryColor),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(title,
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 3),
                  Text(message,
                      style: const TextStyle(color: text2Color, fontSize: 13)),
                ],
              ),
            ),
            if (actionLabel != null && onAction != null)
              TextButton(onPressed: onAction, child: Text(actionLabel!)),
          ],
        ),
      );
}

class _TextField extends StatelessWidget {
  const _TextField(
      {required this.label, required this.controller, this.keyboardType});

  final String label;
  final TextEditingController controller;
  final TextInputType? keyboardType;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: TextField(
          controller: controller,
          keyboardType: keyboardType,
          decoration: _inputDecoration(label),
        ),
      );
}

InputDecoration _inputDecoration(String label) => InputDecoration(
      labelText: label,
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(_radius),
        borderSide: const BorderSide(color: _lineColor),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(_radius),
        borderSide: const BorderSide(color: _lineColor),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(_radius),
        borderSide: const BorderSide(color: primaryColor),
      ),
    );

class _RideFilters extends StatelessWidget {
  const _RideFilters({required this.controller});

  final DriverAccountController controller;

  @override
  Widget build(BuildContext context) => Obx(
        () => Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: SegmentedButton<String>(
            selected: <String>{controller.rideFilter.value},
            onSelectionChanged: (Set<String> value) =>
                controller.rideFilter.value = value.first,
            segments: <ButtonSegment<String>>[
              ButtonSegment<String>(value: 'all', label: Text('all'.tr)),
              ButtonSegment<String>(
                  value: 'completed', label: Text('completed'.tr)),
              ButtonSegment<String>(
                  value: 'cancelled', label: Text('cancelled'.tr)),
            ],
          ),
        ),
      );
}

class _RideTile extends StatelessWidget {
  const _RideTile({required this.ride, required this.onTap});

  final ActiveRideModel ride;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(_radius),
          side: const BorderSide(color: _lineColor),
        ),
        child: ListTile(
          onTap: onTap,
          leading: const _IconBadge(Icons.local_taxi_rounded),
          title:
              Text(ride.destination?.address ?? 'Ride ${ride.reference ?? ''}'),
          subtitle: Text(
              '${_statusLabel(ride.status)} - ${ride.passenger?.firstName ?? 'Passenger'}'),
          trailing: Text(ride.agreedPrice == null ? '' : '${ride.agreedPrice}',
              style: const TextStyle(fontWeight: FontWeight.w700)),
        ),
      );
}

class _InfoBlock extends StatelessWidget {
  const _InfoBlock(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(_radius),
            border: Border.all(color: _lineColor),
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(label, style: const TextStyle(color: text2Color)),
                const SizedBox(height: 4),
                Text(value,
                    style: const TextStyle(fontWeight: FontWeight.w700)),
              ],
            ),
          ),
        ),
      );
}

class _MetricData {
  const _MetricData(this.label, this.value);
  final String label;
  final String value;
}

class _MetricGrid extends StatelessWidget {
  const _MetricGrid({required this.metrics});

  final List<_MetricData> metrics;

  @override
  Widget build(BuildContext context) => GridView.count(
        crossAxisCount: 2,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        childAspectRatio: 1.6,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        children: metrics
            .map((item) => DecoratedBox(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(_radius),
                    border: Border.all(color: _lineColor),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: <Widget>[
                        Text(item.value,
                            style: MyTextStyle.titleStyle20bb,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis),
                        const SizedBox(height: 4),
                        Text(item.label,
                            style: const TextStyle(color: text2Color)),
                      ],
                    ),
                  ),
                ))
            .toList(growable: false),
      );
}

class _RadioRow extends StatelessWidget {
  const _RadioRow(
      {required this.title, required this.selected, required this.onTap});

  final String title;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => ListTile(
        onTap: onTap,
        title: Text(title),
        trailing: Icon(
            selected
                ? Icons.radio_button_checked
                : Icons.radio_button_unchecked,
            color: selected ? primaryColor : text2Color),
      );
}

class _SwitchRow extends StatelessWidget {
  const _SwitchRow(
      {required this.title, required this.value, required this.onChanged});

  final String title;
  final bool value;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) => SwitchListTile(
        value: value,
        onChanged: onChanged,
        activeThumbColor: primaryColor,
        title: Text(title),
      );
}

class _StateMessage extends StatelessWidget {
  const _StateMessage(
      {required this.icon,
      required this.title,
      required this.message,
      this.actionLabel,
      this.onAction});

  final IconData icon;
  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Icon(icon, size: 52, color: const Color(0xFFC9C9C9)),
              const SizedBox(height: 14),
              Text(title,
                  style: MyTextStyle.titleStyle16bb,
                  textAlign: TextAlign.center),
              const SizedBox(height: 6),
              Text(message,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: text2Color)),
              if (actionLabel != null && onAction != null) ...<Widget>[
                const SizedBox(height: 16),
                FilledButton(onPressed: onAction, child: Text(actionLabel!)),
              ],
            ],
          ),
        ),
      );
}

String _driverName(Driver? driver) {
  final String fullName = (driver?.fullName ?? '').trim();
  if (fullName.isNotEmpty) return fullName;
  final String name = [driver?.firstName ?? '', driver?.lastName ?? '']
      .where((String value) => value.trim().isNotEmpty)
      .join(' ');
  return name.isEmpty ? 'Driver' : name;
}

String _driverStatus(Driver? driver) {
  if (driver?.isRestricted == true) return 'Restricted';
  final String profile = (driver?.profileRequestStatus ?? '').trim();
  if (profile == 'pending') return 'Pending profile review';
  if (profile == 'rejected') return 'Profile rejected';
  return _statusLabel(driver?.status ?? 'pending');
}

String _verificationLabel(Driver? driver) {
  if (driver?.isRestricted == true) return 'Restricted';
  if (driver?.status == 'completed' && driver?.isApproved == true) {
    return 'Verified';
  }
  if (driver?.profileRequestStatus == 'pending') return 'Pending review';
  if (driver?.profileRequestStatus == 'rejected' ||
      driver?.status == 'rejected') {
    return 'Rejected';
  }
  return 'Update required';
}

String _verificationMessage(Driver? driver) {
  if ((driver?.profileRejectionReason ?? '').trim().isNotEmpty) {
    return driver!.profileRejectionReason!.trim();
  }
  if ((driver?.rejectionReason ?? '').trim().isNotEmpty) {
    return driver!.rejectionReason!.trim();
  }
  if (driver?.profileRequestStatus == 'pending') {
    return 'Your latest profile and document changes are waiting for admin approval.';
  }
  if (driver?.status == 'completed' && driver?.isApproved == true) {
    return 'Your vehicle and driver profile are approved.';
  }
  return 'Complete the required profile and document steps before going online.';
}

String _vehicleSummary(Driver? driver) {
  final String category = (driver?.vehicleType ?? '').trim();
  final String model = (driver?.vehicleModel ?? '').trim();
  final String plate = (driver?.registration ?? '').trim();
  final String value = <String>[category, model, plate]
      .where((String item) => item.isNotEmpty)
      .join(' - ');
  return value.isEmpty ? 'Vehicle details and approval status' : value;
}

String _documentSummary(Driver? driver) {
  if (driver?.profileRequestStatus == 'pending') return 'Pending admin review';
  if (driver?.profileRequestStatus == 'rejected') return 'Action required';
  if (driver?.status == 'completed') return 'Verified profile documents';
  return 'Required documents and profile status';
}

String _pointsSummary(DriverPointsWallet? wallet) => wallet == null
    ? 'Balance and transactions'
    : '${wallet.availablePoints} balance available';

String _statusLabel(String value) =>
    value.replaceAll('_', ' ').split(' ').map((String part) {
      if (part.isEmpty) return part;
      return '${part[0].toUpperCase()}${part.substring(1)}';
    }).join(' ');

String _date(DateTime value) => DateFormat.yMMMd().add_Hm().format(value);

String _percent(double? value) =>
    value == null ? 'Not enough data' : '${(value * 100).round()}%';
