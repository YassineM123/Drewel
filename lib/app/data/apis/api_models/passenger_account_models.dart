import 'active_ride_model.dart';

class PassengerProfileModel {
  const PassengerProfileModel({
    required this.id,
    required this.fullName,
    required this.countryCode,
    required this.phone,
    required this.email,
    required this.profileImageUrl,
    required this.isVerified,
  });

  final String id;
  final String fullName;
  final String countryCode;
  final String phone;
  final String email;
  final String profileImageUrl;
  final bool isVerified;

  factory PassengerProfileModel.fromJson(Map<String, dynamic> json) =>
      PassengerProfileModel(
        id: '${json['_id'] ?? json['id'] ?? ''}',
        fullName: '${json['fullName'] ?? ''}',
        countryCode: '${json['countryCode'] ?? ''}',
        phone: '${json['phone'] ?? ''}',
        email: '${json['email'] ?? ''}',
        profileImageUrl:
            '${json['profilePicture'] ?? json['profileImageUrl'] ?? ''}',
        isVerified: json['isVerified'] == true,
      );

  Map<String, dynamic> toJson() => <String, dynamic>{
        '_id': id,
        'fullName': fullName,
        'countryCode': countryCode,
        'phone': phone,
        'email': email,
        'profilePicture': profileImageUrl,
        'isVerified': isVerified,
      };
}

class SavedPlaceModel {
  const SavedPlaceModel({
    required this.id,
    required this.type,
    required this.name,
    required this.address,
    required this.lat,
    required this.long,
    required this.category,
  });

  final String id;
  final String type;
  final String name;
  final String address;
  final double lat;
  final double long;
  final String category;

  factory SavedPlaceModel.fromJson(Map<String, dynamic> json) =>
      SavedPlaceModel(
        id: '${json['id'] ?? json['_id'] ?? ''}',
        type: '${json['type'] ?? 'favorite'}',
        name: '${json['name'] ?? ''}',
        address: '${json['address'] ?? ''}',
        lat: (json['lat'] as num?)?.toDouble() ?? 0,
        long: (json['long'] as num?)?.toDouble() ?? 0,
        category: '${json['category'] ?? ''}',
      );
}

class NotificationPreferenceModel {
  const NotificationPreferenceModel({
    required this.rideUpdates,
    required this.messages,
    required this.accountUpdates,
    required this.sounds,
    required this.vibration,
  });

  final bool rideUpdates;
  final bool messages;
  final bool accountUpdates;
  final bool sounds;
  final bool vibration;

  factory NotificationPreferenceModel.fromJson(Map<String, dynamic> json) =>
      NotificationPreferenceModel(
        rideUpdates: json['rideUpdates'] != false,
        messages: json['messages'] != false,
        accountUpdates: json['accountUpdates'] != false,
        sounds: json['sounds'] != false,
        vibration: json['vibration'] != false,
      );

  Map<String, dynamic> toJson() => <String, dynamic>{
        'rideUpdates': rideUpdates,
        'messages': messages,
        'accountUpdates': accountUpdates,
        'sounds': sounds,
        'vibration': vibration,
      };

  NotificationPreferenceModel copyWith({
    bool? rideUpdates,
    bool? messages,
    bool? accountUpdates,
    bool? sounds,
    bool? vibration,
  }) =>
      NotificationPreferenceModel(
        rideUpdates: rideUpdates ?? this.rideUpdates,
        messages: messages ?? this.messages,
        accountUpdates: accountUpdates ?? this.accountUpdates,
        sounds: sounds ?? this.sounds,
        vibration: vibration ?? this.vibration,
      );
}

class PassengerPreferenceModel {
  const PassengerPreferenceModel({
    required this.language,
    required this.notifications,
  });

  final String language;
  final NotificationPreferenceModel notifications;

  factory PassengerPreferenceModel.fromJson(Map<String, dynamic> json) =>
      PassengerPreferenceModel(
        language: '${json['language'] ?? 'en'}',
        notifications: NotificationPreferenceModel.fromJson(
          Map<String, dynamic>.from(
              json['notifications'] as Map? ?? const <String, dynamic>{}),
        ),
      );
}

class LegalContentModel {
  const LegalContentModel({
    required this.title,
    required this.body,
    this.lastUpdated,
  });

  final String title;
  final String body;
  final String? lastUpdated;

  factory LegalContentModel.fromJson(Map<String, dynamic> json) =>
      LegalContentModel(
        title: '${json['title'] ?? ''}',
        body: '${json['body'] ?? ''}',
        lastUpdated: json['lastUpdated']?.toString(),
      );

  factory LegalContentModel.fallback(String type, {String language = 'en'}) {
    final String normalised = type.trim().toLowerCase();
    final bool isArabic = language.trim().toLowerCase().startsWith('ar');
    if (normalised == 'privacy') {
      return const LegalContentModel(
        title: 'Privacy',
        lastUpdated: null,
        body:
            'Drewel uses account, contact, location, ride, communication, and device data to provide the transport marketplace safely.\n\n'
            'Location data supports pickup, destination, driver discovery, route, safety, and support workflows. Secure ride chat is used for Drewel ride coordination and support.\n\n'
            'Drewel limits access to personal data to authorized operations, support, security, and administration workflows. Contact support if you need help with account data or privacy questions.',
      );
    }
    if (normalised == 'driver-terms') {
      if (isArabic) {
        return const LegalContentModel(
          title: 'شروط وأحكام السائق',
          lastUpdated: null,
          body: '1. التسجيل والوثائق\n'
              'يجب على السائق تقديم معلومات صحيحة ووثائق سارية، بما في ذلك الهوية الإماراتية، رخصة القيادة، وأي تصاريح أو مستندات مطلوبة لتقديم الخدمة وفقاً للقوانين المعمول بها في دولة الإمارات العربية المتحدة.\n\n'
              'يحق لـ Drewel طلب تحديث أو التحقق من الوثائق والمعلومات المقدمة في أي وقت.\n\n'
              '2. طبيعة منصة Drewel\n'
              'تعمل Drewel كمنصة إلكترونية تربط بين المستخدمين والسائقين المستقلين لتسهيل طلب خدمات القيادة. ولا تعتبر Drewel جهة توظيف للسائق، ولا تنشئ هذه الشروط علاقة عمل أو شراكة بين Drewel والسائق.\n\n'
              'يقدم السائق الخدمة بصفته مستقلاً، ويتحمل مسؤولية الالتزام بالقوانين والأنظمة المعمول بها في دولة الإمارات العربية المتحدة.\n\n'
              '3. مسؤوليات السائق\n'
              'يلتزم السائق بقوانين المرور والسلامة في دولة الإمارات، والمحافظة على سلامته وسلامة المستخدم، واستخدام مركبة المستخدم بعناية ومسؤولية أثناء تقديم الخدمة.\n\n'
              'كما يلتزم السائق بالوصول إلى موقع المستخدم في الوقت المناسب قدر الإمكان، وتنفيذ الخدمة المتفق عليها باحترافية واحترام، وعدم استخدام المركبة لأي غرض خارج نطاق الخدمة المطلوبة.\n\n'
              '4. قبول الطلبات\n'
              'يمكن للسائق قبول أو رفض طلبات الخدمة.\n\n'
              'بعد قبول الطلب، يجب على السائق تنفيذ الخدمة أو إبلاغ المستخدم وDrewel في أقرب وقت ممكن في حال تعذر تنفيذها.\n\n'
              '5. الدفع\n'
              'يتم دفع قيمة الخدمة مباشرة من المستخدم إلى السائق وفقاً للسعر المتفق عليه أو السعر الظاهر في التطبيق.\n\n'
              'ولا يجوز للسائق طلب مبالغ إضافية غير معتمدة من المستخدم.\n\n'
              'وفي حال تطبيق أي رسوم منصة أو عمولة لصالح Drewel، يتم توضيحها للسائق وفق الآلية المعتمدة في التطبيق.\n\n'
              '6. التعامل مع المستخدم\n'
              'يجب على السائق التعامل مع المستخدم باحترام ومهنية، ويمنع التهديد أو التحرش أو الإساءة أو أي سلوك غير لائق.\n\n'
              'كما يمنع استخدام أو مشاركة بيانات المستخدم لأي غرض خارج تقديم الخدمة.\n\n'
              '7. السلامة والحوادث\n'
              'يمنع على السائق القيادة تحت تأثير الكحول أو المخدرات أو أي مادة قد تؤثر على قدرته على القيادة بأمان.\n\n'
              'في حال وقوع حادث أثناء تقديم الخدمة، يجب على السائق التأكد من السلامة وإبلاغ الجهات المختصة وDrewel عند الحاجة.\n\n'
              'يتم تحديد المسؤولية عن أي حادث أو ضرر وفق القوانين المعمول بها في دولة الإمارات العربية المتحدة وبناءً على ظروف الواقعة والتقارير الرسمية.\n\n'
              '8. المركبة والممتلكات والمسؤولية\n'
              'تتم خدمة القيادة باستخدام مركبة المستخدم، ويتحمل المستخدم مسؤولية صلاحية المركبة وتسجيلها وتأمينها وفق القوانين المعمول بها.\n\n'
              'لا تتحمل Drewel مسؤولية فقدان أو تلف أو سرقة أو ضياع أي ممتلكات أو أغراض شخصية للمستخدم أثناء أو بعد تقديم الخدمة، ولا تكون Drewel طرفاً في أي مطالبة أو نزاع يتعلق بهذه الممتلكات، وذلك وفقاً للقوانين المعمول بها في دولة الإمارات العربية المتحدة.\n\n'
              'كما يتحمل السائق مسؤولية أي ضرر ناتج عن إهماله أو سوء استخدامه للمركبة أثناء تقديم الخدمة.\n\n'
              '9. تعليق الحساب\n'
              'يحق لـ Drewel تعليق أو إلغاء حساب السائق في حال تقديم معلومات أو وثائق غير صحيحة، أو الاحتيال، أو إساءة استخدام التطبيق، أو مخالفة الشروط، أو السلوك غير القانوني، أو تعريض الآخرين للخطر.\n\n'
              '10. استخدام التطبيق والبيانات\n'
              'يمنع التلاعب بالطلبات أو الأسعار، أو إنشاء حسابات وهمية، أو محاولة اختراق التطبيق، أو الوصول إلى بيانات الآخرين دون تصريح.\n\n'
              'ويتم استخدام بيانات السائق والمستخدم وفقاً لسياسة الخصوصية والقوانين المعمول بها في دولة الإمارات العربية المتحدة.\n\n'
              '11. تعديل الشروط والأحكام\n'
              'تحتفظ Drewel بحق تعديل أو تحديث هذه الشروط والأحكام عند الحاجة، ويتم إشعار السائق بأي تغييرات جوهرية عبر التطبيق أو الوسائل المعتمدة.\n\n'
              '12. القانون والموافقة\n'
              'تخضع هذه الشروط للقوانين والأنظمة المعمول بها في دولة الإمارات العربية المتحدة.\n\n'
              'بالضغط على "أوافق على الشروط والأحكام" أو استخدام تطبيق Drewel، يؤكد السائق أنه قرأ وفهم ووافق على هذه الشروط والأحكام.',
        );
      }
      return const LegalContentModel(
        title: 'Drewel - Driver Terms and Conditions',
        lastUpdated: null,
        body: '1. Registration and Documentation\n'
            'The driver must provide accurate information and valid documents, including a valid Emirates ID, driving license, and any permits or documents required to provide the service in accordance with the applicable laws of the United Arab Emirates.\n\n'
            'Drewel reserves the right to request the driver to update or verify the documents and information provided at any time.\n\n'
            '2. Nature of the Drewel Platform\n'
            'Drewel operates as an electronic platform connecting users with independent drivers to facilitate the booking of driving services. Drewel is not the driver\'s employer, and these Terms and Conditions do not create an employment, partnership, or agency relationship between Drewel and the driver.\n\n'
            'The driver provides the service independently and is responsible for complying with all applicable laws and regulations of the United Arab Emirates.\n\n'
            '3. Driver Responsibilities\n'
            'The driver must comply with all traffic and safety laws and regulations in the United Arab Emirates, maintain their own safety and the safety of the user, and use the user\'s vehicle carefully and responsibly while providing the service.\n\n'
            'The driver must also arrive at the user\'s location on time whenever reasonably possible, provide the agreed service professionally and respectfully, and must not use the vehicle for any purpose outside the scope of the requested service.\n\n'
            '4. Accepting Requests\n'
            'The driver may accept or decline service requests.\n\n'
            'After accepting a request, the driver must complete the service or notify the user and Drewel as soon as possible if they are unable to do so.\n\n'
            '5. Payment\n'
            'The service fee shall be paid directly by the user to the driver according to the agreed price or the price displayed in the application.\n\n'
            'The driver may not request any additional amount from the user that has not been authorized or approved.\n\n'
            'If any platform fee or commission is applicable in favor of Drewel, it will be communicated to the driver in accordance with the mechanism adopted by the application.\n\n'
            '6. Interaction with Users\n'
            'The driver must treat users with respect and professionalism. Threatening, harassing, abusive, or inappropriate behavior is strictly prohibited.\n\n'
            'The driver must not use or share the user\'s personal information for any purpose other than providing the requested service.\n\n'
            '7. Safety and Accidents\n'
            'The driver is strictly prohibited from driving under the influence of alcohol, drugs, or any substance that may impair their ability to drive safely.\n\n'
            'In the event of an accident while providing the service, the driver must ensure safety, notify the relevant authorities, and inform Drewel when required.\n\n'
            'Liability for any accident or damage shall be determined in accordance with the applicable laws of the United Arab Emirates and based on the circumstances of the incident and the relevant official reports.\n\n'
            '8. Vehicle, Personal Belongings and Liability\n'
            'The driving service is provided using the user\'s vehicle. The user is responsible for ensuring that the vehicle is legally registered, roadworthy, and properly insured in accordance with the applicable laws.\n\n'
            'Drewel shall not be liable for any loss, damage, theft, or disappearance of any personal belongings or property of the user during or after the provision of the service, and Drewel shall not be a party to any claim or dispute relating to such property, to the extent permitted by the applicable laws of the United Arab Emirates.\n\n'
            'The driver shall be responsible for any damage resulting from their negligence, misconduct, or improper use of the vehicle while providing the service.\n\n'
            '9. Account Suspension\n'
            'Drewel reserves the right to suspend or terminate the driver\'s account in cases including, but not limited to, providing false information or documents, fraud, misuse of the application, violation of these Terms and Conditions, unlawful conduct, or conduct that places others at risk.\n\n'
            '10. Application Use and Data\n'
            'Manipulating requests or prices, creating fake accounts, attempting to hack or compromise the application, or accessing other users\' data without authorization is prohibited.\n\n'
            'Driver and user data shall be processed and used in accordance with Drewel\'s Privacy Policy and the applicable laws and regulations of the United Arab Emirates.\n\n'
            '11. Amendments to the Terms and Conditions\n'
            'Drewel reserves the right to amend or update these Terms and Conditions when necessary. Drivers will be notified of any material changes through the application or other approved communication methods.\n\n'
            '12. Governing Law and Acceptance\n'
            'These Terms and Conditions shall be governed by and interpreted in accordance with the applicable laws and regulations of the United Arab Emirates.\n\n'
            'By clicking "I Agree to the Terms and Conditions" or by using the Drewel application, the driver confirms that they have read, understood, and agreed to these Terms and Conditions.',
      );
    }
    return const LegalContentModel(
      title: 'Drewel - Driver Terms and Conditions',
      lastUpdated: null,
      body: '1. Registration and Documentation\n'
          'The driver must provide accurate information and valid documents, including a valid Emirates ID, driving license, and any permits or documents required to provide the service in accordance with the applicable laws of the United Arab Emirates.\n\n'
          'Drewel reserves the right to request the driver to update or verify the documents and information provided at any time.\n\n'
          '2. Nature of the Drewel Platform\n'
          'Drewel operates as an electronic platform connecting users with independent drivers to facilitate the booking of driving services. Drewel is not the driver\'s employer, and these Terms and Conditions do not create an employment, partnership, or agency relationship between Drewel and the driver.\n\n'
          'The driver provides the service independently and is responsible for complying with all applicable laws and regulations of the United Arab Emirates.\n\n'
          '3. Driver Responsibilities\n'
          'The driver must comply with all traffic and safety laws and regulations in the United Arab Emirates, maintain their own safety and the safety of the user, and use the user\'s vehicle carefully and responsibly while providing the service.\n\n'
          'The driver must also arrive at the user\'s location on time whenever reasonably possible, provide the agreed service professionally and respectfully, and must not use the vehicle for any purpose outside the scope of the requested service.\n\n'
          '4. Accepting Requests\n'
          'The driver may accept or decline service requests.\n\n'
          'After accepting a request, the driver must complete the service or notify the user and Drewel as soon as possible if they are unable to do so.\n\n'
          '5. Payment\n'
          'The service fee shall be paid directly by the user to the driver according to the agreed price or the price displayed in the application.\n\n'
          'The driver may not request any additional amount from the user that has not been authorized or approved.\n\n'
          'If any platform fee or commission is applicable in favor of Drewel, it will be communicated to the driver in accordance with the mechanism adopted by the application.\n\n'
          '6. Interaction with Users\n'
          'The driver must treat users with respect and professionalism. Threatening, harassing, abusive, or inappropriate behavior is strictly prohibited.\n\n'
          'The driver must not use or share the user\'s personal information for any purpose other than providing the requested service.\n\n'
          '7. Safety and Accidents\n'
          'The driver is strictly prohibited from driving under the influence of alcohol, drugs, or any substance that may impair their ability to drive safely.\n\n'
          'In the event of an accident while providing the service, the driver must ensure safety, notify the relevant authorities, and inform Drewel when required.\n\n'
          'Liability for any accident or damage shall be determined in accordance with the applicable laws of the United Arab Emirates and based on the circumstances of the incident and the relevant official reports.\n\n'
          '8. Vehicle, Personal Belongings and Liability\n'
          'The driving service is provided using the user\'s vehicle. The user is responsible for ensuring that the vehicle is legally registered, roadworthy, and properly insured in accordance with the applicable laws.\n\n'
          'Drewel shall not be liable for any loss, damage, theft, or disappearance of any personal belongings or property of the user during or after the provision of the service, and Drewel shall not be a party to any claim or dispute relating to such property, to the extent permitted by the applicable laws of the United Arab Emirates.\n\n'
          'The driver shall be responsible for any damage resulting from their negligence, misconduct, or improper use of the vehicle while providing the service.\n\n'
          '9. Account Suspension\n'
          'Drewel reserves the right to suspend or terminate the driver\'s account in cases including, but not limited to, providing false information or documents, fraud, misuse of the application, violation of these Terms and Conditions, unlawful conduct, or conduct that places others at risk.\n\n'
          '10. Application Use and Data\n'
          'Manipulating requests or prices, creating fake accounts, attempting to hack or compromise the application, or accessing other users\' data without authorization is prohibited.\n\n'
          'Driver and user data shall be processed and used in accordance with Drewel\'s Privacy Policy and the applicable laws and regulations of the United Arab Emirates.\n\n'
          '11. Amendments to the Terms and Conditions\n'
          'Drewel reserves the right to amend or update these Terms and Conditions when necessary. Drivers will be notified of any material changes through the application or other approved communication methods.\n\n'
          '12. Governing Law and Acceptance\n'
          'These Terms and Conditions shall be governed by and interpreted in accordance with the applicable laws and regulations of the United Arab Emirates.\n\n'
          'By clicking "I Agree to the Terms and Conditions" or by using the Drewel application, the driver confirms that they have read, understood, and agreed to these Terms and Conditions.',
    );
  }
}

class RideHistoryFilter {
  static const String all = 'all';
  static const String active = 'active';
  static const String completed = 'completed';
  static const String cancelled = 'cancelled';

  static bool matches(ActiveRideModel ride, String filter) {
    if (filter == all) return true;
    if (filter == active) return !ride.rideStatus.isTerminal;
    if (filter == completed) return ride.status == 'completed';
    if (filter == cancelled) return ride.status.startsWith('cancelled');
    return true;
  }
}
