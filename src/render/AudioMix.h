#pragma once

#include <QAudioFormat>
#include <QList>
#include <QString>
#include <QVariantMap>
#include <QVector>

#include <functional>

// Audio track of an exported ad: the sound of every video scene and every
// template video layer, placed on the ad timeline with its volume and mixed
// into one 48 kHz stereo float buffer.
namespace AudioMix {

constexpr int kSampleRate = 48000;
constexpr int kChannels = 2;

struct Clip {
    QString path;          // absolute file path
    double timelineStart;  // seconds on the ad timeline
    double sourceStart;    // seconds into the source file
    double length;         // seconds
    float volume;          // 0..1
};

QAudioFormat format();

// Every audible clip in an AdConfig (durations in source frames at config fps).
QList<Clip> collectClips(const QVariantMap &config);

// Decodes `path` to interleaved stereo float at kSampleRate. Runs a local
// event loop (keeps the UI responsive); false when the file has no audio.
bool decode(const QString &path, QVector<float> *out, QString *error);

// Mixes all clips into a buffer `totalSeconds` long (hard-limited to ±1).
// `progress(0..1)` is reported while files decode.
QVector<float> mix(const QList<Clip> &clips, double totalSeconds, const std::function<void(double)> &progress = {});

} // namespace AudioMix
