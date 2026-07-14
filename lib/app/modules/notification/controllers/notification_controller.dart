import 'package:drewel/app/data/constants/icons_constant.dart';
import 'package:get/get.dart';

class NotificationController extends GetxController {
  List<Map<String,String>> notificationList=[
    {
      'image':IconConstants.icInvite,
      'title':'System',
      'subtitle':'Invite friends - Get 3 coupons each!',
    },
    {
      'image':IconConstants.icPayment,
      'title':'System',
      'subtitle':'Thank you! Your transaction is com...',
    },
    {
      'image':IconConstants.icBooking,
      'title':'System',
      'subtitle':'Your booking #1234 has been suc...',
    },
    {
      'image':IconConstants.icInvite,
      'title':'System',
      'subtitle':'Invite friends - Get 3 coupons each!',
    },
    {
      'image':IconConstants.icPayment,
      'title':'System',
      'subtitle':'Thank you! Your transaction is com...',
    },
    {
      'image':IconConstants.icBooking,
      'title':'System',
      'subtitle':'Your booking #1234 has been suc...',
    }, {
      'image':IconConstants.icInvite,
      'title':'System',
      'subtitle':'Invite friends - Get 3 coupons each!',
    },
    {
      'image':IconConstants.icPayment,
      'title':'System',
      'subtitle':'Thank you! Your transaction is com...',
    },
    {
      'image':IconConstants.icBooking,
      'title':'System',
      'subtitle':'Your booking #1234 has been suc...',
    }
  ];

  final count = 0.obs;



  void increment() => count.value++;
}
