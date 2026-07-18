import 'package:get/get.dart';

import '../modules/documents/bindings/documents_binding.dart';
import '../modules/documents/views/documents_view.dart';
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
  ];
}
