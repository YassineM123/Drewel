// ignore: deprecated_member_use
import 'dart:html' as html;

Stream<void> googleMapsAuthenticationFailures() =>
    html.window.on['drewel-google-maps-auth-failure']
        .map<void>((html.Event _) {});

bool googleMapsAuthenticationFailed() =>
    html.window.sessionStorage['drewel-google-maps-auth-failed'] == '1';
