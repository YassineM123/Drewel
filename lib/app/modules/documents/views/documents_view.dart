import 'dart:io';
import 'dart:typed_data';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:dotted_border/dotted_border.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:responsive_sizer/responsive_sizer.dart';

import '../../../../common/colors.dart';
import '../../../../common/common_widgets.dart';
import '../../../../common/drewel_app_bar.dart';
import '../../../../common/drewel_pop_scope.dart';
import '../../../../common/responsive_primary_button.dart';
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
          resizeToAvoidBottomInset: true,
          body: SafeArea(
            child: RefreshIndicator(
              onRefresh: controller.callingGetDriverDetails,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: EdgeInsets.fromLTRB(
                  20.px,
                  20.px,
                  20.px,
                  140.px + MediaQuery.of(context).viewInsets.bottom,
                ),
                child: Container(
                  width: double.infinity,
                  padding: EdgeInsets.fromLTRB(20.px, 24.px, 20.px, 24.px),
                  decoration: BoxDecoration(
                    color: primary3Color,
                    borderRadius: BorderRadius.only(
                      topRight: Radius.circular(40.px),
                      topLeft: Radius.circular(40.px),
                      bottomLeft: Radius.circular(24.px),
                      bottomRight: Radius.circular(24.px),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      if (controller.isLoadingDetails.value)
                        const LinearProgressIndicator(
                          color: primaryColor,
                          backgroundColor: Color(0xFFFFE7E9),
                        ),
                      if (controller.isLoadingDetails.value)
                        SizedBox(height: 16.px),
                      if (controller.loadError.value.isNotEmpty) ...<Widget>[
                        _NoticeCard(
                          color: Colors.red.shade50,
                          borderColor: Colors.red.shade300,
                          icon: Icons.error_outline_rounded,
                          text: controller.loadError.value,
                          textColor: Colors.red.shade900,
                          action: TextButton(
                            onPressed: controller.callingGetDriverDetails,
                            child: const Text('Retry'),
                          ),
                        ),
                        SizedBox(height: 12.px),
                      ],
                      if (controller
                          .missingRequiredDocuments.isNotEmpty) ...<Widget>[
                        _NoticeCard(
                          color: Colors.orange.shade50,
                          borderColor: Colors.orange.shade300,
                          icon: Icons.warning_amber_rounded,
                          text:
                              'Missing documents: ${controller.missingRequiredDocuments.join(', ')}',
                          textColor: Colors.orange.shade900,
                        ),
                        SizedBox(height: 12.px),
                      ],
                      if (controller.hasPendingApproval.value &&
                          controller.pendingApprovalMessage.value
                              .isNotEmpty) ...<Widget>[
                        _NoticeCard(
                          color: Colors.orange.shade50,
                          borderColor: Colors.orange.shade400,
                          icon: Icons.hourglass_top_rounded,
                          text: controller.pendingApprovalMessage.value,
                          textColor: Colors.orange.shade900,
                        ),
                        SizedBox(height: 18.px),
                      ],
                      if (!controller.isLoadingDetails.value &&
                          !controller.canEditProfile) ...<Widget>[
                        _NoticeCard(
                          color: Colors.red.shade50,
                          borderColor: Colors.red.shade300,
                          icon: Icons.lock_outline,
                          text: controller.profileLockMessage,
                          textColor: Colors.red.shade900,
                        ),
                        SizedBox(height: 14.px),
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
                        onTap: controller.canEditProfile
                            ? () => controller.openCityButtonSheet(context)
                            : null,
                      ),
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
                        onTap: controller.canEditProfile
                            ? () =>
                                controller.openvehicleTypeButtonSheet(context)
                            : null,
                      ),
                      SizedBox(height: 10.px),
                      Text('Upload Documents',
                          style: MyTextStyle.titleStyle16bb),
                      SizedBox(height: 10.px),
                      ListView.builder(
                        padding: EdgeInsets.zero,
                        itemCount: controller.selectedFile.length,
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemBuilder: (context, index) {
                          final Map<String, dynamic> docInfo =
                              controller.fileNameList[index];
                          final bool isBackImage = docInfo['isBack'] ?? false;
                          final bool isRequired =
                              controller.isBackRequired(index);
                          final String statusLabel =
                              controller.previewStateMessage(index);

                          return Padding(
                            padding: EdgeInsets.only(bottom: 15.px),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: <Widget>[
                                Wrap(
                                  crossAxisAlignment: WrapCrossAlignment.center,
                                  spacing: 6.px,
                                  runSpacing: 4.px,
                                  children: <Widget>[
                                    Text(
                                      docInfo['name'].toString(),
                                      style: MyTextStyle.titleStyle14b,
                                    ),
                                    if (isRequired)
                                      Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: <Widget>[
                                          Icon(
                                            Icons.warning_amber_rounded,
                                            color: Colors.orange,
                                            size: 16.px,
                                          ),
                                          SizedBox(width: 3.px),
                                          Text(
                                            'Required *',
                                            style: MyTextStyle.titleStyle12b
                                                .copyWith(
                                              color: Colors.orange,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                        ],
                                      ),
                                    _StatusChip(label: statusLabel),
                                  ],
                                ),
                                SizedBox(height: 6.px),
                                DottedBorder(
                                  color: isRequired
                                      ? (controller.selectedFile[index] ==
                                                  null &&
                                              controller
                                                  .documentUrl[index].isEmpty
                                          ? Colors.orange.withValues(alpha: 0.5)
                                          : Colors.green.withValues(alpha: 0.5))
                                      : Colors.black.withValues(alpha: 0.2),
                                  dashPattern: const <double>[6, 6],
                                  strokeWidth: 2,
                                  borderPadding: EdgeInsets.all(4.px),
                                  borderType: BorderType.RRect,
                                  radius: Radius.circular(10.px),
                                  child: ClipRRect(
                                    borderRadius: BorderRadius.circular(10.px),
                                    child: _DocumentPreview(
                                      documentUrl:
                                          controller.documentUrl[index],
                                      selectedBytes: controller
                                          .selectedPreviewBytes[index],
                                      localFile: controller.selectedFile[index],
                                      isBackImage: isBackImage,
                                      isRequired: isRequired,
                                    ),
                                  ),
                                ),
                                if (controller.canEditProfile) ...<Widget>[
                                  SizedBox(height: 8.px),
                                  Wrap(
                                    spacing: 8.px,
                                    runSpacing: 6.px,
                                    children: <Widget>[
                                      TextButton.icon(
                                        onPressed: () =>
                                            controller.showAlertDialog(index),
                                        icon: const Icon(
                                          Icons.drive_folder_upload_rounded,
                                        ),
                                        label: const Text('Replace'),
                                      ),
                                      if (controller.selectedFile[index] !=
                                          null)
                                        TextButton.icon(
                                          onPressed: () =>
                                              controller.clearSelectedDocument(
                                            index,
                                          ),
                                          icon: const Icon(
                                            Icons.remove_circle_outline,
                                          ),
                                          label: const Text('Remove'),
                                        ),
                                    ],
                                  ),
                                ],
                              ],
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          bottomNavigationBar: SafeArea(
            top: false,
            child: Padding(
              padding: EdgeInsets.fromLTRB(16.px, 8.px, 16.px, 12.px),
              child: ResponsivePrimaryButton(
                onPressed: controller.canSubmit
                    ? () => controller.clickOnSubmit(context)
                    : null,
                isLoading: controller.showLoading.value,
                backgroundColor:
                    controller.canSubmit ? primaryColor : Colors.grey.shade500,
                child: Text(
                  StringConstants.update,
                  style: MyTextStyle.titleStyle16bw,
                ),
                semanticLabel: StringConstants.update,
              ),
            ),
          ),
        ),
      );
    });
  }
}

class _NoticeCard extends StatelessWidget {
  const _NoticeCard({
    required this.color,
    required this.borderColor,
    required this.icon,
    required this.text,
    required this.textColor,
    this.action,
  });

  final Color color;
  final Color borderColor;
  final IconData icon;
  final String text;
  final Color textColor;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: EdgeInsets.all(12.px),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(10.px),
          border: Border.all(color: borderColor),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Icon(icon, color: textColor),
            SizedBox(width: 8.px),
            Expanded(
              child: Text(
                text,
                style: MyTextStyle.titleStyle12b.copyWith(color: textColor),
              ),
            ),
            if (action != null) action!,
          ],
        ),
      );
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) => Container(
        padding: EdgeInsets.symmetric(horizontal: 8.px, vertical: 3.px),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(20.px),
        ),
        child: Text(label, style: MyTextStyle.titleStyle10b),
      );
}

class _DocumentPreview extends StatelessWidget {
  const _DocumentPreview({
    required this.documentUrl,
    required this.selectedBytes,
    required this.localFile,
    required this.isBackImage,
    required this.isRequired,
  });

  final String documentUrl;
  final Uint8List? selectedBytes;
  final File? localFile;
  final bool isBackImage;
  final bool isRequired;

  bool get _isNetworkUrl {
    final Uri? uri = Uri.tryParse(documentUrl.trim());
    return uri != null &&
        uri.hasScheme &&
        (uri.scheme == 'http' || uri.scheme == 'https');
  }

  @override
  Widget build(BuildContext context) {
    if (selectedBytes != null) {
      return Stack(
        alignment: Alignment.center,
        children: <Widget>[
          Image.memory(
            selectedBytes!,
            height: 130.px,
            width: double.infinity,
            fit: BoxFit.cover,
          ),
          Positioned(
            top: 8.px,
            right: 8.px,
            child: _StatusChip(label: 'Ready'),
          ),
        ],
      );
    }

    if (localFile != null && !kIsWeb) {
      if (!localFile!.existsSync()) {
        return _DocumentErrorState(isRequired: isRequired);
      }
      return Image.file(
        localFile!,
        height: 130.px,
        width: double.infinity,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) =>
            _DocumentErrorState(isRequired: isRequired),
      );
    }

    if (documentUrl.trim().isNotEmpty && _isNetworkUrl) {
      return CachedNetworkImage(
        imageUrl: documentUrl,
        height: 130.px,
        width: double.infinity,
        fit: BoxFit.cover,
        placeholder: (context, url) => const SizedBox(
          height: 130,
          child: Center(child: CircularProgressIndicator()),
        ),
        errorWidget: (context, error, stackTrace) =>
            _DocumentErrorState(isRequired: isRequired),
      );
    }

    if (documentUrl.trim().isNotEmpty && !kIsWeb) {
      final File file = File(documentUrl);
      if (file.existsSync()) {
        return Image.file(
          file,
          height: 130.px,
          width: double.infinity,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) =>
              _DocumentErrorState(isRequired: isRequired),
        );
      }
    }

    return Container(
      height: 130.px,
      width: double.infinity,
      color: isBackImage
          ? Colors.orange.withValues(alpha: 0.05)
          : Colors.black.withValues(alpha: 0.03),
      alignment: Alignment.center,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: <Widget>[
          Icon(
            Icons.cloud_upload_outlined,
            size: 30.px,
            color: isBackImage ? Colors.orange : Colors.black54,
          ),
          SizedBox(height: 5.px),
          Text(
            StringConstants.uploadHere,
            style: MyTextStyle.titleStyle14b.copyWith(
              color: isBackImage ? Colors.orange : Colors.black54,
            ),
          ),
        ],
      ),
    );
  }
}

class _DocumentErrorState extends StatelessWidget {
  const _DocumentErrorState({required this.isRequired});

  final bool isRequired;

  @override
  Widget build(BuildContext context) {
    final Color color =
        isRequired ? Colors.orange.shade700 : Colors.red.shade700;
    return Container(
      height: 130.px,
      width: double.infinity,
      color: color.withValues(alpha: 0.06),
      alignment: Alignment.center,
      child: Text(
        'Preview unavailable - tap Replace',
        textAlign: TextAlign.center,
        style: MyTextStyle.titleStyle12b.copyWith(color: color),
      ),
    );
  }
}
