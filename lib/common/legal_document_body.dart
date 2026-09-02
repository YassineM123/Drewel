import 'package:drewel/app/data/apis/api_models/passenger_account_models.dart';
import 'package:drewel/common/colors.dart';
import 'package:flutter/material.dart';

class LegalDocumentBody extends StatelessWidget {
  const LegalDocumentBody({super.key, required this.legal});

  final LegalContentModel legal;

  @override
  Widget build(BuildContext context) {
    final List<_LegalSectionData> sections = _parseSections(legal.body);
    final bool hasNumberedSections = sections.length > 1;

    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final double maxWidth =
            constraints.maxWidth >= 760 ? 760 : double.infinity;
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
          children: <Widget>[
            Center(
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: maxWidth),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    _LegalHeader(
                      title: legal.title,
                      lastUpdated: legal.lastUpdated,
                      sectionCount:
                          hasNumberedSections ? sections.length : null,
                    ),
                    const SizedBox(height: 14),
                    if (hasNumberedSections)
                      for (final _LegalSectionData section
                          in sections) ...<Widget>[
                        _LegalSection(section: section),
                        const SizedBox(height: 10),
                      ]
                    else
                      _PlainLegalBody(body: legal.body),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  static List<_LegalSectionData> _parseSections(String body) {
    final List<_LegalSectionData> sections = <_LegalSectionData>[];
    final RegExp headingPattern = RegExp(r'^(\d{1,2})\.\s+(.+)$');
    _LegalSectionData? current;
    final List<String> paragraphLines = <String>[];

    void flushParagraph() {
      final String paragraph = paragraphLines.join(' ').trim();
      final _LegalSectionData? active = current;
      if (paragraph.isNotEmpty && active != null) {
        active.paragraphs.add(paragraph);
      }
      paragraphLines.clear();
    }

    for (final String rawLine in body.split('\n')) {
      final String line = rawLine.trim();
      final RegExpMatch? heading = headingPattern.firstMatch(line);
      if (heading != null) {
        flushParagraph();
        final _LegalSectionData? previous = current;
        if (previous != null) sections.add(previous);
        current = _LegalSectionData(
          number: heading.group(1) ?? '',
          title: heading.group(2) ?? '',
          paragraphs: <String>[],
        );
        continue;
      }
      if (line.isEmpty) {
        flushParagraph();
      } else {
        paragraphLines.add(line);
      }
    }
    flushParagraph();
    final _LegalSectionData? last = current;
    if (last != null) sections.add(last);
    return sections;
  }
}

class _LegalHeader extends StatelessWidget {
  const _LegalHeader({
    required this.title,
    required this.lastUpdated,
    required this.sectionCount,
  });

  final String title;
  final String? lastUpdated;
  final int? sectionCount;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFFE7E8EC)),
          boxShadow: <BoxShadow>[
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 18,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: primaryColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.gavel_rounded, color: primaryColor),
            ),
            const SizedBox(height: 14),
            Text(
              title,
              style: const TextStyle(
                color: textColor,
                fontSize: 24,
                fontWeight: FontWeight.w800,
                height: 1.16,
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Please review these terms carefully before using Drewel driver services.',
              style: TextStyle(
                color: text2Color,
                fontSize: 14,
                height: 1.45,
              ),
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: <Widget>[
                const _MetaPill(
                  icon: Icons.verified_user_outlined,
                  label: 'UAE governed',
                ),
                if (sectionCount != null)
                  _MetaPill(
                    icon: Icons.format_list_numbered_rounded,
                    label: '$sectionCount sections',
                  ),
                if (lastUpdated?.isNotEmpty == true)
                  _MetaPill(
                    icon: Icons.update_rounded,
                    label: 'Updated $lastUpdated',
                  ),
              ],
            ),
          ],
        ),
      );
}

class _MetaPill extends StatelessWidget {
  const _MetaPill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: const Color(0xFFF7F8FA),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFFE7E8EC)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(icon, size: 16, color: primaryColor),
            const SizedBox(width: 6),
            Text(
              label,
              style: const TextStyle(
                color: textColor,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      );
}

class _LegalSection extends StatelessWidget {
  const _LegalSection({required this.section});

  final _LegalSectionData section;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFFE7E8EC)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Container(
              width: 34,
              height: 34,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: primaryColor,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                section.number,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    section.title,
                    style: const TextStyle(
                      color: textColor,
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      height: 1.25,
                    ),
                  ),
                  const SizedBox(height: 8),
                  for (int index = 0;
                      index < section.paragraphs.length;
                      index++) ...<Widget>[
                    Text(
                      section.paragraphs[index],
                      style: const TextStyle(
                        color: Color(0xFF3B3B3B),
                        fontSize: 14,
                        height: 1.55,
                      ),
                    ),
                    if (index != section.paragraphs.length - 1)
                      const SizedBox(height: 8),
                  ],
                ],
              ),
            ),
          ],
        ),
      );
}

class _PlainLegalBody extends StatelessWidget {
  const _PlainLegalBody({required this.body});

  final String body;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFFE7E8EC)),
        ),
        child: Text(
          body,
          style: const TextStyle(
            color: Color(0xFF3B3B3B),
            fontSize: 14,
            height: 1.55,
          ),
        ),
      );
}

class _LegalSectionData {
  _LegalSectionData({
    required this.number,
    required this.title,
    required this.paragraphs,
  });

  final String number;
  final String title;
  final List<String> paragraphs;
}
