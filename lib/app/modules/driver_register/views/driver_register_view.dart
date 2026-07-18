import 'package:drewel/common/colors.dart';
import 'package:drewel/common/common_widgets.dart';
import 'package:drewel/common/drewel_app_bar.dart';
import 'package:drewel/common/drewel_pop_scope.dart';
import 'package:drewel/common/text_styles.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:responsive_sizer/responsive_sizer.dart';

import '../../../data/apis/api_constants/api_key_constants.dart';
import '../../../data/constants/string_constants.dart';
import '../../../data/constants/icons_constant.dart';
import '../controllers/driver_register_controller.dart';

class DriverRegisterView extends GetView<DriverRegisterController> {
  const DriverRegisterView({super.key});

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      controller.refreshTick.value;

      return DrewelPopScope(
        fallbackRoute: '/user-type',
        hasUnsavedChanges: controller.hasUnsavedChanges,
        child: Scaffold(
          appBar: const DrewelAppBar(
            title: '',
            showBackButton: true,
            fallbackRoute: '/user-type',
          ),
          backgroundColor: primaryColor,
          body: Stack(
            children: <Widget>[
              Column(
                children: <Widget>[
                  SizedBox(height: 50.px),
                  CommonWidgets.appIcons(
                    assetName: IconConstants.icLogo,
                    height: 90.px,
                    width: 200.px,
                    fit: BoxFit.contain,
                  ),
                  Expanded(
                    child: Container(
                      width: double.infinity,
                      margin: EdgeInsets.only(top: 20.px),
                      padding: EdgeInsets.symmetric(
                          horizontal: 18.px, vertical: 20.px),
                      decoration: BoxDecoration(
                        color: primary3Color,
                        borderRadius: BorderRadius.only(
                          topLeft: Radius.circular(30.px),
                          topRight: Radius.circular(30.px),
                        ),
                      ),
                      child: SingleChildScrollView(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            _buildStep1Section(context),
                            SizedBox(height: 16.px),
                            _buildStatusBanner(context),
                            SizedBox(height: 24.px),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              if (controller.showStatusModal.value)
                _buildStatusOverlay(context),
            ],
          ),
        ),
      );
    });
  }

  Widget _buildStep1Section(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(14.px),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12.px),
        border: Border.all(color: primaryColor.withOpacity(0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text('Step 1 - Basic Request', style: MyTextStyle.titleStyle16bb),
          SizedBox(height: 10.px),
          CommonWidgets.commonTextFieldForLoginSignUP(
            labelText: 'First Name / Prenom',
            hintText: 'First Name',
            controller: controller.firstNameController,
            focusNode: controller.firstNameFocus,
          ),
          CommonWidgets.commonTextFieldForLoginSignUP(
            labelText: 'Last Name / Nom',
            hintText: 'Last Name',
            controller: controller.lastNameController,
            focusNode: controller.lastNameFocus,
          ),
          CommonWidgets.commonTextFieldForLoginSignUP(
            labelText: 'WhatsApp Number',
            hintText: 'WhatsApp Number',
            controller: controller.whatsappController,
            focusNode: controller.whatsappFocus,
          ),
          SizedBox(height: 8.px),
          CommonWidgets.commonElevatedButton(
            context: context,
            onPressed: controller.showBasicLoading.value
                ? () {}
                : () => controller.submitBasicRequest(),
            showLoading: controller.showBasicLoading.value,
            child: Text(
              'Send Request',
              style: MyTextStyle.titleStyle16bw,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBanner(BuildContext context) {
    final String status = controller.driverStatus.value;
    if (status.isEmpty && !controller.hasSubmittedRequest.value) {
      return const SizedBox.shrink();
    }

    Color badgeColor = Colors.orange;
    if (status == ApiKeyConstants.approvedStatus) badgeColor = Colors.green;
    if (status == ApiKeyConstants.rejected) badgeColor = Colors.red;
    if (status == ApiKeyConstants.completed) badgeColor = Colors.green.shade700;

    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(12.px),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10.px),
        border: Border.all(color: primaryColor.withOpacity(0.2)),
      ),
      child: Row(
        children: <Widget>[
          Text('Current Status:', style: MyTextStyle.titleStyle14b),
          SizedBox(width: 8.px),
          Container(
            padding: EdgeInsets.symmetric(horizontal: 10.px, vertical: 5.px),
            decoration: BoxDecoration(
              color: badgeColor.withOpacity(0.12),
              borderRadius: BorderRadius.circular(20.px),
              border: Border.all(color: badgeColor),
            ),
            child: Text(
              status.isEmpty ? ApiKeyConstants.pending : status.toUpperCase(),
              style: MyTextStyle.titleStyle12b.copyWith(color: badgeColor),
            ),
          ),
          const Spacer(),
          TextButton(
            onPressed: controller.openStatusModal,
            child: const Text('Details'),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusOverlay(BuildContext context) {
    final String badge = controller.driverStatus.value.isEmpty
        ? ApiKeyConstants.pending
        : controller.driverStatus.value;
    return Positioned.fill(
      child: Container(
        color: Colors.black.withOpacity(0.5),
        alignment: Alignment.center,
        child: Container(
          width: MediaQuery.of(context).size.width * 0.86,
          padding: EdgeInsets.all(18.px),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14.px),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Text(controller.statusTitle, style: MyTextStyle.titleStyle18bb),
              SizedBox(height: 12.px),
              Text(
                controller.statusMessage,
                style: MyTextStyle.titleStyle14b,
                textAlign: TextAlign.center,
              ),
              SizedBox(height: 12.px),
              Container(
                padding:
                    EdgeInsets.symmetric(horizontal: 12.px, vertical: 6.px),
                decoration: BoxDecoration(
                  color: primaryColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(20.px),
                  border: Border.all(color: primaryColor),
                ),
                child: Text(
                  badge == ApiKeyConstants.pending
                      ? 'Pending Approval'
                      : badge.toUpperCase(),
                  style:
                      MyTextStyle.titleStyle12b.copyWith(color: primaryColor),
                ),
              ),
              SizedBox(height: 14.px),
              CommonWidgets.commonElevatedButton(
                context: context,
                onPressed: controller.closeStatusModal,
                child: Text(StringConstants.close,
                    style: MyTextStyle.titleStyle16bw),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
