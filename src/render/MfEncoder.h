#pragma once

#include <QImage>
#include <QSize>
#include <QString>
#include <QStringList>

#include <memory>

// Windows only: H.264/H.265 + AAC MP4 through Media Foundation's sink writer
// with hardware transforms enabled — NVIDIA NVENC, AMD AMF/VCN and Intel
// Quick Sync all ship an encoder MFT that it picks up.
//
// Qt's FFmpeg backend can't do this on Windows: its FFmpeg build has no
// nvenc/amf/qsv, and it opens h264_mf without `hw_encoding`, which lands on
// Microsoft's software encoder.
class MfEncoder
{
public:
    struct Options {
        QSize size;
        int fps = 30;
        bool h265 = false;
        int bitrate = 10'000'000;   // bits/s, VBR target
        bool audio = false;          // 48 kHz stereo (AudioMix format)
        bool hardware = true;        // false → Microsoft's software MFT
        int adapterIndex = -1;       // DXGI index for the encoder; -1 = default
    };

    MfEncoder();
    ~MfEncoder();

    bool open(const QString &path, const Options &opt, QString *error);
    bool writeVideo(const QImage &frame, qint64 index, QString *error);
    // Interleaved stereo float; `startFrame` in sample frames.
    bool writeAudio(const float *pcm, qint64 frames, qint64 startFrame, QString *error);
    bool finish(QString *error);
    void abort();

    QString encoderName() const { return m_encoderName; }
    bool isHardware() const { return m_hardware; }

    // Friendly names of the hardware encoders installed (e.g. "NVIDIA H.264
    // Encoder MFT"). Empty on other platforms.
    static QStringList hardwareEncoders(bool h265);

private:
    struct D;
    std::unique_ptr<D> d;
    QString m_encoderName;
    bool m_hardware = false;
};
