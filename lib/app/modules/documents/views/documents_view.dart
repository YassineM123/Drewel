import 'dart:io';

import 'package:dotted_border/dotted_border.dart';
import 'package:flutter/material.dart';

import 'package:get/get.dart';
import 'package:responsive_sizer/responsive_sizer.dart';

import '../../../../common/colors.dart';
import '../../../../common/common_widgets.dart';
import '../../../../common/drewel_app_bar.dart';
import '../../../../common/drewel_pop_scope.dart';
import '../../../../common/text_styles.dart';
import '../../../data/constants/string_constants.dart';
import '../controllers/documents_controller.dart';

class DocumentsView extends GetView<DocumentsController> {
  const DocumentsView({super.key});
  @override
  Widget build(BuildContext context) {
    return Obx(() {
      controller.count.value;
      return DrewelPopScope(
        fallbackRoute: '/driver-home',
        hasUnsavedChanges: controller.hasUnsavedChanges,
        child: Scaffold(
            appBar: const DrewelAppBar(
              title: '',
              showBackButton: true,
              fallbackRoute: '/driver-home',
            ),
            backgroundColor: primaryColor,
            resizeToAvoidBottomInset: false,
            floatingActionButtonLocation:
                FloatingActionButtonLocation.centerDocked,
            floatingActionButton: CommonWidgets.commonElevatedButton(
                onPressed: () {
                  controller.clickOnSubmit(context);
                },
                context: context,
                child: Text(
                  StringConstants.update,
                  style: MyTextStyle.titleStyle16bw,
                ),
                buttonMargin: EdgeInsets.symmetric(horizontal: 15.px),
                showLoading: controller.showLoading.value),
            body: Column(
              mainAxisAlignment: MainAxisAlignment.end,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Container(
                    width: MediaQuery.of(context).size.width,
                    padding: EdgeInsets.symmetric(
                        horizontal: 20.px, vertical: 40.px),
                    decoration: BoxDecoration(
                        color: primary3Color,
                        borderRadius: BorderRadius.only(
                            topRight: Radius.circular(40.px),
                            topLeft: Radius.circular(40.px))),
                    child: SingleChildScrollView(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Pending approval banner (very prominent, at top)
                          if (controller.hasPendingApproval.value &&
                              controller
                                  .pendingApprovalMessage.value.isNotEmpty) ...[
                            Container(
                              width: double.infinity,
                              padding: EdgeInsets.symmetric(
                                  horizontal: 14.px, vertical: 14.px),
                              margin: EdgeInsets.only(bottom: 18.px),
                              decoration: BoxDecoration(
                                color: Colors.orange.shade50,
                                borderRadius: BorderRadius.circular(12.px),
                                border: Border.all(
                                    color: Colors.orange.shade400, width: 1.5),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.orange.withOpacity(0.25),
                                    blurRadius: 8,
                                    offset: const Offset(0, 3),
                                  ),
                                ],
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Icon(
                                    Icons.warning_amber_rounded,
                                    color: Colors.orange.shade700,
                                    size: 24.px,
                                  ),
                                  SizedBox(width: 10.px),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          'Pending Admin Approval',
                                          style: MyTextStyle.titleStyle14b
                                              .copyWith(
                                            color: Colors.orange.shade900,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                        SizedBox(height: 4.px),
                                        Text(
                                          controller
                                              .pendingApprovalMessage.value,
                                          style: MyTextStyle.titleStyle12b
                                              .copyWith(
                                            color: Colors.orange.shade900,
                                          ),
                                        ),
                                        if (controller.pendingApprovalItems
                                            .isNotEmpty) ...[
                                          SizedBox(height: 8.px),
                                          Wrap(
                                            spacing: 6.px,
                                            runSpacing: 4.px,
                                            children: controller
                                                .pendingApprovalItems
                                                .map(
                                                  (item) => Container(
                                                    padding:
                                                        EdgeInsets.symmetric(
                                                      horizontal: 8.px,
                                                      vertical: 4.px,
                                                    ),
                                                    decoration: BoxDecoration(
                                                      color: Colors
                                                          .orange.shade100,
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                              20.px),
                                                    ),
                                                    child: Text(
                                                      item,
                                                      style: MyTextStyle
                                                          .titleStyle10b
                                                          .copyWith(
                                                        color: Colors
                                                            .orange.shade900,
                                                      ),
                                                    ),
                                                  ),
                                                )
                                                .toList(),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],

                          CommonWidgets.commonTextFieldForLoginSignUP(
                              focusNode: controller.focusNodeCity,
                              controller: controller.cityController,
                              isCard: controller.isCity.value,
                              hintText: StringConstants.selectCity,
                              labelText: StringConstants.selectCity,
                              suffixIcon: Icon(
                                Icons.keyboard_arrow_down,
                                size: 20.px,
                                color: Colors.black54,
                              ),
                              readOnly: true,
                              onTap: () {
                                controller.openCityButtonSheet(context);
                              }),
                          CommonWidgets.commonTextFieldForLoginSignUP(
                              focusNode: controller.focusNodeType,
                              controller: controller.typeController,
                              isCard: controller.isType.value,
                              hintText: StringConstants.selectvehicleType,
                              labelText: StringConstants.selectvehicleType,
                              suffixIcon: Icon(
                                Icons.keyboard_arrow_down,
                                size: 20.px,
                                color: Colors.black54,
                              ),
                              readOnly: true,
                              onTap: () {
                                controller.openvehicleTypeButtonSheet(context);
                              }),

                          SizedBox(
                            height: 10.px,
                          ),
                          Text('Upload Documents',
                              style: MyTextStyle.titleStyle16bb),
                          SizedBox(
                            height: 10.px,
                          ),
                          ListView.builder(
                              padding: EdgeInsets.zero,
                              itemCount: controller.selectedFile.length,
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              itemBuilder: (context, index) {
                                final docInfo = controller.fileNameList[index];
                                final bool requiresBack =
                                    docInfo['requiresBack'] ?? false;
                                final bool isBackImage =
                                    docInfo['isBack'] ?? false;

                                return GestureDetector(
                                  onTap: () {
                                    controller.showAlertDialog(index);
                                  },
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Text(
                                            docInfo['name'],
                                            style: MyTextStyle.titleStyle14b,
                                          ),
                                          if (requiresBack) ...[
                                            SizedBox(width: 5.px),
                                            Text(
                                              StringConstants.backRequired,
                                              style: MyTextStyle.titleStyle12b
                                                  .copyWith(
                                                color: primaryColor,
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                          ],
                                          if (isBackImage) ...[
                                            SizedBox(width: 5.px),
                                            Icon(
                                              Icons.warning_amber_rounded,
                                              color: Colors.orange,
                                              size: 16.px,
                                            ),
                                            SizedBox(width: 3.px),
                                            Text(
                                              'Required',
                                              style: MyTextStyle.titleStyle12b
                                                  .copyWith(
                                                color: Colors.orange,
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                      SizedBox(
                                        height: 5.px,
                                      ),
                                      DottedBorder(
                                        color: isBackImage
                                            ? (controller.selectedFile[index] ==
                                                        null &&
                                                    controller
                                                        .documentUrl[index]
                                                        .isEmpty
                                                ? Colors.orange.withOpacity(0.5)
                                                : Colors.green.withOpacity(0.5))
                                            : Colors.black.withOpacity(0.2),
                                        dashPattern: const [6, 6],
                                        strokeWidth: 2,
                                        borderPadding: EdgeInsets.all(4.px),
                                        borderType: BorderType.RRect,
                                        radius: Radius.circular(10.px),
                                        child: ClipRRect(
                                          borderRadius:
                                              BorderRadius.circular(10.px),
                                          child: Stack(
                                            alignment: Alignment.center,
                                            children: [
                                              controller.selectedFile[index] !=
                                                      null
                                                  ? Image.file(
                                                      height: 100.px,
                                                      width:
                                                          MediaQuery.of(context)
                                                              .size
                                                              .width,
                                                      fit: BoxFit.fill,
                                                      File(
                                                        controller
                                                            .selectedFile[
                                                                index]!
                                                            .path
                                                            .toString(),
                                                      ),
                                                    )
                                                  : SizedBox(
                                                      height: 100.px,
                                                      width:
                                                          MediaQuery.of(context)
                                                              .size
                                                              .width,
                                                      child: controller
                                                              .documentUrl[
                                                                  index]
                                                              .isNotEmpty
                                                          ? CommonWidgets
                                                              .imageView(
                                                              image: controller
                                                                      .documentUrl[
                                                                  index],
                                                              height: 100.px,
                                                              width:
                                                                  MediaQuery.of(
                                                                          context)
                                                                      .size
                                                                      .width,
                                                            )
                                                          : Container(
                                                              color: isBackImage
                                                                  ? Colors
                                                                      .orange
                                                                      .withOpacity(
                                                                          0.05)
                                                                  : null,
                                                            ),
                                                    ),
                                              if (controller.selectedFile[
                                                          index] ==
                                                      null &&
                                                  controller.documentUrl[index]
                                                      .isEmpty)
                                                Column(
                                                  mainAxisAlignment:
                                                      MainAxisAlignment.center,
                                                  children: [
                                                    Icon(
                                                      Icons
                                                          .cloud_upload_outlined,
                                                      size: 30.px,
                                                      color: isBackImage
                                                          ? Colors.orange
                                                          : Colors.black54,
                                                    ),
                                                    SizedBox(height: 5.px),
                                                    Text(
                                                      StringConstants
                                                          .uploadHere,
                                                      style: MyTextStyle
                                                          .titleStyle14b
                                                          .copyWith(
                                                        color: isBackImage
                                                            ? Colors.orange
                                                            : Colors.black54,
                                                      ),
                                                    ),
                                                  ],
                                                )
                                              else if (controller.selectedFile[
                                                          index] !=
                                                      null ||
                                                  controller.documentUrl[index]
                                                      .isNotEmpty)
                                                Positioned(
                                                  top: 5.px,
                                                  right: 5.px,
                                                  child: Container(
                                                    padding:
                                                        EdgeInsets.all(4.px),
                                                    decoration:
                                                        const BoxDecoration(
                                                      color: Colors.green,
                                                      shape: BoxShape.circle,
                                                    ),
                                                    child: Icon(
                                                      Icons.check,
                                                      color: Colors.white,
                                                      size: 16.px,
                                                    ),
                                                  ),
                                                ),
                                            ],
                                          ),
                                        ),
                                      ),
                                      SizedBox(
                                        height: 15.px,
                                      ),
                                    ],
                                  ),
                                );
                              }),

                          SizedBox(
                            height: 50.px,
                          )
                        ],
                      ),
                    ),
                  ),
                )
              ],
            )),
      );
    });
  }
}
