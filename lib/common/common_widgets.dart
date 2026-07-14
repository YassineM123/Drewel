import 'dart:convert';
import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:country_code_picker/country_code_picker.dart';
import 'package:drewel/common/responsive_size.dart';
import 'package:drewel/common/text_styles.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:fluttertoast/fluttertoast.dart';
import 'package:get/get.dart';
import 'package:http/http.dart' as http;
import 'package:pin_code_fields/pin_code_fields.dart';
import 'package:responsive_sizer/responsive_sizer.dart';

import 'package:shimmer/shimmer.dart';
import 'package:simple_gradient_text/simple_gradient_text.dart';

import '../app/data/apis/api_constants/api_key_constants.dart';
import '../app/data/constants/icons_constant.dart';
import '../app/data/constants/image_constants.dart';
import '../app/data/constants/string_constants.dart';
import 'colors.dart';

class CommonWidgets {
  static appBar(
      {String? title,
      bool wantBackButton = true,
      bool centerTitle = true,
      bool showColorBackButton = false,
      List<Widget>? actions}) {
    return AppBar(
      elevation: 0,
      shadowColor: primary3Color,
      surfaceTintColor: primary3Color,
      foregroundColor: primary3Color,
      backgroundColor: primary3Color,
      leading: wantBackButton
          ? GestureDetector(
              onTap: () {
                Get.back();
              },
              child: Center(
                child: appIcons(
                  assetName: IconConstants.icBack,
                  height: 32.px,
                  width: 32.px,
                ),
              ),
            )
          : null,
      centerTitle: centerTitle,
      title: Text(
        title ?? '',
        style: MyTextStyle.titleStyle20bb,
      ),
      actions: actions,
    );
  }

  ///For Full Size Use In Column Not In ROW
  static Widget commonElevatedButton(
      {double? height,
      double? width,
      EdgeInsetsGeometry? buttonMargin,
      EdgeInsetsGeometry? contentPadding,
      double? borderRadius,
      Color? splashColor,
      bool showLoading = false,
      Color? buttonColor,
      TextStyle? textStyle,
      double? elevation,
      required VoidCallback onPressed,
      Widget? child,
      Decoration? decoration,
      BoxBorder? border,
      required BuildContext context}) {
    return Container(
      height: height ?? ResponsiveSize.height(context, 60),
      width: width ?? double.infinity,
      margin: buttonMargin,
      alignment: Alignment.center,
      decoration: decoration ??
          BoxDecoration(
              borderRadius: BorderRadius.circular(
                  borderRadius ?? ResponsiveSize.height(context, 8)),
              color: buttonColor ?? primaryColor),
      clipBehavior: Clip.hardEdge,
      child: showLoading
          ? Container(
              alignment: Alignment.center,
              decoration: decoration ??
                  BoxDecoration(
                      borderRadius: BorderRadius.circular(8.px),
                      color: buttonColor ?? primaryColor),
              child: const CircularProgressIndicator(
                color: primary3Color,
              ),
            )
          : GestureDetector(
              onTap: onPressed,
              child: Container(
                  height: height ?? 60.px,
                  width: width ?? double.infinity,
                  alignment: Alignment.center,
                  decoration: decoration ??
                      BoxDecoration(
                          borderRadius: BorderRadius.circular(8.px),
                          color: buttonColor ?? primaryColor),
                  child: child),
            ),
    );
  }

  ///For Full Size Use In Column Not In ROW
  static Widget commonGradientButton({
    double? height,
    double? width,
    EdgeInsetsGeometry? buttonMargin,
    EdgeInsetsGeometry? contentPadding,
    double? borderRadius,
    bool wantContentSizeButton = false,
    bool isLoading = false,
    Color? buttonColor,
    TextStyle? textStyle,
    double? elevation,
    required VoidCallback onPressed,
    Widget? child,
    BoxBorder? border,
  }) {
    return GestureDetector(
      onTap: () {
        onPressed();
      },
      child: Container(
        height: wantContentSizeButton ? height : 50.px,
        width: wantContentSizeButton ? width : double.infinity,
        margin: buttonMargin,
        alignment: Alignment.center,
        decoration: kGradientBoxDecoration(
            borderRadius: borderRadius, showGradientBorder: true),
        child: isLoading
            ? const Center(
                child: CircularProgressIndicator(
                  color: primary3Color,
                ),
              )
            : child ?? const Text(''),
      ),
    );
  }

  static imageView({
    double? width,
    double? height,
    double? radius,
    required String image,
    String? defaultNetworkImage,
    BoxFit? fit,
    BorderRadiusGeometry? borderRadius,
  }) {
    return SizedBox(
      height: height ?? 64.px,
      width: width ?? double.infinity,
      child: ClipRRect(
        borderRadius: borderRadius ?? BorderRadius.circular(radius ?? 8.px),
        child: CachedNetworkImage(
          imageUrl: image,
          fit: fit ?? BoxFit.cover,
          errorWidget: (context, error, stackTrace) {
            return Container(
              height: height ?? 64.px,
              width: width ?? double.infinity,
              color:
                  Theme.of(context).colorScheme.onSecondary.withOpacity(.2.px),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(radius ?? 8.px),
                child: defaultNetworkImage != null
                    ? imageView(image: defaultNetworkImage)
                    : Icon(Icons.error, color: Theme.of(context).primaryColor),
              ),
            );
          },
          progressIndicatorBuilder: (context, url, downloadProgress) {
            return SizedBox(
              height: height ?? 64.px,
              width: width ?? double.infinity,
              child: Shimmer.fromColors(
                baseColor: Theme.of(context)
                    .colorScheme
                    .onSecondary
                    .withOpacity(.4.px),
                highlightColor: Theme.of(context).colorScheme.onSecondary,
                child: Container(
                  color: Theme.of(context)
                      .colorScheme
                      .onSecondary
                      .withOpacity(.4.px),
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  static Widget dataNotFound() {
    return Center(
      child: Image.asset(ImageConstants.imageNoDataFound),
    );
  }

  static BoxDecoration kGradientBoxDecoration(
      {double? borderRadius,
      bool showGradientBorder = false,
      Color? defaultColor}) {
    return BoxDecoration(
      gradient: showGradientBorder
          ? LinearGradient(
              colors: [
                const Color(0xffFF4292),
                const Color(0xffFF4292).withOpacity(0.7),
                const Color(0xff5588FE).withOpacity(0.6),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            )
          : LinearGradient(colors: [
              defaultColor ?? Colors.grey,
              defaultColor ?? Colors.grey
            ]),
      borderRadius: BorderRadius.circular(borderRadius ?? 15.px),
    );
  }

  static Widget appIcons(
      {required String assetName,
      double? width,
      double? height,
      double? borderRadius,
      Color? color,
      BoxFit? fit}) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius ?? 4.px),
      child: Image.asset(
        assetName,
        height: height ?? 24.px,
        width: width ?? 24.px,
        color: color,
        fit: fit ?? BoxFit.fill,
        errorBuilder: (context, error, stackTrace) {
          return SizedBox(
            height: height ?? 24.px,
            width: width ?? 24.px,
          );
        },
      ),
    );
  }

  static Widget customProgressBar(
      {required bool inAsyncCall,
      double? width,
      Widget? child,
      Color? backgroundColor,
      bool overlapped = false,
      double? height}) {
    return Container(
      height: height ?? double.infinity,
      width: width ?? double.infinity,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color:
            inAsyncCall ? backgroundColor ?? backgroundColor : backgroundColor,
      ),
      clipBehavior: Clip.hardEdge,
      child: inAsyncCall
          ? overlapped
              ? Stack(
                  alignment: Alignment.center,
                  children: [
                    Stack(
                      alignment: Alignment.center,
                      children: [
                        const CircularProgressIndicator(
                          color: primaryColor,
                        ),
                        appIcons(
                            assetName: IconConstants.icLogo,
                            width: 30.px,
                            height: 30.px,
                            fit: BoxFit.fill)
                      ],
                    ),
                    Opacity(opacity: 0.3, child: child ?? const SizedBox()),
                  ],
                )
              : Stack(
                  alignment: Alignment.center,
                  children: [
                    const CircularProgressIndicator(
                      color: primaryColor,
                    ),
                    appIcons(
                        assetName: IconConstants.icLogo,
                        width: 30.px,
                        height: 30.px,
                        fit: BoxFit.fill)
                  ],
                )
          : child ?? const SizedBox(),
    );
  }

  static InputDecoration inputDecoration(
      {String? hintText,
      String? labelText,
      String? errorText,
      EdgeInsetsGeometry? contentPadding,
      Color? fillColor,
      TextStyle? hintStyle,
      TextStyle? labelStyle,
      TextStyle? errorStyle,
      Widget? suffixIcon,
      Widget? prefixIcon,
      bool? filled}) {
    return InputDecoration(
      errorText: errorText,
      counterText: '',
      errorStyle: Theme.of(Get.context!)
          .textTheme
          .titleMedium
          ?.copyWith(color: Theme.of(Get.context!).colorScheme.error),
      suffixIcon: suffixIcon,
      prefixIcon: prefixIcon,
      hintText: hintText,
      labelText: labelText,
      labelStyle: Theme.of(Get.context!).textTheme.titleMedium,
      fillColor: Theme.of(Get.context!).primaryColor,
      // filled: filled ?? false,
      contentPadding: EdgeInsets.symmetric(vertical: 4.px, horizontal: 16.px),
      hintStyle: Theme.of(Get.context!).textTheme.titleMedium,
      disabledBorder: border(color: Theme.of(Get.context!).colorScheme.surface),
      border: border(color: Theme.of(Get.context!).colorScheme.surface),
      errorBorder: border(color: Theme.of(Get.context!).colorScheme.surface),
      enabledBorder: border(color: Theme.of(Get.context!).colorScheme.surface),
      focusedErrorBorder: border(),
      focusedBorder: border(),
    );
  }

  static border({Color? color}) {
    return OutlineInputBorder(
      borderSide: BorderSide(
          color: color ?? Theme.of(Get.context!).primaryColor, width: 2.px),
      borderRadius: BorderRadius.circular(14.px),
    );
  }

  static Widget gradientText(String? text, double? fontSize) {
    return GradientText(
      text ?? '',
      gradientDirection: GradientDirection.ltr,
      style: TextStyle(
        fontSize: fontSize ?? 16.0.px,
      ),
      colors: [
        const Color(0xffFF4292),
        const Color(0xffFF4292).withOpacity(0.7),
        const Color(0xff5588FE).withOpacity(0.6),
      ],
    );
  }

  static Widget commonTextFieldForLoginSignUP(
      {double? elevation,
      String? hintText,
      String? labelText,
      String? errorText,
      EdgeInsetsGeometry? contentPadding,
      TextEditingController? controller,
      int? maxLines,
      double? cursorHeight,
      double? horizontalPadding,
      double? prefixIconHorizontal,
      bool wantBorder = false,
      ValueChanged<String>? onChanged,
      FormFieldValidator<String>? validator,
      Color? fillColor,
      Color? initialBorderColor,
      double? initialBorderWidth,
      TextInputType? keyboardType,
      double? borderRadius,
      double? maxHeight,
      TextStyle? hintStyle,
      TextStyle? style,
      TextStyle? labelStyle,
      TextStyle? errorStyle,
      List<TextInputFormatter>? inputFormatters,
      TextCapitalization textCapitalization = TextCapitalization.none,
      bool autofocus = false,
      bool readOnly = false,
      bool hintTextColor = false,
      Widget? suffixIcon,
      Widget? prefixIcon,
      AutovalidateMode? autoValidateMode,
      int? maxLength,
      GestureTapCallback? onTap,
      bool obscureText = false,
      FocusNode? focusNode,
      Decoration? decoration,
      bool? filled,
      bool isCard = false}) {
    return Padding(
      padding: contentPadding ?? EdgeInsets.symmetric(vertical: 5.px),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            labelText ?? '',
            style: labelStyle ??
                const TextStyle(
                    color: Colors.black,
                    fontFamily: 'Poppins',
                    fontWeight: FontWeight.w400,
                    fontSize: 12),
          ),
          Container(
            margin: EdgeInsets.symmetric(horizontal: 1.5.px, vertical: 5.px),
            //  padding: EdgeInsets.only(bottom: 5.px),
            decoration: decoration ??
                BoxDecoration(
                    color: fillColor ?? primary3Color.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(borderRadius ?? 8.px),
                    border: Border.all(
                        color: isCard ? primaryColor : primary2Color,
                        width: 1.px)),
            child: Padding(
              padding:
                  EdgeInsets.symmetric(horizontal: horizontalPadding ?? 16.px),
              child: Row(
                children: [
                  prefixIcon ?? const SizedBox(),
                  Flexible(
                    child: Padding(
                      padding:
                          EdgeInsets.only(left: 3.px, top: 9.px, right: 3.px),
                      child: TextFormField(
                        focusNode: focusNode,
                        obscureText: obscureText,
                        onTap: onTap,
                        maxLines: maxLines ?? 1,
                        maxLength: maxLength,
                        cursorHeight: cursorHeight,
                        cursorColor: Theme.of(Get.context!).primaryColor,
                        autovalidateMode: autoValidateMode,
                        controller: controller,
                        onChanged: onChanged ??
                            (value) {
                              value = value.trim();
                              if (value.isEmpty ||
                                  value.replaceAll(" ", "").isEmpty) {
                                controller?.text = "";
                              }
                            },
                        validator: validator,
                        keyboardType: keyboardType ?? TextInputType.text,
                        readOnly: readOnly,
                        autofocus: autofocus,
                        inputFormatters: inputFormatters,
                        textCapitalization: textCapitalization,
                        style: style ?? MyTextStyle.titleStyle14bb,
                        decoration: InputDecoration(
                          errorText: errorText,
                          counterText: '',
                          errorStyle: errorStyle ??
                              Theme.of(Get.context!)
                                  .textTheme
                                  .titleMedium
                                  ?.copyWith(
                                      color: Theme.of(Get.context!)
                                          .colorScheme
                                          .error),
                          hintText: hintText,
                          hintStyle: hintStyle ?? MyTextStyle.titleStyle14b,
                          fillColor:
                              fillColor ?? Theme.of(Get.context!).primaryColor,
                          filled: filled ?? false,
                          contentPadding:
                              contentPadding ?? EdgeInsets.only(bottom: 14.px),
                          border: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          errorBorder: InputBorder.none,
                          disabledBorder: InputBorder.none,
                        ),
                      ),
                    ),
                  ),
                  suffixIcon ?? const SizedBox(),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  static countryCodePicker(
      {ValueChanged<CountryCode>? onChanged, String? initialSelection}) {
    return CountryCodePicker(
      boxDecoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14.px),
        border: Border.all(
          color: Theme.of(Get.context!).primaryColor,
          width: .8.px,
        ),
      ),
      searchDecoration: InputDecoration(
        contentPadding: EdgeInsets.zero,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14.px),
          borderSide: BorderSide(
            width: .8.px,
            color: Theme.of(Get.context!).primaryColor,
          ),
        ),
        disabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14.px),
          borderSide: BorderSide(
            width: .8.px,
            color: Theme.of(Get.context!).primaryColor,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14.px),
          borderSide: BorderSide(
            width: .8.px,
            color: Theme.of(Get.context!).primaryColor,
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14.px),
          borderSide: BorderSide(
            width: .8.px,
            color: Theme.of(Get.context!).colorScheme.onSecondaryContainer,
          ),
        ),
      ),
      padding: EdgeInsets.zero,
      showFlagMain: true,
      hideMainText: true,
      flagWidth: 24.px,
      onChanged: onChanged,
      initialSelection: initialSelection ?? 'IN',
      showCountryOnly: true,
      showDropDownButton: false,
      showOnlyCountryWhenClosed: false,
      alignLeft: false,
      textStyle: MyTextStyle.titleStyle14bb,
    );
  }

  static Widget commonTextField({
    double? elevation,
    String? hintText,
    String? labelText,
    String? errorText,
    EdgeInsetsGeometry? contentPadding,
    TextEditingController? controller,
    int? maxLines,
    double? cursorHeight,
    bool wantBorder = false,
    ValueChanged<String>? onChanged,
    FormFieldValidator<String>? validator,
    Color? fillColor = const Color(0xffF8F8F8),
    Color? initialBorderColor,
    double? initialBorderWidth,
    TextInputType? keyboardType,
    double? borderRadius,
    double? maxHeight,
    TextStyle? hintStyle,
    TextStyle? style,
    TextStyle? labelStyle,
    TextStyle? errorStyle,
    List<TextInputFormatter>? inputFormatters,
    TextCapitalization textCapitalization = TextCapitalization.none,
    bool autofocus = false,
    bool readOnly = false,
    bool hintTextColor = false,
    Widget? suffixIcon,
    Widget? prefixIcon,
    AutovalidateMode? autoValidateMode,
    int? maxLength,
    GestureTapCallback? onTap,
    bool obscureText = false,
    FocusNode? focusNode,
    bool? filled,
    ValueChanged<String>? onFieldSubmitted,
  }) {
    return TextFormField(
      focusNode: focusNode,
      onFieldSubmitted: onFieldSubmitted,
      obscureText: obscureText,
      onTap: onTap,
      maxLength: maxLength,
      maxLines: maxLines ?? 1,
      cursorHeight: cursorHeight,
      cursorColor: Theme.of(Get.context!).primaryColor,
      autovalidateMode: autoValidateMode,
      controller: controller,
      onChanged: onChanged ??
          (value) {
            value = value.trim();
            if (value.isEmpty || value.replaceAll(" ", "").isEmpty) {
              controller?.text = "";
            }
          },
      validator: validator,
      keyboardType: keyboardType ?? TextInputType.streetAddress,
      readOnly: readOnly,
      autofocus: autofocus,
      inputFormatters: inputFormatters,
      textCapitalization: textCapitalization,
      style: style ??
          Theme.of(Get.context!).textTheme.titleMedium?.copyWith(
                color: Theme.of(Get.context!).primaryColor,
              ),
      decoration: InputDecoration(
        errorText: errorText,
        counterText: '',
        errorStyle: errorStyle ??
            Theme.of(Get.context!)
                .textTheme
                .titleMedium
                ?.copyWith(color: Theme.of(Get.context!).colorScheme.error),
        suffixIcon: suffixIcon,
        prefixIcon: prefixIcon,
        hintText: hintText,
        labelText: labelText,
        labelStyle: labelStyle,
        fillColor: fillColor ?? Theme.of(Get.context!).scaffoldBackgroundColor,
        filled: filled ?? true,
        contentPadding:
            contentPadding ?? EdgeInsets.symmetric(horizontal: 20.px),
        hintStyle: hintStyle ??
            Theme.of(Get.context!).textTheme.titleMedium?.copyWith(
                color: hintTextColor
                    ? Theme.of(Get.context!).primaryColor
                    : Theme.of(Get.context!).textTheme.titleMedium?.color),
        disabledBorder: OutlineInputBorder(
          borderSide: wantBorder
              ? BorderSide(
                  color: Theme.of(Get.context!).colorScheme.onSurface,
                  width: 2.px)
              : BorderSide.none,
          borderRadius: BorderRadius.circular(
            borderRadius ?? 14.px,
          ),
        ),
        border: OutlineInputBorder(
            borderSide: wantBorder
                ? BorderSide(
                    color: Theme.of(Get.context!).primaryColor, width: 2.px)
                : BorderSide.none,
            borderRadius: BorderRadius.circular(borderRadius ?? 14.px)),
        enabledBorder: OutlineInputBorder(
            borderSide: wantBorder
                ? BorderSide(
                    color: initialBorderColor ??
                        Theme.of(Get.context!).primaryColor,
                    width: initialBorderWidth ?? 2.px)
                : BorderSide.none,
            borderRadius: BorderRadius.circular(borderRadius ?? 14.px)),
        errorBorder: OutlineInputBorder(
            borderSide: wantBorder
                ? BorderSide(
                    color: Theme.of(Get.context!).colorScheme.onError,
                    width: 2.px)
                : BorderSide.none,
            borderRadius: BorderRadius.circular(borderRadius ?? 14.px)),
      ),
    );
  }

  static Widget commonOtpView({
    MainAxisAlignment mainAxisAlignment = MainAxisAlignment.spaceEvenly,
    PinCodeFieldShape? shape,
    TextInputType keyboardType = TextInputType.number,
    List<TextInputFormatter>? inputFormatters,
    TextEditingController? controller,
    ValueChanged<String>? onChanged,
    ValueChanged<String>? onCompleted,
    int length = 4,
    double? height,
    double? width,
    double? borderRadius,
    double? borderWidth,
    bool readOnly = false,
    bool autoFocus = false,
    bool enableActiveFill = true,
    bool enablePinAutofill = true,
    bool autoDismissKeyboard = true,
    TextStyle? textStyle,
    Color? cursorColor,
    Color? inactiveColor,
    Color? inactiveFillColor,
    Color? activeColor,
    Color? activeFillColor,
    Color? selectedColor,
    Color? selectedFillColor,
  }) =>
      PinCodeTextField(
        length: length,
        mainAxisAlignment: mainAxisAlignment,
        hintCharacter: '●',
        hintStyle: MyTextStyle.titleStyle20bb,
        //obscureText: true,
        appContext: Get.context!,
        cursorColor: primaryColor,
        autoFocus: autoFocus,
        keyboardType: keyboardType,

        inputFormatters: inputFormatters ??
            <TextInputFormatter>[FilteringTextInputFormatter.digitsOnly],
        readOnly: readOnly,
        textStyle: textStyle ?? Theme.of(Get.context!).textTheme.headlineMedium,
        autoDisposeControllers: false,
        enabled: true,
        animationType: AnimationType.fade,
        pinTheme: PinTheme(
          inactiveColor: Colors.grey.withOpacity(0.8),
          inactiveFillColor: Colors.transparent,
          activeColor: Colors.grey.withOpacity(0.8),
          activeFillColor: Colors.transparent,
          selectedColor: primaryColor,
          selectedFillColor: Colors.transparent,
          shape: shape ?? PinCodeFieldShape.underline,
          fieldWidth: width ?? 45.px,
          fieldHeight: height ?? 45.px,
          borderWidth: borderWidth ?? 5.px,
          borderRadius: BorderRadius.circular(borderRadius ?? 3.px),
        ),
        enableActiveFill: enableActiveFill,
        controller: controller,
        onChanged: onChanged,
        enablePinAutofill: enablePinAutofill,
        onCompleted: onCompleted,
        autoDismissKeyboard: autoDismissKeyboard,
      );

  static Widget profileStackWidget({
    required List<String> profileImageUrls,
    double avatarSize = 50.0,
    double spacing = 10.0,
  }) {
    List<Widget> stackLayers =
        List<Widget>.generate(profileImageUrls.length, (index) {
      return Padding(
        padding: EdgeInsets.fromLTRB(index.toDouble() * spacing, 0, 0, 0),
        child: CommonWidgets.imageView(
            image: profileImageUrls[index],
            height: avatarSize,
            width: avatarSize,
            borderRadius: BorderRadius.circular(avatarSize / 2),
            defaultNetworkImage: StringConstants.defaultNetworkImage),
      );
    });

    return Stack(children: stackLayers);
  }

  static Future<bool> internetConnectionCheckerMethod() async {
    if (kIsWeb) {
      // Browser CORS blocks generic cross-origin probes (e.g. google.com).
      // Let the real API request determine connectivity/errors on web.
      return true;
    }
    try {
      final result = await http
          .get(Uri.parse('https://www.google.com/'))
          .timeout(const Duration(seconds: 5));
      return result.statusCode == 200;
    } on SocketException catch (_) {
      return false;
    } catch (_) {
      return false;
    }
  }

  static ScaffoldFeatureController<SnackBar, SnackBarClosedReason> snackBarView(
      {String title = '', bool success = false}) {
    var snackBar = SnackBar(
      content: Text(title,
          style: Theme.of(Get.context!)
              .textTheme
              .displayMedium
              ?.copyWith(fontSize: 14.px, color: primary3Color)),
      backgroundColor: success ? Colors.green : Colors.redAccent,
    );
    return ScaffoldMessenger.of(Get.context!).showSnackBar(snackBar);
  }

  static Map<String, dynamic> _safeResponseJsonMap(http.Response? response) {
    final String body = (response?.body ?? '').trim();
    if (body.isEmpty) return <String, dynamic>{};
    if (!(body.startsWith('{') || body.startsWith('['))) {
      return <String, dynamic>{};
    }
    try {
      final dynamic decoded = jsonDecode(body);
      if (decoded is Map<String, dynamic>) return decoded;
      if (decoded is Map) return Map<String, dynamic>.from(decoded);
    } catch (_) {}
    return <String, dynamic>{};
  }

  ///For Check Post Api Response
  static Future<bool> responseCheckForPostMethod(
      {http.Response? response, bool wantSnackBar = true}) async {
    final Map<String, dynamic> responseMap = _safeResponseJsonMap(response);
    final bool hasSuccessField = responseMap.containsKey('success');
    final bool bodySuccess = responseMap['success'] == true;
    final bool httpSuccess =
        response != null && response.statusCode >= 200 && response.statusCode < 300;
    final bool isSuccess = httpSuccess && (!hasSuccessField || bodySuccess);

    if (wantSnackBar) {
      if (responseMap[ApiKeyConstants.message] != null) {
        snackBarView(
          title: responseMap[ApiKeyConstants.message],
          success: isSuccess,
        );
      }
      if (responseMap[ApiKeyConstants.error] != null) {
        snackBarView(title: responseMap[ApiKeyConstants.error]);
      }
    }
    return isSuccess;
  }

  ///For Check Get Api Response
  static Future<bool> responseCheckForGetMethod({
    http.Response? response,
    bool wantSuccessToast = false,
    bool wantErrorToast = true,
  }) async {
    final Map<String, dynamic> responseMap = _safeResponseJsonMap(response);
    final bool hasSuccessField = responseMap.containsKey('success');
    final bool bodySuccess = responseMap['success'] == true;
    final bool httpSuccess =
        response != null && response.statusCode >= 200 && response.statusCode < 300;
    return httpSuccess && (!hasSuccessField || bodySuccess);
  }

  static void showMyToastMessage(String message, {int? duration}) {
    Fluttertoast.showToast(
        msg: message,
        toastLength: Toast.LENGTH_SHORT,
        gravity: ToastGravity.CENTER,
        timeInSecForIosWeb: duration ?? 1,
        textColor: Colors.white,
        fontSize: 16.0);
  }

  static void showAlertDialog(
      {String title = StringConstants.logout,
      String content = StringConstants.wouldYouLikeToLogout,
      VoidCallback? onPressedYes}) {
    showCupertinoModalPopup<void>(
      context: Get.context!,
      builder: (BuildContext context) => CupertinoAlertDialog(
        title: Text(title.tr),
        content: Text(content.tr),
        actions: <CupertinoDialogAction>[
          CupertinoDialogAction(
            isDefaultAction: true,
            onPressed: () => Get.back(),
            child: Text(StringConstants.no.tr),
          ),
          CupertinoDialogAction(
            isDestructiveAction: true,
            onPressed: onPressedYes,
            child: Text(StringConstants.yes.tr),
          ),
        ],
      ),
    );
  }

  static void networkConnectionShowSnackBar() {
    snackBarView(title: "Check Your Internet Connection", success: false);
  }

  static void serverDownShowSnackBar() {
    snackBarView(title: "Server Down", success: false);
  }

  static Widget progressBar(
      {bool isLoading = false, Widget? child, double? height, double? width}) {
    return Container(
      height: height ?? 50.px,
      width: width ?? double.infinity,
      alignment: Alignment.center,
      child: isLoading
          ? Center(
              child: CircularProgressIndicator(
                  color: Theme.of(Get.context!).primaryColor,
                  strokeWidth: 4.px))
          : child,
    );
  }
}

enum ErrorAnimationType { shake, clear }
