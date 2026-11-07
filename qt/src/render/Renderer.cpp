#include "Renderer.h"

#include "AudioMix.h"
#include "core/Async.h"
#include "core/Paths.h"
#include "services/Channels.h"
#include "services/Exports.h"
#include "services/Projects.h"
#include "services/Settings.h"

#include <QCoreApplication>
#include <QDateTime>
#include <cmath>
#include <QDir>
#include <QElapsedTimer>
#include <QAudioBuffer>
#include <QAudioBufferInput>
#include <QFile>
#include <QFileInfo>
#include <QMediaCaptureSession>
#include <QMediaFormat>
#include <QMediaRecorder>
#include <QQmlComponent>
#include <QQmlEngine>
#include <QQuickItem>
#include <QQuickRenderControl>
#include <QQuickRenderTarget>
#include <QQuickWindow>
#include <QRegularExpression>
#include <QTimer>
#include <QVideoFrame>
#include <QVideoFrameFormat>
#include <QVideoFrameInput>

#include <rhi/qrhi.h>

namespace {
int totalFrames(const QVariantMap &config)
{
    int t = 0;
    for (const QVariant &s : config.value(QStringLiteral("scenes")).toList())
        t += s.toMap().value(QStringLiteral("durationInFrames")).toInt();
    return t;
}

QMediaRecorder::Quality qualityFor(int crf, bool h265)
{
    const int base = h265 ? 6 : 0; // h265's useful CRF range sits ~6 higher
    if (crf <= 18 + base)
        return QMediaRecorder::VeryHighQuality;
    if (crf <= 23 + base)
        return QMediaRecorder::HighQuality;
    return QMediaRecorder::NormalQuality;
}
} // namespace

struct Renderer::Offscreen {
    QQuickRenderControl *rc = nullptr;
    QQuickWindow *window = nullptr;
    QQuickItem *stage = nullptr;
    QRhiTexture *tex = nullptr;
    QRhiRenderBuffer *ds = nullptr;
    QRhiTextureRenderTarget *rt = nullptr;
    QRhiRenderPassDescriptor *rp = nullptr;
    QSize size;

    void releaseTargets()
    {
        delete rt;
        rt = nullptr;
        delete rp;
        rp = nullptr;
        delete ds;
        ds = nullptr;
        delete tex;
        tex = nullptr;
    }

    ~Offscreen()
    {
        releaseTargets();
        delete stage;
        delete window;
        delete rc;
    }
};

struct Renderer::Job {
    QVariantMap payload;
    QString filename;
    QString finalPath;
    QString tmpPath;
    QString format;
    QString projectId;
    int renderFps = 30;
    double sourcePerOutput = 1.0; // source frames advanced per output frame
    int outFrames = 0;
    int next = 0;
    bool canceled = false;
    bool waitingForInput = false;
    QJSValue callback;
    QMediaCaptureSession session;
    QMediaRecorder recorder;
    QVideoFrameInput *input = nullptr;
    QAudioBufferInput *audio = nullptr;
    QVector<float> pcm;          // interleaved stereo float, whole ad
    qint64 audioSent = 0;        // sample frames already handed to the encoder
    QString error;
};

Renderer::Renderer(QObject *parent)
    : QObject(parent)
{
    registerInstance();
}

Renderer::~Renderer() = default;

QString Renderer::currentFile() const { return m_job ? m_job->filename : QString(); }

void Renderer::setPhase(const QString &p)
{
    m_phase = p;
    emit stateChanged();
}

QString Renderer::sanitizeFilename(const QString &name)
{
    QString n = name.trimmed();
    if (n.isEmpty())
        n = QStringLiteral("screenlet-%1").arg(QDateTime::currentMSecsSinceEpoch());
    if (!n.endsWith(QLatin1String(".mp4"), Qt::CaseInsensitive))
        n += QStringLiteral(".mp4");
    // Keep accents readable (unlike the Electron build) but drop anything a
    // filesystem or URL would choke on.
    n.replace(QRegularExpression(QStringLiteral("[\\\\/:*?\"<>|#%&{}$!'@`=+]")), QStringLiteral("_"));
    return n;
}

// ── Offscreen scene ───────────────────────────────────────────────────────────

bool Renderer::ensureOffscreen(const QSize &size, QString *error)
{
    if (!m_engine) {
        *error = QStringLiteral("Motor QML indisponível.");
        return false;
    }
    if (!m_off) {
        auto off = std::make_unique<Offscreen>();
        off->rc = new QQuickRenderControl();
        off->window = new QQuickWindow(off->rc);
        off->window->setColor(Qt::black);
        QQmlComponent component(m_engine);
        component.loadFromModule("Screenlet", "AdStage");
        QObject *obj = component.create();
        off->stage = qobject_cast<QQuickItem *>(obj);
        if (!off->stage) {
            *error = QStringLiteral("Falha ao carregar a cena: %1").arg(component.errorString());
            delete obj;
            return false;
        }
        off->stage->setProperty("exportMode", true);
        off->stage->setParentItem(off->window->contentItem());
        if (!off->rc->initialize()) {
            *error = QStringLiteral("Não foi possível iniciar a renderização por GPU.");
            return false;
        }
        m_off = std::move(off);
    }
    if (m_off->size == size && m_off->rt)
        return true;

    QRhi *rhi = m_off->rc->rhi();
    m_off->releaseTargets();
    m_off->tex = rhi->newTexture(QRhiTexture::RGBA8, size, 1, QRhiTexture::RenderTarget | QRhiTexture::UsedAsTransferSource);
    if (!m_off->tex->create()) {
        *error = QStringLiteral("Falha ao criar a textura de renderização.");
        return false;
    }
    m_off->ds = rhi->newRenderBuffer(QRhiRenderBuffer::DepthStencil, size, 1);
    m_off->ds->create();
    QRhiTextureRenderTargetDescription desc{QRhiColorAttachment(m_off->tex)};
    desc.setDepthStencilBuffer(m_off->ds);
    m_off->rt = rhi->newTextureRenderTarget(desc);
    m_off->rp = m_off->rt->newCompatibleRenderPassDescriptor();
    m_off->rt->setRenderPassDescriptor(m_off->rp);
    if (!m_off->rt->create()) {
        *error = QStringLiteral("Falha ao criar o alvo de renderização.");
        return false;
    }
    m_off->window->setRenderTarget(QQuickRenderTarget::fromRhiRenderTarget(m_off->rt));
    m_off->window->setGeometry(0, 0, size.width(), size.height());
    m_off->window->contentItem()->setSize(size);
    m_off->stage->setSize(size);
    m_off->size = size;
    return true;
}

bool Renderer::renderFrame(int frame, QImage *out, QString *error)
{
    QQuickItem *stage = m_off->stage;
    stage->setProperty("frame", frame);

    // Wait (bounded) until every image/video of this frame reports ready.
    QElapsedTimer t;
    t.start();
    do {
        QCoreApplication::processEvents(QEventLoop::AllEvents, 5);
    } while (!stage->property("ready").toBool() && t.elapsed() < 8000);

    QQuickRenderControl *rc = m_off->rc;
    rc->polishItems();
    rc->beginFrame();
    rc->sync();
    rc->render();
    QRhiReadbackResult readback;
    QRhiResourceUpdateBatch *batch = rc->rhi()->nextResourceUpdateBatch();
    batch->readBackTexture(m_off->tex, &readback);
    rc->commandBuffer()->resourceUpdate(batch);
    rc->endFrame();

    if (readback.data.isEmpty()) {
        *error = QStringLiteral("Falha ao ler o quadro renderizado.");
        return false;
    }
    QImage img(reinterpret_cast<const uchar *>(readback.data.constData()), readback.pixelSize.width(),
               readback.pixelSize.height(), QImage::Format_RGBA8888_Premultiplied);
    *out = rc->rhi()->isYUpInFramebuffer() ? img.flipped(Qt::Vertical) : img.copy();
    return true;
}

// ── Export ────────────────────────────────────────────────────────────────────

void Renderer::exportVideo(const QVariantMap &payload, const QString &filename, int fps, const QString &format,
                           const QString &projectId, QJSValue callback)
{
    if (m_job || m_preparing) {
        Async::invoke(callback, Async::fail(QStringLiteral("Já existe uma renderização em andamento.")));
        return;
    }
    const int sourceFrames = totalFrames(payload);
    if (sourceFrames <= 0) {
        Async::invoke(callback, Async::fail(QStringLiteral("Adicione ao menos uma cena antes de renderizar.")));
        return;
    }
    const int w = payload.value(QStringLiteral("width")).toInt();
    const int h = payload.value(QStringLiteral("height")).toInt();
    const QSize size(w > 0 ? w : 1920, h > 0 ? h : 1080);
    QString error;
    if (!ensureOffscreen(size, &error)) {
        Async::invoke(callback, Async::fail(error));
        return;
    }

    auto job = std::make_unique<Job>();
    job->payload = payload;
    job->filename = sanitizeFilename(filename);
    job->finalPath = QDir(Paths::exports()).filePath(job->filename);
    job->tmpPath = QDir(Paths::exports()).filePath(QStringLiteral(".rendering-") + job->filename);
    job->format = format;
    job->projectId = projectId;
    job->callback = callback;
    job->renderFps = fps == 60 ? 60 : 30;
    const int sourceFps = payload.value(QStringLiteral("fps")).toInt() > 0 ? payload.value(QStringLiteral("fps")).toInt() : 30;
    // Durations are authored in source frames; keep the SAME length in
    // seconds at 60 fps (the Electron build halved it).
    job->sourcePerOutput = double(sourceFps) / job->renderFps;
    job->outFrames = int(std::ceil(sourceFrames / job->sourcePerOutput));

    // Sound of video scenes / template video layers, mixed up front.
    const QList<AudioMix::Clip> clips = AudioMix::collectClips(payload);
    if (!clips.isEmpty()) {
        m_preparing = true;
        setPhase(QStringLiteral("audio"));
        job->pcm = AudioMix::mix(clips, double(job->outFrames) / job->renderFps, [this](double p) {
            m_progress = p * 0.05;
            emit progressChanged();
        });
        m_preparing = false;
        if (std::all_of(job->pcm.cbegin(), job->pcm.cend(), [](float v) { return v == 0.f; }))
            job->pcm.clear(); // nothing audible decoded
    }

    const bool h265 = Settings::instance()->videoCodec() == QLatin1String("h265");
    QMediaFormat mf(QMediaFormat::MPEG4);
    mf.setVideoCodec(h265 ? QMediaFormat::VideoCodec::H265 : QMediaFormat::VideoCodec::H264);
    mf.setAudioCodec(job->pcm.isEmpty() ? QMediaFormat::AudioCodec::Unspecified : QMediaFormat::AudioCodec::AAC);
    job->recorder.setMediaFormat(mf);
    job->recorder.setQuality(qualityFor(Settings::instance()->crf(), h265));
    job->recorder.setVideoResolution(size);
    job->recorder.setVideoFrameRate(job->renderFps);
    QFile::remove(job->tmpPath);
    job->recorder.setOutputLocation(QUrl::fromLocalFile(job->tmpPath));

    QVideoFrameFormat vf(size, QVideoFrameFormat::Format_RGBA8888);
    vf.setStreamFrameRate(job->renderFps);
    job->input = new QVideoFrameInput(vf, this);
    job->session.setVideoFrameInput(job->input);
    if (!job->pcm.isEmpty()) {
        job->audio = new QAudioBufferInput(AudioMix::format(), this);
        job->session.setAudioBufferInput(job->audio);
    }
    job->session.setRecorder(&job->recorder);

    Job *raw = job.get();
    if (job->audio)
        connect(job->audio, &QAudioBufferInput::readyToSendAudioBuffer, this, [this, raw] {
            if (m_job.get() == raw && raw->waitingForInput) {
                raw->waitingForInput = false;
                QTimer::singleShot(0, this, &Renderer::step);
            }
        });
    connect(job->input, &QVideoFrameInput::readyToSendVideoFrame, this, [this, raw] {
        if (m_job.get() == raw && raw->waitingForInput) {
            raw->waitingForInput = false;
            QTimer::singleShot(0, this, &Renderer::step);
        }
    });
    connect(&job->recorder, &QMediaRecorder::errorOccurred, this, [raw](QMediaRecorder::Error, const QString &msg) {
        raw->error = msg;
    });
    connect(&job->recorder, &QMediaRecorder::recorderStateChanged, this, [this, raw](QMediaRecorder::RecorderState s) {
        if (s != QMediaRecorder::StoppedState || m_job.get() != raw)
            return;
        if (raw->canceled) {
            QFile::remove(raw->tmpPath);
            finishJob(Async::fail(QStringLiteral("Renderização cancelada.")));
            return;
        }
        if (!raw->error.isEmpty() || !QFileInfo::exists(raw->tmpPath)) {
            QFile::remove(raw->tmpPath);
            finishJob(Async::fail(raw->error.isEmpty() ? QStringLiteral("O codificador não gerou o arquivo.") : raw->error));
            return;
        }
        // Overwrite on purpose: channels that use this file pick it up.
        QFile::remove(raw->finalPath);
        if (!QFile::rename(raw->tmpPath, raw->finalPath)) {
            finishJob(Async::fail(QStringLiteral("Não foi possível salvar o vídeo em Vídeos prontos.")));
            return;
        }
        const QVariantList updated = Channels::instance()->resyncChannelsUsing(raw->filename);
        Projects::instance()->recordExport(raw->projectId, raw->filename, raw->format, raw->renderFps);
        Exports::instance()->refresh();
        finishJob(Async::ok({{QStringLiteral("filename"), raw->filename}, {QStringLiteral("updatedChannels"), updated}}));
    });

    m_job = std::move(job);
    m_off->stage->setProperty("config", payload);
    m_progress = 0;
    emit progressChanged();
    setPhase(QStringLiteral("rendering"));
    m_job->recorder.record();
    QTimer::singleShot(0, this, &Renderer::step);
}

void Renderer::step()
{
    Job *job = m_job.get();
    if (!job || job->waitingForInput)
        return;
    if (job->canceled || !job->error.isEmpty()) {
        job->recorder.stop();
        return;
    }
    // Audio first: everything up to the end of this frame (or the whole
    // track once the last frame is out), so both streams stay interleaved.
    if (job->audio) {
        const qint64 total = job->pcm.size() / AudioMix::kChannels;
        const qint64 target = job->next >= job->outFrames
                                  ? total
                                  : std::min<qint64>(total, qint64(job->next + 1) * AudioMix::kSampleRate / job->renderFps);
        const QAudioFormat af = AudioMix::format();
        while (job->audioSent < target) {
            const qint64 n = std::min<qint64>(target - job->audioSent, 4096);
            const QByteArray bytes(reinterpret_cast<const char *>(job->pcm.constData() + job->audioSent * AudioMix::kChannels),
                                   n * AudioMix::kChannels * qsizetype(sizeof(float)));
            const QAudioBuffer buf(bytes, af, job->audioSent * 1000000 / AudioMix::kSampleRate);
            if (!job->audio->sendAudioBuffer(buf)) {
                job->waitingForInput = true; // resumes on readyToSendAudioBuffer
                return;
            }
            job->audioSent += n;
        }
    }
    if (job->next >= job->outFrames) {
        setPhase(QStringLiteral("finalizing"));
        job->recorder.stop();
        return;
    }
    QImage img;
    QString error;
    // Fractional source frame: the QML scene math is continuous in time.
    const double srcFrame = job->next * job->sourcePerOutput;
    m_off->stage->setProperty("frameExact", srcFrame);
    if (!renderFrame(int(std::floor(srcFrame)), &img, &error)) {
        job->error = error;
        job->recorder.stop();
        return;
    }
    QVideoFrame vf(img);
    const qint64 us = qint64(job->next) * 1000000 / job->renderFps;
    vf.setStartTime(us);
    vf.setEndTime(us + 1000000 / job->renderFps);
    if (!job->input->sendVideoFrame(vf)) {
        job->waitingForInput = true; // resumes on readyToSendVideoFrame
        return;
    }
    ++job->next;
    m_progress = (job->pcm.isEmpty() ? 0.0 : 0.05) + double(job->next) / job->outFrames * (job->pcm.isEmpty() ? 1.0 : 0.95);
    emit progressChanged();
    QTimer::singleShot(0, this, &Renderer::step);
}

void Renderer::cancel()
{
    if (m_job)
        m_job->canceled = true;
}

void Renderer::finishJob(const QVariantMap &result)
{
    // We are inside a signal of job->recorder: destroy the job (recorder,
    // session, input) only after the current emission has unwound.
    Job *job = m_job.release();
    QJSValue cb = job->callback;
    QTimer::singleShot(0, this, [job] {
        QVideoFrameInput *input = job->input;
        QAudioBufferInput *audio = job->audio;
        delete job;
        delete input;
        delete audio;
    });
    m_progress = 0;
    m_phase.clear();
    emit progressChanged();
    emit stateChanged();
    Async::invoke(cb, result);
    emit exportFinished(result);
    startNextThumbnail();
}

// ── Thumbnails ────────────────────────────────────────────────────────────────

void Renderer::renderThumbnail(const QString &projectId, const QVariantMap &config)
{
    for (auto &q : m_thumbQueue)
        if (q.first == projectId) {
            q.second = config;
            return;
        }
    m_thumbQueue.enqueue({projectId, config});
    QTimer::singleShot(300, this, &Renderer::startNextThumbnail);
}

void Renderer::startNextThumbnail()
{
    if (m_thumbRunning || m_job || m_thumbQueue.isEmpty())
        return;
    m_thumbRunning = true;
    const auto [id, config] = m_thumbQueue.dequeue();
    const int frames = totalFrames(config);
    QString error;
    QImage img;
    if (frames > 0 && ensureOffscreen(QSize(1920, 1080), &error)) {
        QVariantMap c = config;
        c.insert(QStringLiteral("width"), 1920);
        c.insert(QStringLiteral("height"), 1080);
        m_off->stage->setProperty("config", c);
        m_off->stage->setProperty("frameExact", double(frames / 2));
        if (renderFrame(frames / 2, &img, &error)) {
            Paths::ensureDir(Paths::projectThumbs());
            img.scaledToWidth(640, Qt::SmoothTransformation)
                .convertToFormat(QImage::Format_RGB888)
                .save(QDir(Paths::projectThumbs()).filePath(Paths::safeName(id) + QStringLiteral(".jpg")), "JPG", 82);
            Projects::instance()->setThumbnailReady(id);
        }
    }
    m_thumbRunning = false;
    if (!m_thumbQueue.isEmpty())
        QTimer::singleShot(50, this, &Renderer::startNextThumbnail);
}
