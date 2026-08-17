import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';

import '../../../../common/colors.dart';
import '../../../../common/drewel_app_bar.dart';
import '../../../../common/text_styles.dart';
import '../../../data/apis/api_models/active_ride_model.dart';
import '../../../data/apis/api_models/passenger_account_models.dart';
import '../../../routes/app_pages.dart';
import '../controllers/passenger_account_controller.dart';

const Color _pageColor = Color(0xFFF6F7F9);
const Color _lineColor = Color(0xFFE7E8EC);
const double _radius = 8;

class PassengerProfileView extends GetView<PassengerAccountController> {
  const PassengerProfileView({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: const DrewelAppBar(title: 'Profile', showBackButton: true),
        backgroundColor: _pageColor,
        body: SafeArea(
          child: Obx(() {
            if (controller.loading.value && controller.profile.value == null) {
              return const Center(
                child: CircularProgressIndicator(color: primaryColor),
              );
            }
            if (controller.error.value.isNotEmpty &&
                controller.profile.value == null) {
              return _StateMessage(
                icon: Icons.wifi_off_rounded,
                title: 'Unable to load profile',
                message: controller.error.value,
                actionLabel: 'Retry',
                onAction: controller.refreshAll,
              );
            }
            final PassengerProfileModel? profile = controller.profile.value;
            return RefreshIndicator(
              onRefresh: controller.refreshAll,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
                children: <Widget>[
                  _IdentityHeader(profile: profile),
                  const SizedBox(height: 22),
                  _Section(
                    title: 'Personal',
                    children: <Widget>[
                      _MenuRow(
                        icon: Icons.person_outline_rounded,
                        title: 'Edit Profile',
                        subtitle: 'Photo, name, phone and email',
                        onTap: () => Get.toNamed(Routes.EDIT_PROFILE),
                      ),
                      _MenuRow(
                        icon: Icons.place_outlined,
                        title: 'Saved Places',
                        subtitle: 'Home, Work and favorites',
                        onTap: () => Get.toNamed(Routes.SAVED_PLACES),
                      ),
                      _MenuRow(
                        icon: Icons.history_rounded,
                        title: 'Ride History',
                        subtitle: 'Completed, cancelled and past rides',
                        onTap: () => Get.toNamed(Routes.RIDE_HISTORY),
                      ),
                      _MenuRow(
                        icon: Icons.local_taxi_outlined,
                        title: 'Current Ride',
                        subtitle: 'Recover your active ride from Drewel',
                        onTap: () => Get.toNamed(Routes.ACTIVE_RIDE),
                      ),
                      _MenuRow(
                        icon: Icons.leaderboard_rounded,
                        title: 'Top Drivers',
                        subtitle: 'View highest-rated drivers in your area',
                        onTap: () => Get.toNamed(Routes.DRIVER_RANKINGS),
                      ),
                    ],
                  ),
                  _Section(
                    title: 'Communication',
                    children: <Widget>[
                      _MenuRow(
                        icon: Icons.chat_bubble_outline_rounded,
                        title: 'Messages',
                        subtitle: 'Ride-linked conversations',
                        onTap: () => Get.toNamed(Routes.MESSAGES),
                      ),
                      _MenuRow(
                        icon: Icons.notifications_none_rounded,
                        title: 'Notifications',
                        subtitle: 'Ride, message and account updates',
                        onTap: () => Get.toNamed(Routes.NOTIFICATIONS),
                      ),
                    ],
                  ),
                  _Section(
                    title: 'Preferences',
                    children: <Widget>[
                      _MenuRow(
                        icon: Icons.language_rounded,
                        title: 'Language',
                        subtitle: 'English and Arabic',
                        onTap: () => Get.toNamed(Routes.LANGUAGE_SETTINGS),
                      ),
                      _MenuRow(
                        icon: Icons.tune_rounded,
                        title: 'Notification Preferences',
                        subtitle:
                            'Messages, account updates, sound and vibration',
                        onTap: () =>
                            Get.toNamed(Routes.NOTIFICATION_PREFERENCES),
                      ),
                    ],
                  ),
                  _Section(
                    title: 'Support',
                    children: <Widget>[
                      _MenuRow(
                        icon: Icons.support_agent_rounded,
                        title: 'Help & Support',
                        subtitle: 'Get help from Drewel support',
                        onTap: () => Get.toNamed(Routes.HELP_SUPPORT),
                      ),
                      _MenuRow(
                        icon: Icons.flag_outlined,
                        title: 'Report a Problem',
                        subtitle: 'Ride, driver, app or account issue',
                        onTap: () => Get.toNamed(Routes.REPORT_PROBLEM),
                      ),
                    ],
                  ),
                  _Section(
                    title: 'Legal',
                    children: <Widget>[
                      _MenuRow(
                        icon: Icons.privacy_tip_outlined,
                        title: 'Privacy',
                        subtitle: 'Location and communication privacy',
                        onTap: () => Get.toNamed(Routes.LEGAL,
                            parameters: {'type': 'privacy'}),
                      ),
                      _MenuRow(
                        icon: Icons.description_outlined,
                        title: 'Terms & Conditions',
                        subtitle: 'Current Drewel terms',
                        onTap: () => Get.toNamed(Routes.LEGAL,
                            parameters: {'type': 'terms'}),
                      ),
                      _MenuRow(
                        icon: Icons.info_outline_rounded,
                        title: 'About Drewel',
                        subtitle: 'Version, support and company information',
                        onTap: () => Get.toNamed(Routes.ABOUT_DREWEL),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: primaryColor,
                      minimumSize: const Size.fromHeight(50),
                      side: const BorderSide(color: primaryColor),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(_radius),
                      ),
                    ),
                    onPressed: controller.logout,
                    icon: const Icon(Icons.logout_rounded),
                    label: const Text('Logout'),
                  ),
                ],
              ),
            );
          }),
        ),
      );
}

class EditProfileView extends StatefulWidget {
  const EditProfileView({super.key});

  @override
  State<EditProfileView> createState() => _EditProfileViewState();
}

class _EditProfileViewState extends State<EditProfileView> {
  final PassengerAccountController controller =
      Get.find<PassengerAccountController>();
  late final TextEditingController name;
  late final TextEditingController phone;
  late final TextEditingController email;

  @override
  void initState() {
    super.initState();
    final PassengerProfileModel? profile = controller.profile.value;
    name = TextEditingController(text: profile?.fullName ?? '');
    phone = TextEditingController(text: profile?.phone ?? '');
    email = TextEditingController(text: profile?.email ?? '');
  }

  @override
  void dispose() {
    name.dispose();
    phone.dispose();
    email.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: const DrewelAppBar(title: 'Edit Profile', showBackButton: true),
        backgroundColor: _pageColor,
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: <Widget>[
              Obx(() {
                final PassengerProfileModel? profile = controller.profile.value;
                return Center(
                  child: Stack(
                    children: <Widget>[
                      _Avatar(url: profile?.profileImageUrl, radius: 48),
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
              _TextField(label: 'Full name', controller: name),
              _TextField(
                label: 'Phone',
                controller: phone,
                keyboardType: TextInputType.phone,
              ),
              _TextField(
                label: 'Email',
                controller: email,
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 8),
              const Text(
                'Phone changes are validated by the server. OTP verification must be reused when the backend requires it.',
                style: TextStyle(color: text2Color, fontSize: 13),
              ),
              const SizedBox(height: 24),
              Obx(
                () => FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: primaryColor,
                    minimumSize: const Size.fromHeight(52),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(_radius),
                    ),
                  ),
                  onPressed: controller.saving.value
                      ? null
                      : () => controller.saveProfile(
                            fullName: name.text,
                            phone: phone.text,
                            email: email.text,
                          ),
                  child: controller.saving.value
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Save'),
                ),
              ),
            ],
          ),
        ),
      );
}

class SavedPlacesView extends GetView<PassengerAccountController> {
  const SavedPlacesView({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: const DrewelAppBar(title: 'Saved Places', showBackButton: true),
        backgroundColor: _pageColor,
        floatingActionButton: FloatingActionButton(
          backgroundColor: primaryColor,
          foregroundColor: Colors.white,
          onPressed: () => _showPlaceSheet(context, type: 'favorite'),
          child: const Icon(Icons.add_rounded),
        ),
        body: Obx(() {
          final List<SavedPlaceModel> places = controller.savedPlaces;
          return RefreshIndicator(
            onRefresh: controller.refreshAll,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: <Widget>[
                _PlaceShortcut(
                  title: 'Home',
                  icon: Icons.home_outlined,
                  place: controller.placeByType('home'),
                  onTap: () => _showPlaceSheet(context, type: 'home'),
                ),
                _PlaceShortcut(
                  title: 'Work',
                  icon: Icons.work_outline_rounded,
                  place: controller.placeByType('work'),
                  onTap: () => _showPlaceSheet(context, type: 'work'),
                ),
                const SizedBox(height: 18),
                Text('Favorites', style: MyTextStyle.titleStyle16bb),
                const SizedBox(height: 8),
                ...places
                    .where((SavedPlaceModel place) => place.type == 'favorite')
                    .map((SavedPlaceModel place) => _PlaceTile(
                          place: place,
                          onTap: () => _showPlaceSheet(
                            context,
                            type: 'favorite',
                            place: place,
                          ),
                        )),
                if (!places.any((SavedPlaceModel p) => p.type == 'favorite'))
                  const _StateMessage(
                    icon: Icons.star_border_rounded,
                    title: 'No favorite places',
                    message: 'Add places you use often as destinations.',
                  ),
              ],
            ),
          );
        }),
      );

  void _showPlaceSheet(
    BuildContext context, {
    required String type,
    SavedPlaceModel? place,
  }) {
    final TextEditingController name = TextEditingController(
      text: place?.name ??
          (type == 'home'
              ? 'Home'
              : type == 'work'
                  ? 'Work'
                  : ''),
    );
    final TextEditingController address =
        TextEditingController(text: place?.address ?? '');
    final TextEditingController lat =
        TextEditingController(text: place == null ? '' : '${place.lat}');
    final TextEditingController long =
        TextEditingController(text: place == null ? '' : '${place.long}');
    Get.bottomSheet(
      SafeArea(
        child: Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(context).viewInsets.bottom + 20,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                _SheetHandle(),
                _TextField(label: 'Name', controller: name),
                _TextField(label: 'Address', controller: address),
                _TextField(
                  label: 'Latitude',
                  controller: lat,
                  keyboardType: TextInputType.number,
                ),
                _TextField(
                  label: 'Longitude',
                  controller: long,
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 12),
                Obx(
                  () => FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: primaryColor,
                      minimumSize: const Size.fromHeight(50),
                    ),
                    onPressed: controller.saving.value
                        ? null
                        : () async {
                            final bool saved = await controller.savePlace(
                              id: place?.id,
                              type: type,
                              name: name.text,
                              address: address.text,
                              lat: double.tryParse(lat.text) ?? double.nan,
                              long: double.tryParse(long.text) ?? double.nan,
                            );
                            if (saved) Get.back();
                          },
                    child: controller.saving.value
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Save place'),
                  ),
                ),
                if (place != null) ...<Widget>[
                  const SizedBox(height: 10),
                  Obx(
                    () => TextButton.icon(
                      onPressed: controller.saving.value
                          ? null
                          : () async {
                              final bool deleted =
                                  await controller.deletePlace(place.id);
                              if (deleted) Get.back();
                            },
                      icon: const Icon(Icons.delete_outline_rounded),
                      label: const Text('Delete place'),
                      style: TextButton.styleFrom(
                        foregroundColor: Colors.red,
                        minimumSize: const Size.fromHeight(48),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
      backgroundColor: Colors.white,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
    );
  }
}

class RideHistoryView extends GetView<PassengerAccountController> {
  const RideHistoryView({super.key});

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
                    message: 'Your completed and cancelled rides appear here.',
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
                        Routes.RIDE_DETAILS,
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

class RideDetailsView extends StatelessWidget {
  const RideDetailsView({super.key});

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
          _InfoBlock('Status', _statusLabel(ride.status)),
          _InfoBlock('Pickup', ride.pickup?.address ?? 'Not available'),
          _InfoBlock(
              'Destination', ride.destination?.address ?? 'Not available'),
          _InfoBlock('Driver', ride.driver?.firstName ?? 'Driver'),
          _InfoBlock('Vehicle', ride.vehicleType ?? 'Not available'),
          _InfoBlock(
              'Fare',
              ride.agreedPrice == null
                  ? 'Not available'
                  : '${ride.agreedPrice}'),
          _InfoBlock(
              'Updated',
              ride.updatedAt == null
                  ? 'Not available'
                  : _date(ride.updatedAt!)),
          const SizedBox(height: 16),
          FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: primaryColor),
            onPressed: () => Get.toNamed(Routes.REPORT_PROBLEM,
                parameters: {'rideId': ride.id}),
            icon: const Icon(Icons.flag_outlined),
            label: const Text('Report problem'),
          ),
          OutlinedButton.icon(
            onPressed: () => Get.toNamed(Routes.MESSAGES),
            icon: const Icon(Icons.chat_bubble_outline_rounded),
            label: const Text('View messages'),
          ),
        ],
      ),
    );
  }
}

class LanguageSettingsView extends GetView<PassengerAccountController> {
  const LanguageSettingsView({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: const DrewelAppBar(title: 'Language', showBackButton: true),
        backgroundColor: _pageColor,
        body: Obx(() {
          final String language = controller.preferences.value?.language ??
              Get.locale?.languageCode ??
              'en';
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
                selected: language == 'en',
                onTap: () => controller.updateLanguage('en'),
              ),
              _RadioRow(
                title: 'Arabic',
                selected: language == 'ar',
                onTap: () => controller.updateLanguage('ar'),
              ),
            ],
          );
        }),
      );
}

class NotificationPreferencesView extends GetView<PassengerAccountController> {
  const NotificationPreferencesView({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: const DrewelAppBar(
          title: 'Notification Preferences',
          showBackButton: true,
        ),
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
                message: 'Manage ride, message and account alerts.',
              ),
              const _SwitchRow(
                title: 'Ride updates',
                subtitle: 'Required for active ride safety',
                value: true,
                onChanged: null,
              ),
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

class LegalView extends GetView<PassengerAccountController> {
  const LegalView({super.key});

  @override
  Widget build(BuildContext context) {
    final String type = Get.parameters['type'] ?? 'privacy';
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (controller.legalContent.value == null ||
          controller.legalType.value != type) {
        controller.loadLegal(type);
      }
    });
    return Scaffold(
      appBar: DrewelAppBar(
        title: type == 'terms' ? 'Terms & Conditions' : 'Privacy',
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
                'The backend is ready to serve this page once official content is configured.',
          );
        }
        return ListView(
          padding: const EdgeInsets.all(16),
          children: <Widget>[
            Text(legal.title, style: MyTextStyle.titleStyle20bb),
            if (legal.lastUpdated?.isNotEmpty == true) ...<Widget>[
              const SizedBox(height: 4),
              Text('Last updated ${legal.lastUpdated}',
                  style: const TextStyle(color: text2Color)),
            ],
            const SizedBox(height: 20),
            Text(legal.body, style: const TextStyle(height: 1.5, fontSize: 15)),
          ],
        );
      }),
    );
  }
}

class HelpSupportView extends StatelessWidget {
  const HelpSupportView({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar:
            const DrewelAppBar(title: 'Help & Support', showBackButton: true),
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
              subtitle: 'Pickup, destination, fare or ride status',
              onTap: () => Get.toNamed(Routes.REPORT_PROBLEM,
                  parameters: {'category': 'ride'}),
            ),
            _MenuRow(
              icon: Icons.person_pin_outlined,
              title: 'Driver issue',
              subtitle: 'Driver behavior or vehicle concern',
              onTap: () => Get.toNamed(Routes.REPORT_PROBLEM,
                  parameters: {'category': 'driver'}),
            ),
            _MenuRow(
              icon: Icons.manage_accounts_outlined,
              title: 'Account issue',
              subtitle: 'Profile, login or contact information',
              onTap: () => Get.toNamed(Routes.REPORT_PROBLEM,
                  parameters: {'category': 'account'}),
            ),
            _MenuRow(
              icon: Icons.bug_report_outlined,
              title: 'Technical issue',
              subtitle: 'App, map, notification or connection problem',
              onTap: () => Get.toNamed(Routes.REPORT_PROBLEM,
                  parameters: {'category': 'app'}),
            ),
            _MenuRow(
              icon: Icons.support_agent_rounded,
              title: 'Contact Drewel Support',
              subtitle: 'Open a secure support chat',
              onTap: () => Get.toNamed(Routes.SUPPORT_CHAT),
            ),
          ],
        ),
      );
}

class ReportProblemView extends StatefulWidget {
  const ReportProblemView({super.key});

  @override
  State<ReportProblemView> createState() => _ReportProblemViewState();
}

class _ReportProblemViewState extends State<ReportProblemView> {
  final PassengerAccountController controller =
      Get.find<PassengerAccountController>();
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
              items: const <String>['ride', 'driver', 'app', 'account', 'other']
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
                    : const Text('Send report'),
              ),
            ),
          ],
        ),
      );
}

class AboutDrewelView extends GetView<PassengerAccountController> {
  const AboutDrewelView({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: const DrewelAppBar(title: 'About Drewel', showBackButton: true),
        backgroundColor: _pageColor,
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: <Widget>[
            _PageIntro(
              icon: Icons.local_taxi_rounded,
              title: 'Drewel',
              message:
                  'A mobility marketplace for secure ride communication and offers.',
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
              onTap: () =>
                  Get.toNamed(Routes.LEGAL, parameters: {'type': 'terms'}),
            ),
            _MenuRow(
              icon: Icons.privacy_tip_outlined,
              title: 'Privacy',
              onTap: () =>
                  Get.toNamed(Routes.LEGAL, parameters: {'type': 'privacy'}),
            ),
            _MenuRow(
              icon: Icons.support_agent_rounded,
              title: 'Support',
              onTap: () => Get.toNamed(Routes.HELP_SUPPORT),
            ),
          ],
        ),
      );
}

class _IdentityHeader extends StatelessWidget {
  const _IdentityHeader({required this.profile});

  final PassengerProfileModel? profile;

  @override
  Widget build(BuildContext context) {
    final String phone =
        '${profile?.countryCode ?? ''} ${profile?.phone ?? ''}'.trim();
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(_radius),
        border: Border.all(color: _lineColor),
      ),
      child: Row(
        children: <Widget>[
          _Avatar(url: profile?.profileImageUrl, radius: 36),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  profile?.fullName.trim().isNotEmpty == true
                      ? profile!.fullName
                      : 'Passenger',
                  style: MyTextStyle.titleStyle20bb,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Row(
                  children: <Widget>[
                    Expanded(
                      child: Text(
                        phone.isEmpty ? 'Phone not available' : phone,
                        style: const TextStyle(color: text2Color),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (profile?.isVerified == true)
                      const Icon(Icons.verified_rounded,
                          color: amberColor, size: 18),
                  ],
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Edit Profile',
            onPressed: () => Get.toNamed(Routes.EDIT_PROFILE),
            icon: const Icon(Icons.edit_outlined),
          ),
        ],
      ),
    );
  }
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
  const _MenuRow({
    required this.icon,
    required this.title,
    this.subtitle,
    required this.onTap,
  });

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

class _TextField extends StatelessWidget {
  const _TextField({
    required this.label,
    required this.controller,
    this.keyboardType,
  });

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

class _PlaceShortcut extends StatelessWidget {
  const _PlaceShortcut({
    required this.title,
    required this.icon,
    required this.place,
    required this.onTap,
  });

  final String title;
  final IconData icon;
  final SavedPlaceModel? place;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => _MenuRow(
        icon: icon,
        title: title,
        subtitle: place?.address ?? 'Add $title address',
        onTap: onTap,
      );
}

class _PlaceTile extends StatelessWidget {
  const _PlaceTile({required this.place, required this.onTap});

  final SavedPlaceModel place;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => _MenuRow(
        icon: Icons.star_border_rounded,
        title: place.name,
        subtitle: place.address,
        onTap: onTap,
      );
}

class _RideFilters extends StatelessWidget {
  const _RideFilters({required this.controller});

  final PassengerAccountController controller;

  @override
  Widget build(BuildContext context) => Obx(
        () => Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: SegmentedButton<String>(
            selected: <String>{controller.rideFilter.value},
            onSelectionChanged: (Set<String> value) =>
                controller.rideFilter.value = value.first,
            segments: const <ButtonSegment<String>>[
              ButtonSegment<String>(value: 'all', label: Text('All')),
              ButtonSegment<String>(
                  value: 'completed', label: Text('Completed')),
              ButtonSegment<String>(
                  value: 'cancelled', label: Text('Cancelled')),
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
            '${_statusLabel(ride.status)} - ${ride.driver?.firstName ?? 'Driver'}',
          ),
          trailing: Text(
            ride.agreedPrice == null ? '' : '${ride.agreedPrice}',
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
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

class _RadioRow extends StatelessWidget {
  const _RadioRow({
    required this.title,
    required this.selected,
    required this.onTap,
  });

  final String title;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => ListTile(
        onTap: onTap,
        title: Text(title),
        trailing: Icon(
          selected ? Icons.radio_button_checked : Icons.radio_button_unchecked,
          color: selected ? primaryColor : text2Color,
        ),
      );
}

class _SwitchRow extends StatelessWidget {
  const _SwitchRow({
    required this.title,
    this.subtitle,
    required this.value,
    required this.onChanged,
  });

  final String title;
  final String? subtitle;
  final bool value;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) => SwitchListTile(
        value: value,
        onChanged: onChanged,
        activeThumbColor: primaryColor,
        title: Text(title),
        subtitle: subtitle == null ? null : Text(subtitle!),
      );
}

class _StateMessage extends StatelessWidget {
  const _StateMessage({
    required this.icon,
    required this.title,
    required this.message,
    this.actionLabel,
    this.onAction,
  });

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
              Text(title, style: MyTextStyle.titleStyle16bb),
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

class _SheetHandle extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
        width: 44,
        height: 5,
        margin: const EdgeInsets.only(bottom: 18),
        decoration: BoxDecoration(
          color: const Color(0xFFE0E0E0),
          borderRadius: BorderRadius.circular(_radius),
        ),
      );
}

String _statusLabel(String value) =>
    value.replaceAll('_', ' ').split(' ').map((String part) {
      if (part.isEmpty) return part;
      return '${part[0].toUpperCase()}${part.substring(1)}';
    }).join(' ');

String _date(DateTime value) => DateFormat.yMMMd().add_Hm().format(value);
