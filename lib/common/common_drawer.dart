import 'package:drewel/app/data/apis/api_constants/api_key_constants.dart';
import 'package:drewel/app/data/apis/api_methods/api_methods.dart';
import 'package:drewel/app/data/constants/icons_constant.dart';
import 'package:drewel/app/data/constants/string_constants.dart';
import 'package:drewel/app/routes/app_pages.dart';
import 'package:drewel/common/colors.dart';
import 'package:drewel/common/common_widgets.dart';
import 'package:drewel/common/text_styles.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:responsive_sizer/responsive_sizer.dart';
import 'package:shared_preferences/shared_preferences.dart';

class CustomDrawer extends StatelessWidget {
  final Map<String, String> userData;
  const CustomDrawer({super.key, required this.userData});

  Future<void> _navigate(BuildContext context, String route) async {
    Navigator.of(context).pop();
    if (Get.currentRoute != route) {
      await Get.toNamed(route);
    }
  }

  void _showDeleteConfirmationDialog(BuildContext context) {
    showDialog(
      context: context,
      barrierColor: Colors.black.withOpacity(0.6),
      builder: (BuildContext context) {
        return AlertDialog(
          surfaceTintColor: Colors.white,
          backgroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12.px),
          ),
          title: Center(
            child: Text(
              "Delete Account",
              style: MyTextStyle.titleStyle20bb,
            ),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.warning_amber_rounded,
                color: Colors.red,
                size: 50.px,
              ),
              SizedBox(height: 10.px),
              Text(
                "Are you sure you want to delete your account? This action cannot be undone.",
                style: MyTextStyle.titleStyle14b,
                textAlign: TextAlign.center,
              ),
            ],
          ),
          actions: [
            Row(
              children: [
                Expanded(
                  child: CommonWidgets.commonElevatedButton(
                    onPressed: () {
                      Get.back();
                    },
                    context: context,
                    child: Text(
                      "Cancel",
                      style: MyTextStyle.titleStyle14b,
                    ),
                    decoration: BoxDecoration(
                      border: Border.all(color: primaryColor, width: 1),
                      borderRadius: BorderRadius.circular(10.px),
                    ),
                  ),
                ),
                SizedBox(width: 10.px),
                Expanded(
                  child: CommonWidgets.commonElevatedButton(
                    onPressed: () async {
                      Get.back(); // Close dialog
                      await _deleteAccount(context);
                    },
                    context: context,
                    child: Text(
                      "Delete",
                      style: MyTextStyle.titleStyle14b
                          .copyWith(color: Colors.white),
                    ),
                    buttonColor: Colors.red,
                  ),
                ),
              ],
            ),
          ],
        );
      },
    );
  }

  Future<void> _deleteAccount(BuildContext context) async {
    try {
      // Show loading
      Get.dialog(
        const Center(
          child: CircularProgressIndicator(color: primaryColor),
        ),
        barrierDismissible: false,
      );

      SharedPreferences prefs = await SharedPreferences.getInstance();
      String? userId = prefs.getString(ApiKeyConstants.userId);
      String? userType = userData[ApiKeyConstants.type];

      if (userId == null || userId.isEmpty) {
        Get.back(); // Close loading
        CommonWidgets.snackBarView(title: 'User ID not found');
        return;
      }

      bool success = false;

      if (userType == ApiKeyConstants.driver) {
        // Delete driver account
        var response =
            await ApiMethods.deleteDriverAccountApi(driverId: userId);
        success = response?.success ?? false;
      } else {
        // Delete user account
        var response = await ApiMethods.deleteUserAccountApi(userId: userId);
        success = response?.success ?? false;
      }

      Get.back(); // Close loading

      if (success) {
        // Clear preferences and navigate to user type screen
        await prefs.clear();
        CommonWidgets.snackBarView(
            title: 'Account deleted successfully', success: true);
        Get.offNamedUntil(Routes.USER_TYPE, (routes) => false);
      } else {
        CommonWidgets.snackBarView(title: 'Failed to delete account');
      }
    } catch (e) {
      Get.back(); // Close loading if open
      CommonWidgets.snackBarView(title: 'Something went wrong');
      print('Delete account error: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Drawer(
      child: SafeArea(
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: 20.px),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // const DrawerHeader(
              //   decoration: BoxDecoration(color: Colors.blue),
              //   child: Text(
              //     'Right Drawer Header',
              //     style: TextStyle(color: Colors.white, fontSize: 24),
              //   ),
              // ),
              SizedBox(
                height: 48,
                width: 48,
                child: IconButton(
                  tooltip: 'Close menu',
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded),
                ),
              ),
              Row(
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${userData[ApiKeyConstants.fullName]}',
                        style: MyTextStyle.titleStyle16bb,
                      ),
                      Text(
                        '${userData[ApiKeyConstants.countryCode]} ${userData[ApiKeyConstants.phone]}',
                        style: MyTextStyle.titleStyle14b,
                      ),
                    ],
                  ),
                  SizedBox(
                    width: 10.px,
                  ),
                  CommonWidgets.imageView(
                      image: userData[ApiKeyConstants.profileImage] ??
                          StringConstants.defaultNetworkImage,
                      height: 48.px,
                      width: 48.px,
                      borderRadius: BorderRadius.circular(24.px),
                      defaultNetworkImage: StringConstants.defaultNetworkImage)
                ],
              ),
              const Divider(
                color: Colors.grey,
              ),
              ListTile(
                selected: Get.currentRoute == Routes.SUPPORT_CHAT,
                selectedTileColor: primaryColor.withOpacity(0.10),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10.px),
                ),
                contentPadding: EdgeInsets.zero,
                leading: CommonWidgets.appIcons(
                    assetName: IconConstants.icSupport,
                    height: 20.px,
                    width: 20.px),
                title: Text(
                  StringConstants.support,
                  style: MyTextStyle.titleStyle16b,
                ),
                onTap: () {
                  _navigate(context, Routes.SUPPORT_CHAT);
                },
              ),
              if (userData[ApiKeyConstants.type] == ApiKeyConstants.driver)
                ListTile(
                  selected: Get.currentRoute == Routes.DOCUMENTS,
                  selectedTileColor: primaryColor.withOpacity(0.10),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10.px),
                  ),
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(
                    Icons.file_copy_outlined,
                    size: 25.px,
                    color: primaryColor,
                  ),
                  title: Text(
                    StringConstants.documents,
                    style: MyTextStyle.titleStyle16b,
                  ),
                  onTap: () {
                    _navigate(context, Routes.DOCUMENTS);
                  },
                ),
              const Spacer(),
              CommonWidgets.commonElevatedButton(
                  onPressed: () {
                    _showDeleteConfirmationDialog(context);
                  },
                  context: context,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.delete_forever,
                        size: 25,
                        color: Colors.red,
                      ),
                      SizedBox(
                        width: 5.px,
                      ),
                      Text(
                        StringConstants.deleteAccount,
                        style: MyTextStyle.titleStyle16bb,
                      ),
                    ],
                  ),
                  decoration: BoxDecoration(
                      border: Border.all(color: primaryColor, width: 1),
                      borderRadius: BorderRadius.circular(10.px)),
                  buttonMargin: EdgeInsets.symmetric(vertical: 20.px)),
              CommonWidgets.commonElevatedButton(
                  onPressed: () async {
                    SharedPreferences prefs =
                        await SharedPreferences.getInstance();
                    prefs.clear();
                    Get.offNamedUntil(Routes.USER_TYPE, (routes) => false);
                  },
                  context: context,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.logout,
                        size: 25,
                        color: primary3Color,
                      ),
                      SizedBox(
                        width: 5.px,
                      ),
                      Text(
                        StringConstants.logout,
                        style: MyTextStyle.titleStyle16bw,
                      ),
                    ],
                  )),
              SizedBox(
                height: 50.px,
              )
            ],
          ),
        ),
      ),
    );
  }
}
