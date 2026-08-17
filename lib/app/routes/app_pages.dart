import 'package:get/get.dart';

import '../modules/documents/bindings/documents_binding.dart';
import '../modules/documents/views/documents_view.dart';
import '../modules/driver_account/bindings/driver_account_binding.dart';
import '../modules/driver_account/views/driver_account_views.dart';
import '../modules/driver_home/bindings/driver_home_binding.dart';
import '../modules/driver_home/views/driver_home_view.dart';
import '../modules/driver_register/bindings/driver_register_binding.dart';
import '../modules/driver_register/views/driver_complete_profile_view.dart';
import '../modules/driver_register/views/driver_register_view.dart';
import '../modules/login/bindings/login_binding.dart';
import '../modules/login/views/login_view.dart';
import '../modules/notification/bindings/notification_binding.dart';
import '../modules/notification/views/notification_view.dart';
import '../modules/otp/bindings/otp_binding.dart';
import '../modules/otp/views/otp_view.dart';
import '../modules/splash/bindings/splash_binding.dart';
import '../modules/splash/views/splash_view.dart';
import '../modules/support/bindings/support_binding.dart';
import '../modules/support/views/support_view.dart';
import '../modules/support_chat/bindings/support_chat_binding.dart';
import '../modules/support_chat/views/support_chat_view.dart';
import '../modules/user_home/bindings/user_home_binding.dart';
import '../modules/user_home/views/user_home_view.dart';
import '../modules/user_register/bindings/user_register_binding.dart';
import '../modules/user_register/views/user_register_view.dart';
import '../modules/user_type/bindings/user_type_binding.dart';
import '../modules/user_type/views/user_type_view.dart';
import '../modules/communication/controllers/call_state_controller.dart';
import '../modules/communication/views/ride_chat_screen.dart';
import '../modules/messages/bindings/messages_binding.dart';
import '../modules/messages/views/messages_view.dart';
import '../modules/points/bindings/driver_points_binding.dart';
import '../modules/points/views/buy_points_view.dart';
import '../modules/points/views/my_points_view.dart';
import '../modules/active_ride/bindings/active_ride_binding.dart';
import '../modules/active_ride/views/active_ride_view.dart';
import '../modules/passenger_account/bindings/passenger_account_binding.dart';
import '../modules/passenger_account/views/passenger_account_views.dart';
import '../modules/driver_profile/bindings/driver_profile_binding.dart';
import '../modules/driver_profile/views/driver_public_profile_view.dart';
import '../modules/driver_rankings/bindings/driver_rankings_binding.dart';
import '../modules/driver_rankings/views/driver_rankings_view.dart';

part 'app_routes.dart';

class AppPages {
  AppPages._();

  static const INITIAL = Routes.SPLASH;

  static final routes = [
    GetPage(
      name: _Paths.SPLASH,
      page: () => const SplashView(),
      binding: SplashBinding(),
    ),
    GetPage(
      name: _Paths.USER_TYPE,
      page: () => const UserTypeView(),
      binding: UserTypeBinding(),
    ),
    GetPage(
      name: _Paths.LOGIN,
      page: () => const LoginView(),
      binding: LoginBinding(),
    ),
    GetPage(
      name: _Paths.OTP,
      page: () => const OtpView(),
      binding: OtpBinding(),
    ),
    GetPage(
      name: _Paths.USER_REGISTER,
      page: () => const UserRegisterView(),
      binding: UserRegisterBinding(),
    ),
    GetPage(
      name: _Paths.DRIVER_REGISTER,
      page: () => const DriverRegisterView(),
      binding: DriverRegisterBinding(),
    ),
    GetPage(
      name: _Paths.DRIVER_COMPLETE_PROFILE,
      page: () => const DriverCompleteProfileView(),
      binding: DriverRegisterBinding(),
    ),
    GetPage(
      name: _Paths.DRIVER_HOME,
      page: () => const DriverHomeView(),
      binding: DriverHomeBinding(),
    ),
    GetPage(
      name: _Paths.DRIVER_PROFILE,
      page: () => const DriverProfileView(),
      binding: DriverAccountBinding(),
    ),
    GetPage(
      name: _Paths.DRIVER_EDIT_PROFILE,
      page: () => const DriverEditProfileView(),
      binding: DriverAccountBinding(),
    ),
    GetPage(
      name: _Paths.DRIVER_VEHICLE,
      page: () => const DriverVehicleView(),
      binding: DriverAccountBinding(),
    ),
    GetPage(
      name: _Paths.DRIVER_RIDE_HISTORY,
      page: () => const DriverRideHistoryView(),
      binding: DriverAccountBinding(),
    ),
    GetPage(
      name: _Paths.DRIVER_RIDE_DETAILS,
      page: () => const DriverRideDetailsView(),
      binding: DriverAccountBinding(),
    ),
    GetPage(
      name: _Paths.DRIVER_EARNINGS,
      page: () => const DriverEarningsView(),
      binding: DriverAccountBinding(),
    ),
    GetPage(
      name: _Paths.DRIVER_PERFORMANCE,
      page: () => const DriverPerformanceView(),
      binding: DriverAccountBinding(),
    ),
    GetPage(
      name: _Paths.DRIVER_SETTINGS,
      page: () => const DriverSettingsView(),
      binding: DriverAccountBinding(),
    ),
    GetPage(
      name: _Paths.DRIVER_LANGUAGE,
      page: () => const DriverLanguageView(),
      binding: DriverAccountBinding(),
    ),
    GetPage(
      name: _Paths.DRIVER_NOTIFICATION_PREFERENCES,
      page: () => const DriverNotificationPreferencesView(),
      binding: DriverAccountBinding(),
    ),
    GetPage(
      name: _Paths.DRIVER_LEGAL,
      page: () => const DriverLegalView(),
      binding: DriverAccountBinding(),
    ),
    GetPage(
      name: _Paths.DRIVER_SECURITY,
      page: () => const DriverSecurityView(),
      binding: DriverAccountBinding(),
    ),
    GetPage(
      name: _Paths.DRIVER_HELP_SUPPORT,
      page: () => const DriverHelpSupportView(),
      binding: DriverAccountBinding(),
    ),
    GetPage(
      name: _Paths.DRIVER_REPORT_PROBLEM,
      page: () => const DriverReportProblemView(),
      binding: DriverAccountBinding(),
    ),
    GetPage(
      name: _Paths.DRIVER_ABOUT,
      page: () => const DriverAboutView(),
      binding: DriverAccountBinding(),
    ),
    GetPage(
      name: _Paths.USER_HOME,
      page: () => const UserHomeView(),
      binding: UserHomeBinding(),
    ),
    GetPage(
      name: _Paths.SUPPORT,
      page: () => const SupportView(),
      binding: SupportBinding(),
    ),
    GetPage(
      name: _Paths.SUPPORT_CHAT,
      page: () => const SupportChatView(),
      binding: SupportChatBinding(),
    ),
    GetPage(
      name: _Paths.NOTIFICATIONS,
      page: () => const NotificationView(),
      binding: NotificationBinding(),
    ),
    GetPage(
      name: _Paths.DOCUMENTS,
      page: () => const DocumentsView(),
      binding: DocumentsBinding(),
    ),
    GetPage(
      name: _Paths.RIDE_CHAT,
      page: () => const RideChatScreen(),
      binding: CommunicationBinding(),
    ),
    GetPage(
      name: _Paths.MESSAGES,
      page: () => const MessagesView(),
      binding: MessagesBinding(),
    ),
    GetPage(
      name: _Paths.MY_POINTS,
      page: () => const MyPointsView(),
      binding: DriverPointsBinding(),
    ),
    GetPage(
      name: _Paths.BUY_POINTS,
      page: () => const BuyPointsView(),
      binding: DriverPointsBinding(),
    ),
    GetPage(
      name: _Paths.ACTIVE_RIDE,
      page: () => const ActiveRideView(),
      binding: ActiveRideBinding(),
    ),
    GetPage(
      name: _Paths.PASSENGER_PROFILE,
      page: () => const PassengerProfileView(),
      binding: PassengerAccountBinding(),
    ),
    GetPage(
      name: _Paths.EDIT_PROFILE,
      page: () => const EditProfileView(),
      binding: PassengerAccountBinding(),
    ),
    GetPage(
      name: _Paths.SAVED_PLACES,
      page: () => const SavedPlacesView(),
      binding: PassengerAccountBinding(),
    ),
    GetPage(
      name: _Paths.RIDE_HISTORY,
      page: () => const RideHistoryView(),
      binding: PassengerAccountBinding(),
    ),
    GetPage(
      name: _Paths.RIDE_DETAILS,
      page: () => const RideDetailsView(),
      binding: PassengerAccountBinding(),
    ),
    GetPage(
      name: _Paths.LANGUAGE_SETTINGS,
      page: () => const LanguageSettingsView(),
      binding: PassengerAccountBinding(),
    ),
    GetPage(
      name: _Paths.NOTIFICATION_PREFERENCES,
      page: () => const NotificationPreferencesView(),
      binding: PassengerAccountBinding(),
    ),
    GetPage(
      name: _Paths.LEGAL,
      page: () => const LegalView(),
      binding: PassengerAccountBinding(),
    ),
    GetPage(
      name: _Paths.HELP_SUPPORT,
      page: () => const HelpSupportView(),
      binding: PassengerAccountBinding(),
    ),
    GetPage(
      name: _Paths.REPORT_PROBLEM,
      page: () => const ReportProblemView(),
      binding: PassengerAccountBinding(),
    ),
    GetPage(
      name: _Paths.ABOUT_DREWEL,
      page: () => const AboutDrewelView(),
      binding: PassengerAccountBinding(),
    ),
    GetPage(
      name: _Paths.PUBLIC_DRIVER_PROFILE,
      page: () => const DriverPublicProfileView(),
      binding: DriverProfileBinding(),
    ),
    GetPage(
      name: _Paths.DRIVER_RANKINGS,
      page: () => const DriverRankingsView(),
      binding: DriverRankingsBinding(),
    ),
  ];
}
