// Generates the Drewel branded notification sound set.
//
// The templates below synthesize the same tonal "family" (A4 pentatonic with a
// bright C6 top) so every notification is immediately recognisable as Drewel
// while each event keeps its own distinct pattern and energy.
//
// Run from the repository root:
//   dart run tool/generate_drewel_sounds.dart
//
// All files are 44.1 kHz, mono, 16-bit PCM WAV, peak-normalised to -3.0 dBFS
// and RMS-matched so no sound is dramatically louder than the others.

import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

const int sampleRate = 44100;
const double peakDbfs = -3.0;

/// A single struck pitch.
class Tone {
  const Tone({
    required this.frequency,
    required this.start,
    required this.duration,
    this.amplitude = 1.0,
    this.detuneHz = 0,
    this.harmonicGain = 0.35,
  });

  final double frequency;
  final double start; // seconds
  final double duration; // seconds
  final double amplitude;
  final double detuneHz;
  final double harmonicGain; // second harmonic level relative to fundamental
}

class Note {
  const Note({
    required this.name,
    required this.freq,
  });

  final String name;
  final double freq;

  @override
  String toString() => name;
}

// A = 440 Hz reference.
const Note a4 = Note(name: 'A4', freq: 440.0);
const Note c5 = Note(name: 'C5', freq: 523.25);
const Note d4 = Note(name: 'D4', freq: 293.66);
const Note e5 = Note(name: 'E5', freq: 659.25);
const Note g5 = Note(name: 'G5', freq: 783.99);
const Note a5 = Note(name: 'A5', freq: 880.0);
const Note c6 = Note(name: 'C6', freq: 1046.5);
const Note b3 = Note(name: 'B3', freq: 246.94);

/// Convert seconds -> sample index.
int s(double seconds) => (seconds * sampleRate).round();

/// Short bell-like strike with a slight inharmonic "pluck" transient.
Uint8List render(
  List<Tone> tones, {
  required double duration,
  double? normalizeTo,
}) {
  final int length = s(duration);
  final Float64List samples = Float64List(length + 1);

  double env(double t, double attack, double decay) {
    // Exponential decay with a fast, click-free attack.
    final double a = t <= attack ? t / attack : 1.0;
    return a * exp(-decay * (t - attack > 0 ? t - attack : 0));
  }

  for (final Tone tone in tones) {
    final int start = s(tone.start);
    final double attack = 0.004;
    final double decay = 1.0 / max(0.25, tone.duration - attack);
    for (int i = start;
        i < length && i < start + s(tone.duration);
        i++) {
      final double t = (i - start) / sampleRate;
      final double e = env(t, attack, decay);
      final double phase =
          2 * pi * (tone.frequency + tone.detuneHz) * (i / sampleRate);
      final double detuned = 2 * pi *
          (tone.frequency + tone.detuneHz * 1.008) *
          (i / sampleRate);
      double v = sin(phase);
      v += tone.harmonicGain * sin(2 * phase);
      v += 0.12 * sin(3 * phase);
      // Slight wobble against the detuned oscillator creates a warm, rich
      // attack without sounding like a generic beep.
      v += 0.18 * tone.harmonicGain * sin(detuned);
      samples[i] += e * v * tone.amplitude;
    }
  }

  // Normalise to peak and match requested RMS.
  double peak = 0;
  for (final double v in samples) {
    peak = max(peak, v.abs());
  }
  final double targetPeak = pow(10, peakDbfs / 20).toDouble();
  final double scale = peak > 0 ? targetPeak / peak : 1.0;
  final double rmsTarget = normalizeTo ?? 0.16;
  for (int i = 0; i < samples.length; i++) {
    samples[i] *= scale;
  }
  double rms = 0;
  for (final double v in samples) {
    rms += v * v;
  }
  rms = sqrt(rms / max(1, samples.length));
  for (int i = 0; i < samples.length; i++) {
    samples[i] *= rms > 0 ? rmsTarget / rms : 1.0;
  }

  // Fade out the very end to remove any truncation click.
  final int fadeSamples = s(0.015);
  for (int i = 0; i < fadeSamples; i++) {
    final double g = i / fadeSamples;
    samples[length - 1 - i] *= g;
  }

  return wav16Pcm(samples);
}

Uint8List wav16Pcm(Float64List samples) {
  final ByteData data = ByteData(44 + samples.length * 2);
  void writeString(int offset, String value) {
    for (int i = 0; i < value.length; i++) {
      data.setUint8(offset + i, value.codeUnitAt(i));
    }
  }

  writeString(0, 'RIFF');
  data.setUint32(4, 36 + samples.length * 2, Endian.little);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  data.setUint32(16, 16, Endian.little); // PCM chunk size
  data.setUint16(20, 1, Endian.little); // PCM format
  data.setUint16(22, 1, Endian.little); // mono
  data.setUint32(24, sampleRate, Endian.little);
  data.setUint32(28, sampleRate * 2, Endian.little); // byte rate
  data.setUint16(32, 2, Endian.little); // block align
  data.setUint16(34, 16, Endian.little); // bits per sample
  writeString(36, 'data');
  data.setUint32(40, samples.length * 2, Endian.little);

  for (int i = 0; i < samples.length; i++) {
    final double clamped = samples[i].clamp(-1.0, 1.0);
    data.setInt16(44 + i * 2, (clamped * 32767).round(), Endian.little);
  }
  return data.buffer.asUint8List();
}

Map<String, Uint8List> buildAll() {
  return <String, Uint8List>{
    // ------------------------------------------------------------------
    // drewel_notification: soft two-note rise. General / system updates.
    // ------------------------------------------------------------------
    'drewel_notification.wav': render(
      <Tone>[
        Tone(frequency: a4.freq, start: 0, duration: 0.42, amplitude: 1.0),
        Tone(frequency: e5.freq, start: 0.16, duration: 0.5, amplitude: 0.9),
      ],
      duration: 0.62,
      normalizeTo: 0.14,
    ),

    // ------------------------------------------------------------------
    // drewel_message: quiet single pluck. Chat messages.
    // ------------------------------------------------------------------
    'drewel_message.wav': render(
      <Tone>[
        Tone(frequency: a5.freq, start: 0, duration: 0.24, amplitude: 0.75),
        Tone(
          frequency: c6.freq,
          start: 0.02,
          duration: 0.18,
          amplitude: 0.3,
        ),
      ],
      duration: 0.3,
      normalizeTo: 0.1,
    ),

    // ------------------------------------------------------------------
    // drewel_ride_request: warm ascending signature — unmistakable for a
    // driver. C5 -> E5 -> G5 -> A5 with a firmer final note.
    // ------------------------------------------------------------------
    'drewel_ride_request.wav': render(
      <Tone>[
        Tone(frequency: c5.freq, start: 0, duration: 0.34, amplitude: 0.85),
        Tone(frequency: e5.freq, start: 0.13, duration: 0.34, amplitude: 0.9),
        Tone(frequency: g5.freq, start: 0.26, duration: 0.36, amplitude: 0.95),
        Tone(
          frequency: a5.freq,
          start: 0.4,
          duration: 0.62,
          amplitude: 1.0,
          harmonicGain: 0.5,
        ),
      ],
      duration: 1.05,
      normalizeTo: 0.17,
    ),

    // ------------------------------------------------------------------
    // drewel_driver_arrived: confirming two-note resolve for passengers.
    // ------------------------------------------------------------------
    'drewel_driver_arrived.wav': render(
      <Tone>[
        Tone(frequency: e5.freq, start: 0, duration: 0.4, amplitude: 0.95),
        Tone(frequency: g5.freq, start: 0.17, duration: 0.4, amplitude: 0.85),
        Tone(
          frequency: a4.freq,
          start: 0.38,
          duration: 0.55,
          amplitude: 1.0,
          harmonicGain: 0.45,
        ),
      ],
      duration: 0.95,
      normalizeTo: 0.16,
    ),

    // ------------------------------------------------------------------
    // drewel_call: loopable ring-tone. Two quick pulses then a breathing gap.
    // ------------------------------------------------------------------
    'drewel_call.wav': render(
      <Tone>[
        Tone(
          frequency: a5.freq,
          start: 0,
          duration: 0.18,
          amplitude: 1.0,
          harmonicGain: 0.55,
        ),
        Tone(
          frequency: a5.freq,
          start: 0.22,
          duration: 0.18,
          amplitude: 0.95,
          harmonicGain: 0.5,
        ),
        Tone(
          frequency: a5.freq,
          start: 2.2,
          duration: 0.18,
          amplitude: 1.0,
          harmonicGain: 0.55,
        ),
        Tone(
          frequency: a5.freq,
          start: 2.42,
          duration: 0.18,
          amplitude: 0.95,
          harmonicGain: 0.5,
        ),
      ],
      duration: 3.2,
      normalizeTo: 0.18,
    ),

    // ------------------------------------------------------------------
    // drewel_success: bright ascending arpeggio C5-E5-G5-C6.
    // ------------------------------------------------------------------
    'drewel_success.wav': render(
      <Tone>[
        Tone(frequency: c5.freq, start: 0, duration: 0.28, amplitude: 0.8),
        Tone(frequency: e5.freq, start: 0.11, duration: 0.28, amplitude: 0.85),
        Tone(frequency: g5.freq, start: 0.22, duration: 0.3, amplitude: 0.9),
        Tone(
          frequency: c6.freq,
          start: 0.34,
          duration: 0.5,
          amplitude: 1.0,
          harmonicGain: 0.5,
        ),
      ],
      duration: 0.85,
      normalizeTo: 0.16,
    ),

    // ------------------------------------------------------------------
    // drewel_warning: low, sober double D4 with a subtle detune.
    // ------------------------------------------------------------------
    'drewel_warning.wav': render(
      <Tone>[
        Tone(frequency: d4.freq, start: 0, duration: 0.34, amplitude: 1.0),
        Tone(
          frequency: d4.freq,
          start: 0.26,
          duration: 0.42,
          amplitude: 0.9,
          detuneHz: 2.2,
        ),
        Tone(frequency: b3.freq, start: 0.26, duration: 0.42, amplitude: 0.35),
      ],
      duration: 0.72,
      normalizeTo: 0.15,
    ),
  };
}

Future<void> main() async {
  final Directory outDir = Directory('assets/sounds');
  if (!outDir.existsSync()) outDir.createSync(recursive: true);

  final Map<String, Uint8List> sounds = buildAll();
  for (final MapEntry<String, Uint8List> entry in sounds.entries) {
    final File file = File('${outDir.path}/${entry.key}');
    file.writeAsBytesSync(entry.value);
    final int kb = (entry.value.length / 1024).round();
    stdout.writeln('wrote ${file.path} (${kb} KB)');
  }
  stdout.writeln('Done: ${sounds.length} sounds generated.');
}