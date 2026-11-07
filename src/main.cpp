#include "core/AppContext.h"
#include "core/Async.h"
#include "core/Paths.h"
#include "render/Gpu.h"
#include "render/Renderer.h"
#include "services/Settings.h"
#include "services/SystemInfo.h"

#include <QAction>
#include <QApplication>
#include <QDirIterator>
#include <QFontDatabase>
#include <QIcon>
#include <QLocalServer>
#include <QLocalSocket>
#include <QMenu>
#include <QQmlApplicationEngine>
#include <QQuickStyle>
#include <QQuickWindow>
#include <QSGRendererInterface>
#include <QTimer>
#include <QSystemTrayIcon>
#include <QtPlugin>

#include <rhi/qrhi.h>

#ifdef SCREENLET_SYSTEM_IMAGEIO
Q_IMPORT_PLUGIN(SystemImageIOPlugin)
#endif

namespace {
const QString kInstanceKey = QStringLiteral("com.screenlet.app.instance");

// Single instance: a second launch just asks the first to show its window.
bool notifyRunningInstance()
{
    QLocalSocket socket;
    socket.connectToServer(kInstanceKey);
    if (!socket.waitForConnected(300))
        return false;
    socket.write("show");
    socket.waitForBytesWritten(300);
    return true;
}

void loadBundledFonts()
{
    QDirIterator it(QStringLiteral(":/qt/qml/Screenlet/fonts"), {QStringLiteral("*.ttf"), QStringLiteral("*.otf")}, QDir::Files);
    while (it.hasNext())
        QFontDatabase::addApplicationFont(it.next());
}
} // namespace

int main(int argc, char *argv[])
{
    QApplication::setApplicationName(QStringLiteral("Screenlet"));
    QApplication::setOrganizationName(QStringLiteral("Screenlet"));
    QApplication::setOrganizationDomain(QStringLiteral("screenlet.app"));
    QApplication::setApplicationVersion(QStringLiteral(SCREENLET_VERSION));
    QApplication app(argc, argv);
    QApplication::setWindowIcon(QIcon(QStringLiteral(":/qt/qml/Screenlet/resources/icon.png")));
    QApplication::setQuitOnLastWindowClosed(false);

    // Automated dev runs (snapshot / test export) may coexist with a normal
    // instance; everything else is single-instance.
    const bool devRun = qEnvironmentVariableIsSet("SCREENLET_SNAPSHOT") || qEnvironmentVariableIsSet("SCREENLET_TEST_EXPORT");
    QLocalServer instanceServer;
    if (!devRun) {
        if (notifyRunningInstance())
            return 0;
        QLocalServer::removeServer(kInstanceKey);
        instanceServer.listen(kInstanceKey);
    }

    Paths::init();
    QQuickStyle::setStyle(QStringLiteral("Basic"));
    loadBundledFonts();

    auto *context = new AppContext(&app);
    const bool startedHidden = app.arguments().contains(QStringLiteral("--hidden"));
    SystemInfo::instance()->setStartedHidden(startedHidden);

    // Graphics API / GPU / encoder from Configurações — before any window.
    Gpu::applyAtStartup();

    QQmlApplicationEngine engine;
    Async::engine() = &engine;
    Renderer::instance()->setEngine(&engine);

    QObject::connect(&instanceServer, &QLocalServer::newConnection, &app, [&instanceServer] {
        while (QLocalSocket *s = instanceServer.nextPendingConnection()) {
            QObject::connect(s, &QLocalSocket::disconnected, s, &QObject::deleteLater);
            SystemInfo::instance()->requestShowWindow();
        }
    });

    // Tray: closing the window keeps the IPTV server and players served.
    QSystemTrayIcon *tray = nullptr;
    QMenu trayMenu;
    if (QSystemTrayIcon::isSystemTrayAvailable()) {
        tray = new QSystemTrayIcon(QIcon(QStringLiteral(":/qt/qml/Screenlet/resources/tray.png")), &app);
        tray->setToolTip(QStringLiteral("Screenlet"));
        QObject::connect(trayMenu.addAction(QStringLiteral("Abrir Screenlet")), &QAction::triggered, &app,
                         [] { SystemInfo::instance()->requestShowWindow(); });
        trayMenu.addSeparator();
        QObject::connect(trayMenu.addAction(QStringLiteral("Sair")), &QAction::triggered, &app,
                         [] { SystemInfo::instance()->quitApp(); });
        tray->setContextMenu(&trayMenu);
        QObject::connect(tray, &QSystemTrayIcon::activated, &app, [](QSystemTrayIcon::ActivationReason r) {
            if (r == QSystemTrayIcon::Trigger || r == QSystemTrayIcon::DoubleClick)
                SystemInfo::instance()->requestShowWindow();
        });
        tray->show();
        SystemInfo::instance()->setTrayAvailable(true);
    }

    QObject::connect(&engine, &QQmlApplicationEngine::objectCreationFailed, &app,
                     [] { QCoreApplication::exit(-1); }, Qt::QueuedConnection);
    engine.loadFromModule("Screenlet", "Main");

    // Report the API and GPU really in use (Configurações → Vídeo).
    if (auto *w = engine.rootObjects().isEmpty() ? nullptr : qobject_cast<QQuickWindow *>(engine.rootObjects().first())) {
        QObject::connect(w, &QQuickWindow::sceneGraphInitialized, w, [w] {
            static const QHash<int, QString> names = {
                {QSGRendererInterface::Direct3D11, QStringLiteral("Direct3D 11")},
                {QSGRendererInterface::Direct3D12, QStringLiteral("Direct3D 12")},
                {QSGRendererInterface::Vulkan, QStringLiteral("Vulkan")},
                {QSGRendererInterface::Metal, QStringLiteral("Metal")},
                {QSGRendererInterface::OpenGL, QStringLiteral("OpenGL")},
                {QSGRendererInterface::Software, QStringLiteral("Software")},
            };
            const QString api = names.value(w->rendererInterface()->graphicsApi(), QStringLiteral("?"));
            const QString gpu = w->rhi() ? QString::fromUtf8(w->rhi()->driverInfo().deviceName) : QString();
            QMetaObject::invokeMethod(SystemInfo::instance(), [api, gpu] {
                qInfo().noquote() << "Graphics:" << api << "·" << gpu;
                SystemInfo::instance()->setGraphicsInfo(api, gpu);
            },
                                      Qt::QueuedConnection);
        }, Qt::DirectConnection);
        // The chosen API passed the probe but the window still can't render
        // with it: go back to the platform default instead of a dead window.
        QObject::connect(w, &QQuickWindow::sceneGraphError, &app, [](QQuickWindow::SceneGraphError, const QString &msg) {
            qWarning().noquote() << "Scene graph error:" << msg;
            if (Settings::instance()->graphicsApi() != QLatin1String("auto")) {
                Settings::instance()->setGraphicsApi(QStringLiteral("auto"));
                SystemInfo::instance()->relaunch();
            }
        });
    }

    context->startBackground(startedHidden);

    // Dev aid: SCREENLET_SNAPSHOT=<png> [SCREENLET_PAGE=<page>] grabs the
    // window after SCREENLET_SNAPSHOT_DELAY ms (default 2500) and quits.
    const QString snapshot = qEnvironmentVariable("SCREENLET_SNAPSHOT");
    if (!snapshot.isEmpty()) {
        const int delay = qEnvironmentVariableIntValue("SCREENLET_SNAPSHOT_DELAY");
        QTimer::singleShot(delay > 0 ? delay : 2500, &app, [&engine, snapshot] {
            if (auto *w = engine.rootObjects().isEmpty() ? nullptr : qobject_cast<QQuickWindow *>(engine.rootObjects().first()))
                w->grabWindow().save(snapshot);
            QCoreApplication::exit(0);
        });
    }
    const int code = QApplication::exec();
    Async::engine() = nullptr;
    return code;
}
