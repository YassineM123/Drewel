import 'dart:io';

import 'package:drewel/common/colors.dart';
import 'package:drewel/common/common_widgets.dart';
import 'package:drewel/common/text_styles.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:responsive_sizer/responsive_sizer.dart';

import '../../../data/apis/api_constants/api_key_constants.dart';
import '../../../data/constants/icons_constant.dart';
import '../../../data/constants/string_constants.dart';
import '../controllers/driver_register_controller.dart';

class DriverCompleteProfileView extends GetView<DriverRegisterController> {
  const DriverCompleteProfileView({super.key});

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      controller.refreshTick.value;
      final bool isLocked = controller.isProfileLocked;

      return Scaffold(
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
                    padding:
                        EdgeInsets.symmetric(horizontal: 18.px, vertical: 20.px),
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
                          if (isLocked) ...<Widget>[
                            Container(
                              width: double.infinity,
                              padding: EdgeInsets.all(12.px),
                              decoration: BoxDecoration(
                                color: Colors.orange.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(10.px),
                                border: Border.all(
                                  color: Colors.orange.withOpacity(0.5),
                                ),
                              ),
                              child: Row(
                                children: <Widget>[
                                  Icon(Icons.lock_outline,
                                      color: Colors.orange, size: 18.px),
                                  SizedBox(width: 8.px),
                                  Expanded(
                                    child: Text(
                                      'Waiting for admin approval',
                                      style: MyTextStyle.titleStyle14b,
                                    ),
                                  ),
                                  TextButton(
                                    onPressed: controller.openStatusModal,
                                    child: const Text('View Status'),
                                  ),
                                ],
                              ),
                            ),
                            SizedBox(height: 16.px),
                          ],
                          AbsorbPointer(
                            absorbing: isLocked,
                            child: Opacity(
                              opacity: isLocked ? 0.55 : 1,
                              child: _buildStep3Section(context),
                            ),
                          ),
                          SizedBox(height: 24.px),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
            if (controller.showStatusModal.value) _buildStatusOverlay(context),
          ],
        ),
      );
    });
  }

  Widget _buildStep3Section(BuildContext context) {
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
          Text('Step 3 - Complete Profile', style: MyTextStyle.titleStyle16bb),
          SizedBox(height: 8.px),
          Text('Personal Info', style: MyTextStyle.titleStyle14bb),
          CommonWidgets.commonTextFieldForLoginSignUP(
            labelText: 'First Name',
            hintText: 'First Name',
            controller: controller.firstNameController,
          ),
          CommonWidgets.commonTextFieldForLoginSignUP(
            labelText: 'Last Name',
            hintText: 'Last Name',
            controller: controller.lastNameController,
          ),
          CommonWidgets.commonTextFieldForLoginSignUP(
            labelText: 'Address',
            hintText: 'Address',
            controller: controller.addressController,
            focusNode: controller.addressFocus,
          ),
          SizedBox(height: 8.px),
          Text('Work / Contract Info', style: MyTextStyle.titleStyle14bb),
          CommonWidgets.commonTextFieldForLoginSignUP(
            labelText: 'Contract Number',
            hintText: 'Contract Number',
            controller: controller.contractNumberController,
            focusNode: controller.contractFocus,
          ),
          CommonWidgets.commonTextFieldForLoginSignUP(
            labelText: 'License Company',
            hintText: 'License Company',
            controller: controller.licenseCompanyController,
            focusNode: controller.licenseCompanyFocus,
          ),
          CommonWidgets.commonTextFieldForLoginSignUP(
            labelText: 'City (Optional)',
            hintText: 'City',
            controller: controller.cityController,
            focusNode: controller.cityFocus,
          ),
          CommonWidgets.commonTextFieldForLoginSignUP(
            labelText: 'Vehicle Type (Optional)',
            hintText: 'Vehicle Type',
            controller: controller.typeController,
            focusNode: controller.typeFocus,
          ),
          SizedBox(height: 8.px),
          Text('Documents', style: MyTextStyle.titleStyle14bb),
          SizedBox(height: 8.px),
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: controller.documentConfig.length,
            itemBuilder: (BuildContext context, int index) {
              final Map<String, String> config = controller.documentConfig[index];
              final File? file = controller.selectedFiles[index];
              final String existingUrl = controller.existingFileUrls[index];
              final bool hasExisting = existingUrl.trim().isNotEmpty;
              return Container(
                margin: EdgeInsets.only(bottom: 10.px),
                padding: EdgeInsets.all(10.px),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10.px),
                  border: Border.all(color: Colors.black.withOpacity(0.15)),
                ),
                child: Row(
                  children: <Widget>[
                    Expanded(
                      child: Text(
                        config['label'] ?? '',
                        style: MyTextStyle.titleStyle14b,
                      ),
                    ),
                    if (file != null)
                      Text(
                        'Selected',
                        style: MyTextStyle.titleStyle12b.copyWith(
                          color: Colors.green.shade700,
                        ),
                      )
                    else if (hasExisting)
                      Text(
                        'Uploaded',
                        style: MyTextStyle.titleStyle12b.copyWith(
                          color: Colors.green.shade700,
                        ),
                      )
                    else
                      Text(
                        'Required',
                        style: MyTextStyle.titleStyle12b.copyWith(
                          color: Colors.red.shade700,
                        ),
                      ),
                    SizedBox(width: 10.px),
                    TextButton(
                      onPressed: () => controller.pickDocument(index),
                      child: const Text('Upload'),
                    ),
                    if (file != null)
                      SizedBox(
                        width: 38.px,
                        height: 38.px,
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(6.px),
                          child: kIsWeb
                              ? Image.network(file.path, fit: BoxFit.cover)
                              : Image.file(file, fit: BoxFit.cover),
                        ),
                      ),
                  ],
                ),
              );
            },
          ),
          SizedBox(height: 8.px),
          CommonWidgets.commonElevatedButton(
            context: context,
            onPressed: controller.showSubmitLoading.value
                ? () {}
                : () => controller.submitCompleteProfile(),
            showLoading: controller.showSubmitLoading.value,
            child: Text(
              'Submit Documents',
              style: MyTextStyle.titleStyle16bw,
            ),
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
                padding: EdgeInsets.symmetric(horizontal: 12.px, vertical: 6.px),
                decoration: BoxDecoration(
                  color: primaryColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(20.px),
                  border: Border.all(color: primaryColor),
                ),
                child: Text(
                  badge == ApiKeyConstants.pending
                      ? 'Pending Approval'
                      : badge.toUpperCase(),
                  style: MyTextStyle.titleStyle12b.copyWith(color: primaryColor),
                ),
              ),
              SizedBox(height: 14.px),
              CommonWidgets.commonElevatedButton(
                context: context,
                onPressed: controller.closeStatusModal,
                child:
                    Text(StringConstants.close, style: MyTextStyle.titleStyle16bw),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
