#include "core/AppContext.h"
#include "core/Async.h"
#include "core/Paths.h"
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
#include <QTimer>
#include <QSystemTrayIcon>
#include <QtPlugin>

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

    // Hardware encoding off → keep the FFmpeg backend on software encoders.
    if (!Settings::instance()->hardwareAcceleration())
        qputenv("QT_FFMPEG_ENCODING_HW_DEVICE_TYPES", ",");

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
