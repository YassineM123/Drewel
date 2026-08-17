import 'dart:convert';

import 'package:drewel/app/data/apis/api_models/passenger_account_models.dart';
import 'package:drewel/common/drewel_app_bar.dart';
import 'package:drewel/common/http_methods.dart';
import 'package:drewel/common/text_styles.dart';
import 'package:flutter/material.dart';

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

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _content = null;
      _error = '';
    });
    try {
      final String url =
          '${ApiUrlConstants.baseUrl}account/legal/${widget.type}';
      final response = await MyHttp.getMethod(url: url);
      if (response == null || response.statusCode != 200) {
        if (mounted) {
          setState(() => _content = LegalContentModel.fallback(widget.type));
        }
        return;
      }
      final dynamic decoded = jsonDecode(response.body);
      final dynamic raw = (decoded as Map<String, dynamic>)['legal'] ??
          decoded['data'];
      if (raw == null) {
        if (mounted) {
          setState(() => _content = LegalContentModel.fallback(widget.type));
        }
        return;
      }
      final LegalContentModel content =
          LegalContentModel.fromJson(Map<String, dynamic>.from(raw as Map));
      if (!mounted) return;
      setState(
        () => _content = content.body.trim().isEmpty
            ? LegalContentModel.fallback(widget.type)
            : content,
      );
    } catch (_) {
      if (mounted) {
        setState(() => _content = LegalContentModel.fallback(widget.type));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final String title =
        widget.type == 'terms' ? 'Terms & Conditions' : 'Privacy Policy';
    return Scaffold(
      appBar: DrewelAppBar(title: title, showBackButton: true),
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
                    Text(_error, style: MyTextStyle.titleStyle16b,
                        textAlign: TextAlign.center),
                    const SizedBox(height: 16),
                    TextButton(
                      onPressed: _load,
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            )
          : _content == null
              ? const Center(child: CircularProgressIndicator())
              : ListView(
                  padding: const EdgeInsets.all(20),
                  children: <Widget>[
                    Text(_content!.title, style: MyTextStyle.titleStyle20bb),
                    if (_content!.lastUpdated?.isNotEmpty == true) ...<Widget>[
                      const SizedBox(height: 4),
                      Text('Last updated ${_content!.lastUpdated}',
                          style: const TextStyle(color: Color(0xFF9DB2BF))),
                    ],
                    const SizedBox(height: 20),
                    Text(
                      _content!.body,
                      style: const TextStyle(height: 1.5, fontSize: 15),
                    ),
                  ],
                ),
    );
  }
}
