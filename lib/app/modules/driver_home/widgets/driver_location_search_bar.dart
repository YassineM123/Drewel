import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:google_places_flutter/model/prediction.dart';

import '../../../../common/colors.dart';
import '../../../../common/common_methods.dart';
import '../../../../common/text_styles.dart';
import '../../../data/constants/string_constants.dart';
import '../controllers/driver_home_controller.dart';

/// Modern location search bar for the driver home screen with clear button,
/// smooth debounced autocomplete, loading/error states, and tap-to-dismiss behavior.
class DriverLocationSearchBar extends StatefulWidget {
  const DriverLocationSearchBar({
    super.key,
    required this.controller,
  });

  final DriverHomeController controller;

  static const double suggestionsMaxHeight = 280;

  @override
  State<DriverLocationSearchBar> createState() =>
      _DriverLocationSearchBarState();
}

class _DriverLocationSearchBarState extends State<DriverLocationSearchBar> {
  bool _focused = false;
  bool _hasText = false;

  DriverHomeController get controller => widget.controller;

  @override
  void initState() {
    super.initState();
    _focused = controller.locationFocusNode.hasFocus;
    _hasText = controller.locationController.text.isNotEmpty;
    controller.locationFocusNode.addListener(_onFocusChanged);
    controller.locationController.addListener(_onTextChanged);
  }

  @override
  void dispose() {
    controller.locationFocusNode.removeListener(_onFocusChanged);
    controller.locationController.removeListener(_onTextChanged);
    super.dispose();
  }

  void _onFocusChanged() {
    if (!mounted) return;
    setState(() => _focused = controller.locationFocusNode.hasFocus);
  }

  void _onTextChanged() {
    if (!mounted) return;
    final bool hasText = controller.locationController.text.isNotEmpty;
    if (hasText != _hasText) {
      setState(() => _hasText = hasText);
    }
  }

  void _onClear() {
    controller.clearLocationSearch();
    controller.locationFocusNode.unfocus();
    CommonMethods.unFocsKeyBoard();
  }

  Future<void> _onSuggestionTap(Prediction prediction) async {
    await controller.clickOnLocation(prediction);
    if (!mounted) return;
    controller.clearPlaceSuggestions();
    controller.locationFocusNode.unfocus();
    CommonMethods.unFocsKeyBoard();
    setState(() => _focused = false);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        _buildSearchField(),
        if (_hasText && _focused) Obx(_buildSuggestions),
      ],
    );
  }

  Widget _buildSearchField() {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      height: 52,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: _focused ? primaryColor : Colors.black.withOpacity(0.08),
          width: _focused ? 1.5 : 1,
        ),
        boxShadow: <BoxShadow>[
          BoxShadow(
            color: Colors.black.withOpacity(_focused ? 0.16 : 0.08),
            blurRadius: _focused ? 16 : 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: <Widget>[
          const SizedBox(width: 14),
          Icon(
            Icons.location_on_rounded,
            color: _focused || _hasText ? primaryColor : Colors.black38,
            size: 22,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: TextField(
              controller: controller.locationController,
              focusNode: controller.locationFocusNode,
              style: MyTextStyle.titleStyle14b,
              textInputAction: TextInputAction.search,
              onChanged: controller.onLocationTextChanged,
              onSubmitted: (_) {
                controller.locationFocusNode.unfocus();
                CommonMethods.unFocsKeyBoard();
              },
              decoration: InputDecoration(
                hintText: StringConstants.searchLocation,
                border: InputBorder.none,
                disabledBorder: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                isDense: true,
                contentPadding: EdgeInsets.zero,
                hintStyle: MyTextStyle.titleStyle14b.copyWith(
                  color: hintColor,
                ),
              ),
            ),
          ),
          if (_hasText) _buildClearButton(),
          const SizedBox(width: 6),
        ],
      ),
    );
  }

  Widget _buildClearButton() {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: _onClear,
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Icon(
            Icons.close_rounded,
            size: 20,
            color: Colors.black.withOpacity(0.55),
          ),
        ),
      ),
    );
  }

  Widget _buildSuggestions() {
    final bool isLoading = controller.isPlacesLoading.value;
    final String error = controller.placesSearchError.value;
    final List<Prediction> suggestions = controller.placeSuggestions;

    final Widget content;
    if (isLoading) {
      content = _buildStatusTile(
        icon: const SizedBox(
          width: 18,
          height: 18,
          child: CircularProgressIndicator(
            strokeWidth: 2.2,
            color: primaryColor,
          ),
        ),
        message: 'Searching locations...',
      );
    } else if (error.isNotEmpty) {
      content = _buildStatusTile(
        icon: const Icon(
          Icons.error_outline_rounded,
          color: Colors.black45,
          size: 20,
        ),
        message: error,
      );
    } else if (suggestions.isEmpty) {
      content = _buildStatusTile(
        icon: const Icon(
          Icons.search_off_rounded,
          color: Colors.black45,
          size: 20,
        ),
        message: 'No locations found',
      );
    } else {
      content = _buildSuggestionsList(suggestions);
    }

    return Container(
      margin: const EdgeInsets.only(top: 8),
      constraints: const BoxConstraints(
        maxHeight: DriverLocationSearchBar.suggestionsMaxHeight,
      ),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: <BoxShadow>[
          BoxShadow(
            color: Colors.black.withOpacity(0.14),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: content,
    );
  }

  Widget _buildStatusTile({required Widget icon, required String message}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: <Widget>[
          icon,
          const SizedBox(width: 10),
          Flexible(
            child: Text(
              message,
              textAlign: TextAlign.center,
              style: MyTextStyle.titleStyle13b.copyWith(
                color: Colors.black.withOpacity(0.55),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSuggestionsList(List<Prediction> suggestions) {
    return ListView.separated(
      shrinkWrap: true,
      padding: const EdgeInsets.symmetric(vertical: 4),
      itemCount: suggestions.length,
      separatorBuilder: (_, __) => Divider(
        height: 1,
        color: Colors.black.withOpacity(0.06),
      ),
      itemBuilder: (BuildContext context, int index) {
        return _buildSuggestionTile(suggestions[index]);
      },
    );
  }

  Widget _buildSuggestionTile(Prediction prediction) {
    final String mainText =
        prediction.structuredFormatting?.mainText?.trim().isNotEmpty == true
            ? prediction.structuredFormatting!.mainText!
            : (prediction.description ?? '');
    final String secondaryText =
        prediction.structuredFormatting?.secondaryText ?? '';

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => _onSuggestionTap(prediction),
        splashColor: primaryColor.withOpacity(0.08),
        highlightColor: primaryColor.withOpacity(0.06),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Row(
            children: <Widget>[
              Container(
                width: 36,
                height: 36,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: primaryColor.withOpacity(0.08),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.location_on_rounded,
                  color: primaryColor,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    Text(
                      mainText,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: MyTextStyle.titleStyle14bb.copyWith(
                        color: Colors.black.withOpacity(0.87),
                      ),
                    ),
                    if (secondaryText.isNotEmpty) ...<Widget>[
                      const SizedBox(height: 2),
                      Text(
                        secondaryText,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: MyTextStyle.titleStyle12b.copyWith(
                          color: Colors.black.withOpacity(0.5),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 6),
              Icon(
                Icons.north_east_rounded,
                size: 16,
                color: Colors.black.withOpacity(0.25),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
