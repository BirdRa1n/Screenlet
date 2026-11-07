#include "AudioMix.h"

#include "core/Paths.h"
#include "services/Templates.h"

#include <QAudioBuffer>
#include <QAudioDecoder>
#include <QEventLoop>
#include <QFileInfo>
#include <QHash>
#include <QTimer>
#include <QUrl>

#include <algorithm>
#include <cmath>

namespace AudioMix {

QAudioFormat format()
{
    QAudioFormat f;
    f.setSampleRate(kSampleRate);
    f.setChannelCount(kChannels);
    f.setChannelConfig(QAudioFormat::ChannelConfigStereo);
    f.setSampleFormat(QAudioFormat::Float);
    return f;
}

QList<Clip> collectClips(const QVariantMap &config)
{
    QList<Clip> clips;
    const double fps = config.value(QStringLiteral("fps")).toDouble() > 0 ? config.value(QStringLiteral("fps")).toDouble() : 30.0;
    double sceneStart = 0; // source frames

    auto add = [&](const QString &stored, double startFrames, double sourceFrames, double lengthFrames, double volume) {
        if (stored.isEmpty() || volume <= 0.0 || lengthFrames <= 0)
            return;
        const QString path = Paths::resolveMedia(stored);
        if (path.startsWith(QLatin1Char(':')) || !QFileInfo::exists(path))
            return;
        clips.append({path, startFrames / fps, sourceFrames / fps, lengthFrames / fps, float(std::min(1.0, volume))});
    };

    for (const QVariant &v : config.value(QStringLiteral("scenes")).toList()) {
        const QVariantMap s = v.toMap();
        const double dur = s.value(QStringLiteral("durationInFrames")).toDouble();
        const QString type = s.value(QStringLiteral("type")).toString();

        if (type == QLatin1String("video")) {
            const QVariant vol = s.value(QStringLiteral("volume"));
            add(s.value(QStringLiteral("src")).toString(), sceneStart, 0, dur, vol.isValid() ? vol.toDouble() : 1.0);
        } else if (type == QLatin1String("template")) {
            // Mirrors TemplateScene/LayerItem: inner scenes play in sequence,
            // a video layer shows the source at (sceneFrame + startFrom).
            const QVariantMap tpl = Templates::instance()->find(s.value(QStringLiteral("templateId")).toString());
            double inner = 0;
            for (const QVariant &ts : tpl.value(QStringLiteral("scenes")).toList()) {
                const QVariantMap tsc = ts.toMap();
                const double tdur = tsc.value(QStringLiteral("durationInFrames")).toDouble();
                if (inner >= dur)
                    break;
                for (const QVariant &lv : tsc.value(QStringLiteral("layers")).toList()) {
                    const QVariantMap l = lv.toMap();
                    if (l.value(QStringLiteral("type")).toString() != QLatin1String("video") || l.value(QStringLiteral("visible")).toBool() == false)
                        continue;
                    const double ls = l.value(QStringLiteral("startFrame")).toDouble();
                    const QVariant endV = l.value(QStringLiteral("endFrame"));
                    const double le = endV.isNull() || !endV.isValid() ? tdur : endV.toDouble();
                    const double visibleEnd = std::min({le, tdur, dur - inner});
                    add(l.value(QStringLiteral("src")).toString(), sceneStart + inner + ls,
                        ls + l.value(QStringLiteral("startFrom")).toDouble(), visibleEnd - ls,
                        l.value(QStringLiteral("volume")).toDouble());
                }
                inner += tdur;
            }
        }
        sceneStart += dur;
    }
    return clips;
}

bool decode(const QString &path, QVector<float> *out, QString *error)
{
    out->clear();
    QAudioDecoder decoder;
    decoder.setAudioFormat(format());
    decoder.setSource(QUrl::fromLocalFile(path));

    QEventLoop loop;
    bool failed = false;
    QObject::connect(&decoder, &QAudioDecoder::bufferReady, &loop, [&] {
        const QAudioBuffer buf = decoder.read();
        if (!buf.isValid())
            return;
        const QAudioFormat bf = buf.format();
        const qsizetype frames = buf.frameCount();
        const int ch = std::max(1, bf.channelCount());
        const qsizetype base = out->size();
        out->resize(base + frames * kChannels);
        float *dst = out->data() + base;
        // The backend honors the requested format, but stay robust to the
        // common alternatives (int16, mono).
        for (qsizetype i = 0; i < frames; ++i) {
            for (int c = 0; c < kChannels; ++c) {
                const int sc = std::min(c, ch - 1);
                float s = 0.f;
                switch (bf.sampleFormat()) {
                case QAudioFormat::Float: s = buf.constData<float>()[i * ch + sc]; break;
                case QAudioFormat::Int16: s = buf.constData<qint16>()[i * ch + sc] / 32768.f; break;
                case QAudioFormat::Int32: s = float(buf.constData<qint32>()[i * ch + sc] / 2147483648.0); break;
                case QAudioFormat::UInt8: s = (buf.constData<quint8>()[i * ch + sc] - 128) / 128.f; break;
                default: break;
                }
                dst[i * kChannels + c] = s;
            }
        }
    });
    QObject::connect(&decoder, &QAudioDecoder::finished, &loop, &QEventLoop::quit);
    QObject::connect(&decoder, qOverload<QAudioDecoder::Error>(&QAudioDecoder::error), &loop, [&](QAudioDecoder::Error) {
        failed = true;
        if (error)
            *error = decoder.errorString();
        loop.quit();
    });
    QTimer::singleShot(120000, &loop, [&] {
        failed = true;
        if (error)
            *error = QStringLiteral("Tempo esgotado ao decodificar o áudio.");
        loop.quit();
    });
    decoder.start();
    loop.exec();
    decoder.stop();
    return !failed && !out->isEmpty();
}

QVector<float> mix(const QList<Clip> &clips, double totalSeconds, const std::function<void(double)> &progress)
{
    const qsizetype totalFrames = qsizetype(std::ceil(totalSeconds * kSampleRate));
    QVector<float> outBuf(totalFrames * kChannels, 0.f);

    QHash<QString, QVector<float>> cache;
    QStringList order;
    for (const Clip &c : clips)
        if (!order.contains(c.path))
            order.append(c.path);
    for (int i = 0; i < order.size(); ++i) {
        QVector<float> pcm;
        QString err;
        if (decode(order.at(i), &pcm, &err))
            cache.insert(order.at(i), std::move(pcm));
        else
            qWarning("[audio] sem áudio em %s: %s", qPrintable(order.at(i)), qPrintable(err));
        if (progress)
            progress(double(i + 1) / order.size());
    }

    for (const Clip &c : clips) {
        const auto it = cache.constFind(c.path);
        if (it == cache.constEnd())
            continue;
        const QVector<float> &src = *it;
        const qsizetype srcFrames = src.size() / kChannels;
        const qsizetype dst0 = qsizetype(std::llround(c.timelineStart * kSampleRate));
        const qsizetype src0 = qsizetype(std::llround(c.sourceStart * kSampleRate));
        const qsizetype n = qsizetype(std::llround(c.length * kSampleRate));
        // Short fades at clip edges avoid clicks at scene cuts.
        const qsizetype fade = std::min<qsizetype>(kSampleRate / 100, n / 2);
        for (qsizetype i = 0; i < n; ++i) {
            const qsizetype d = dst0 + i, s = src0 + i;
            if (d < 0 || d >= totalFrames || s < 0)
                continue;
            if (s >= srcFrames)
                break;
            float g = c.volume;
            if (fade > 0 && i < fade)
                g *= float(i) / fade;
            else if (fade > 0 && i > n - fade)
                g *= float(n - i) / fade;
            outBuf[d * 2] += src[s * 2] * g;
            outBuf[d * 2 + 1] += src[s * 2 + 1] * g;
        }
    }
    for (float &v : outBuf)
        v = std::clamp(v, -1.f, 1.f);
    return outBuf;
}

} // namespace AudioMix
