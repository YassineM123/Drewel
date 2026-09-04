import 'dart:convert';

import 'package:drewel/app/data/apis/api_models/passenger_account_models.dart';
import 'package:drewel/common/drewel_app_bar.dart';
import 'package:drewel/common/http_methods.dart';
import 'package:drewel/common/legal_document_body.dart';
import 'package:drewel/common/text_styles.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../app/data/apis/api_constants/api_url_constants.dart';

/// Standalone, pre-login friendly viewer for legal documents served by the
/// public `GET /account/legal/:type` endpoint. Used during signup consent
/// before an account exists, so it must not depend on authenticated account
/// controllers.
class LegalContentView extends StatefulWidget {
  const LegalContentView({super.key, required this.type});

  final String type;

  @override
  State<LegalContentView> createState() => _LegalContentViewState();
}

class _LegalContentViewState extends State<LegalContentView> {
  LegalContentModel? _content;
  String _error = '';
  String? _loadedLanguage;
  int _loadGeneration = 0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final String language = _currentLanguage();
    if (_loadedLanguage != language) {
      _loadedLanguage = language;
      _load(language: language);
    }
  }

  String _currentLanguage() {
    final String languageCode = (Get.locale?.languageCode ??
            Localizations.maybeLocaleOf(context)?.languageCode ??
            'en')
        .trim()
        .toLowerCase();
    return languageCode.startsWith('ar') ? 'ar' : 'en';
  }

  Future<void> _load({String? language}) async {
    final String selectedLanguage = language ?? _currentLanguage();
    final int generation = ++_loadGeneration;
    setState(() {
      _content = null;
      _error = '';
    });
    try {
      final Uri url = Uri.parse(
        '${ApiUrlConstants.baseUrl}account/legal/${widget.type}',
      ).replace(queryParameters: <String, String>{
        'language': selectedLanguage,
      });
      final response = await MyHttp.getMethod(url: url.toString());
      if (response == null || response.statusCode != 200) {
        if (mounted && generation == _loadGeneration) {
          setState(
            () => _content = LegalContentModel.fallback(
              widget.type,
              language: selectedLanguage,
            ),
          );
        }
        return;
      }
      final dynamic decoded = jsonDecode(response.body);
      final dynamic raw =
          (decoded as Map<String, dynamic>)['legal'] ?? decoded['data'];
      if (raw == null) {
        if (mounted && generation == _loadGeneration) {
          setState(
            () => _content = LegalContentModel.fallback(
              widget.type,
              language: selectedLanguage,
            ),
          );
        }
        return;
      }
      final LegalContentModel content =
          LegalContentModel.fromJson(Map<String, dynamic>.from(raw as Map));
      if (!mounted || generation != _loadGeneration) return;
      setState(
        () => _content = content.body.trim().isEmpty
            ? LegalContentModel.fallback(
                widget.type,
                language: selectedLanguage,
              )
            : content,
      );
    } catch (_) {
      if (mounted && generation == _loadGeneration) {
        setState(
          () => _content = LegalContentModel.fallback(
            widget.type,
            language: selectedLanguage,
          ),
        );
      }
    }
  }

  String _appBarTitle() {
    final bool isArabic = _currentLanguage() == 'ar';
    if (widget.type == 'driver-terms') {
      return isArabic ? 'شروط وأحكام السائق' : 'Driver Terms & Conditions';
    }
    if (widget.type == 'terms') return 'terms_conditions'.tr;
    return 'privacy_policy'.tr;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: DrewelAppBar(title: _appBarTitle(), showBackButton: true),
      backgroundColor: const Color(0xFFFAFAFA),
      body: _error.isNotEmpty
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    const Icon(Icons.description_outlined,
                        size: 48, color: Color(0xFF9DB2BF)),
                    const SizedBox(height: 12),
                    Text(_error,
                        style: MyTextStyle.titleStyle16b,
                        textAlign: TextAlign.center),
                    const SizedBox(height: 16),
                    TextButton(
                      onPressed: () => _load(),
                      child: Text('retry'.tr),
                    ),
                  ],
                ),
              ),
            )
          : _content == null
              ? const Center(child: CircularProgressIndicator())
              : LegalDocumentBody(legal: _content!),
    );
  }
}
