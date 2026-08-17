import 'package:drewel/common/text_styles.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../app/data/constants/string_constants.dart';
import 'colors.dart';
import 'legal_content_view.dart';

/// Consent checkbox used on the login and registration flows. Confirms both
/// the minimum age (18+) and acceptance of the Terms of Service and Privacy
/// Policy, which are shown inline via the public legal documents endpoint.
class LegalConsentCheckbox extends StatelessWidget {
  const LegalConsentCheckbox({
    super.key,
    required this.value,
    required this.onChanged,
    this.compact = false,
  });

  final bool value;
  final ValueChanged<bool> onChanged;
  final bool compact;

  void _openLegal(String type) {
    Get.to(() => LegalContentView(type: type));
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Padding(
          padding: EdgeInsets.only(top: compact ? 0 : 2),
          child: SizedBox(
            height: 24,
            width: 24,
            child: Checkbox(
              value: value,
              onChanged: (bool? checked) => onChanged(checked ?? false),
              activeColor: primaryColor,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text.rich(
            TextSpan(
              style: compact
                  ? MyTextStyle.titleStyle12b
                  : MyTextStyle.titleStyle14b,
                  children: <InlineSpan>[
                    const TextSpan(text: StringConstants.ageConsentPrefix),
                    WidgetSpan(
                      alignment: PlaceholderAlignment.middle,
                      child: GestureDetector(
                        onTap: () => _openLegal('terms'),
                        child: Text(
                          StringConstants.termsOfService,
                          style: MyTextStyle.titleStyle14bb.copyWith(
                            color: primaryColor,
                            decoration: TextDecoration.underline,
                          ),
                        ),
                      ),
                    ),
                const TextSpan(text: StringConstants.and),
                WidgetSpan(
                  alignment: PlaceholderAlignment.middle,
                  child: GestureDetector(
                    onTap: () => _openLegal('privacy'),
                    child: Text(
                      StringConstants.privacyPolicy,
                      style: MyTextStyle.titleStyle14bb.copyWith(
                        color: primaryColor,
                        decoration: TextDecoration.underline,
                      ),
                    ),
                  ),
                ),
                const TextSpan(text: StringConstants.ageConsentSuffix),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
