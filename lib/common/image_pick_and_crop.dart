import 'dart:io';

import 'package:drewel/common/common_widgets.dart';
import 'package:drewel/common/text_styles.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:image_picker/image_picker.dart';

import '../app/data/constants/string_constants.dart';
import 'common_pickImage.dart';

class ImagePickerAndCropper {
  String string = "";
  static List<File> convertXFilesToFiles({required List<XFile> xFiles}) {
    List<File> files = xFiles.map((xFile) => File(xFile.path)).toList();
    return files;
  }

  static Future<File?> pickImage({
    bool pickImageFromGallery = false,
    bool wantCropper = false,
    required BuildContext context,
    Color color = Colors.blue,
  }) async {
    XFile? imagePicker;
    await showDialog(
      context: context,
      barrierDismissible: true,
      builder: (BuildContext context) {
        return MyAlertDialog(
          actions: [
            // CupertinoDialogAction(
            //   isDefaultAction: true,
            //   child: Text(
            //     StringConstants.camera,
            //     style: MyTextStyle.titleStyle12gr,
            //   ),
            //   onPressed: () async {
            //     pickImageFromGallery = false;
            //     try {
            //       imagePicker =
            //           await ImagePicker().pickImage(source: ImageSource.camera);
            //     } catch (e) {
            //       //handle error
            //       print('e:::::::::::::${e}');
            //     }
            //     Get.back();
            //   },
            // ),
            CupertinoDialogAction(
              isDefaultAction: true,
              child: Text(
                StringConstants.gallery,
                style: MyTextStyle.titleStyle12gr,
              ),
              onPressed: () async {
                pickImageFromGallery = true;
                try {
                  enableAndroidPhotoPickerIfAvailable();
                  imagePicker = await ImagePicker()
                      .pickImage(
                    source: ImageSource.gallery,
                    requestFullMetadata: false,
                  );
                } catch (e) {
                  //handle error
                  print('e:::::::::::::$e');
                }
                Get.back();
              },
            ),
          ],
          title: Text(StringConstants.selectImage,
              style: MyTextStyle.titleStyle18bb),
          content: Text('Document image size should be below 5 MB',
            //StringConstants.chooseImageFromTheOptionsBelow,
            style: MyTextStyle.titleStyle14bb,
          ),
        );
      },
    );

    if (imagePicker != null) {
      final XFile selectedXFile = imagePicker!;
      final File pickedFile = File(selectedXFile.path);
      if (wantCropper) {
        if (kIsWeb) {
          final int bytes = await selectedXFile.length();
          final double sizeInMb = bytes / (1024 * 1024);
          if (sizeInMb > 5.0) {
            CommonWidgets.snackBarView(
                title: "Image size should be less than 5 MB");
            return null;
          }
          return pickedFile;
        }

        CroppedFile? cropImage = await ImageCropper().cropImage(
          sourcePath: selectedXFile.path,
          uiSettings: [
            AndroidUiSettings(
              toolbarColor: color,
              toolbarTitle: "Cropper",
              toolbarWidgetColor: Colors.white,
              statusBarColor: color,
              backgroundColor: Colors.black,
              activeControlsWidgetColor: color,
              initAspectRatio: CropAspectRatioPreset.original,
              lockAspectRatio: false,
              hideBottomControls: false,
              showCropGrid: true,
              cropFrameColor: color,
              cropGridColor: Colors.white54,
              aspectRatioPresets: [
                CropAspectRatioPreset.square,
                CropAspectRatioPreset.ratio3x2,
                CropAspectRatioPreset.original,
                CropAspectRatioPreset.ratio4x3,
                CropAspectRatioPreset.ratio16x9,
              ],
            ),
            IOSUiSettings(
              title: "Cropper",
              aspectRatioPresets: [
                CropAspectRatioPreset.square,
                CropAspectRatioPreset.ratio3x2,
                CropAspectRatioPreset.original,
                CropAspectRatioPreset.ratio4x3,
                CropAspectRatioPreset.ratio16x9,
              ],
              aspectRatioLockEnabled: false,
              resetButtonHidden: false,
              rotateButtonsHidden: false,
              rotateClockwiseButtonHidden: true,
              hidesNavigationBar: false,
              resetAspectRatioEnabled: true,
              doneButtonTitle: 'Done',
              cancelButtonTitle: 'Cancel',
            ),
          ],
          compressQuality: 85,
        );
        if (cropImage != null) {
          // return File(cropImage.path);
          final file = File(cropImage.path);
          final bytes = await file.length();
          final sizeInMb = bytes / (1024 * 1024);
          print('Image size: ${sizeInMb.toStringAsFixed(2)} MB');
          if (sizeInMb > 5.0) {
            CommonWidgets.snackBarView(title: "Image size should be less than 5 MB");
            return null;
          } else {
            return file;
          }
        } else {
          // If cropper is dismissed/fails, keep the original picked file.
          final int bytes = await pickedFile.length();
          final double sizeInMb = bytes / (1024 * 1024);
          if (sizeInMb > 5.0) {
            CommonWidgets.snackBarView(
                title: "Image size should be less than 5 MB");
            return null;
          }
          return pickedFile;
        }
      } else {
        final int bytes = await pickedFile.length();
        final double sizeInMb = bytes / (1024 * 1024);
        if (sizeInMb > 5.0) {
          CommonWidgets.snackBarView(
              title: "Image size should be less than 5 MB");
          return null;
        }
        return pickedFile;
      }
    } else {
      return null;
    }
  }

  static Future<List<XFile>> pickMultipleImages() async {
    enableAndroidPhotoPickerIfAvailable();
    final ImagePicker imagePicker = ImagePicker();
    List<XFile> imageFileList = [];

    final List<XFile> selectedImages = await imagePicker.pickMultiImage(
      requestFullMetadata: false,
    );
    if (selectedImages.isNotEmpty) {
      imageFileList.addAll(selectedImages);
      if (kDebugMode) {
        print("Selected Image List Length:${imageFileList.length}");
      }
      return imageFileList;
    } else {
      return [];
    }
  }
}
