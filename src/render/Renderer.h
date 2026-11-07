#pragma once

#include "core/AppContext.h"

#include <QImage>
#include <QJSValue>
#include <QObject>
#include <QQueue>
#include <QVariantMap>
#include <QtQml/qqmlregistration.h>

#include <memory>

class QQmlEngine;

// Native video renderer — replaces Remotion + headless Chrome.
//
// The SAME QML scene used for the live preview (AdStage.qml) is instantiated
// in an offscreen QQuickWindow driven by QQuickRenderControl. For every
// frame we set `frame`, wait until images/videos for that frame are ready,
// render into an RHI texture, read it back and feed it to QMediaRecorder via
// QVideoFrameInput (FFmpeg backend → H.264/H.265 MP4).
//
// Frames are produced cooperatively on the GUI thread (one per event-loop
// turn) so the UI stays responsive during an export.
class Renderer : public QObject
{
    Q_OBJECT
    QML_ELEMENT
    QML_SINGLETON
    SL_SINGLETON(Renderer)
    Q_PROPERTY(bool busy READ busy NOTIFY stateChanged)
    Q_PROPERTY(double progress READ progress NOTIFY progressChanged)
    Q_PROPERTY(QString phase READ phase NOTIFY stateChanged)
    Q_PROPERTY(QString currentFile READ currentFile NOTIFY stateChanged)

public:
    explicit Renderer(QObject *parent);
    ~Renderer() override;

    void setEngine(QQmlEngine *engine) { m_engine = engine; }

    bool busy() const { return m_job != nullptr || m_preparing; }
    double progress() const { return m_progress; }
    QString phase() const { return m_phase; }
    QString currentFile() const;

    // payload: AdConfig (+width/height of the chosen format). Overwrites an
    // existing file of the same name on purpose (channels using it resync).
    // callback({ok, filename, updatedChannels} | {ok:false, error})
    Q_INVOKABLE void exportVideo(const QVariantMap &payload, const QString &filename, int fps,
                                 const QString &format, const QString &projectId, QJSValue callback);
    Q_INVOKABLE void cancel();

    // Best-effort JPEG of the middle frame (project grid).
    void renderThumbnail(const QString &projectId, const QVariantMap &config);

    static QString sanitizeFilename(const QString &name);

signals:
    void stateChanged();
    void progressChanged();
    void exportFinished(const QVariantMap &result);

private:
    struct Job;
    struct Offscreen;
    void startNextThumbnail();
    bool ensureOffscreen(const QSize &size, QString *error);
    bool renderFrame(int frame, QImage *out, QString *error);
    void step();
    void finishJob(const QVariantMap &result);
    void setPhase(const QString &p);

    QQmlEngine *m_engine = nullptr;
    std::unique_ptr<Offscreen> m_off;
    std::unique_ptr<Job> m_job;
    double m_progress = 0;
    QString m_phase;
    QQueue<QPair<QString, QVariantMap>> m_thumbQueue;
    bool m_thumbRunning = false;
    bool m_preparing = false;   // mixing audio before the job starts
};
