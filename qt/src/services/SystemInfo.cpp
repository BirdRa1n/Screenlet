#include "SystemInfo.h"

#include "core/Paths.h"

#include <QClipboard>
#include <QCoreApplication>
#include <QDesktopServices>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QGuiApplication>
#include <QHostInfo>
#include <QProcess>
#include <QSysInfo>
#include <QThread>
#include <QTimer>
#include <QUrl>

#include <algorithm>
#include <cmath>

#if defined(Q_OS_MACOS)
#include <sys/sysctl.h>
#include <mach/mach.h>
#elif defined(Q_OS_WIN)
#include <windows.h>
#else
#include <unistd.h>
#endif

namespace {
double totalRamGb()
{
#if defined(Q_OS_MACOS)
    int64_t mem = 0;
    size_t len = sizeof(mem);
    sysctlbyname("hw.memsize", &mem, &len, nullptr, 0);
    return double(mem) / (1024.0 * 1024 * 1024);
#elif defined(Q_OS_WIN)
    MEMORYSTATUSEX s{};
    s.dwLength = sizeof(s);
    GlobalMemoryStatusEx(&s);
    return double(s.ullTotalPhys) / (1024.0 * 1024 * 1024);
#else
    return double(sysconf(_SC_PHYS_PAGES)) * double(sysconf(_SC_PAGE_SIZE)) / (1024.0 * 1024 * 1024);
#endif
}

double freeRamGb()
{
#if defined(Q_OS_MACOS)
    vm_statistics64_data_t vm{};
    mach_msg_type_number_t count = HOST_VM_INFO64_COUNT;
    if (host_statistics64(mach_host_self(), HOST_VM_INFO64, reinterpret_cast<host_info64_t>(&vm), &count) != KERN_SUCCESS)
        return 0;
    return double(vm.free_count + vm.inactive_count) * double(vm_page_size) / (1024.0 * 1024 * 1024);
#elif defined(Q_OS_WIN)
    MEMORYSTATUSEX s{};
    s.dwLength = sizeof(s);
    GlobalMemoryStatusEx(&s);
    return double(s.ullAvailPhys) / (1024.0 * 1024 * 1024);
#else
    return double(sysconf(_SC_AVPHYS_PAGES)) * double(sysconf(_SC_PAGE_SIZE)) / (1024.0 * 1024 * 1024);
#endif
}

QString cpuModel()
{
#if defined(Q_OS_MACOS)
    char buf[256] = {};
    size_t len = sizeof(buf);
    if (sysctlbyname("machdep.cpu.brand_string", buf, &len, nullptr, 0) == 0)
        return QString::fromUtf8(buf);
#endif
    return QSysInfo::currentCpuArchitecture();
}

double round1(double v) { return std::round(v * 10.0) / 10.0; }
} // namespace

SystemInfo::SystemInfo(QObject *parent)
    : QObject(parent)
{
    registerInstance();
}

QString SystemInfo::platform() const
{
#if defined(Q_OS_MACOS)
    return QStringLiteral("darwin");
#elif defined(Q_OS_WIN)
    return QStringLiteral("win32");
#else
    return QStringLiteral("linux");
#endif
}

QString SystemInfo::appVersion() const { return QStringLiteral(SCREENLET_VERSION); }
bool SystemInfo::isMac() const { return platform() == QLatin1String("darwin"); }
bool SystemInfo::isWindows() const { return platform() == QLatin1String("win32"); }

int SystemInfo::renderConcurrency() const
{
    // Native renderer is single-process; this reports the worker threads the
    // encoder may use (kept for the "Informações da máquina" panel).
    return std::max(1, QThread::idealThreadCount() / 2);
}

QVariantMap SystemInfo::info() const
{
    return {
        {QStringLiteral("platform"), platform()},
        {QStringLiteral("osName"), QSysInfo::prettyProductName()},
        {QStringLiteral("arch"), QSysInfo::currentCpuArchitecture()},
        {QStringLiteral("hostname"), QHostInfo::localHostName()},
        {QStringLiteral("cpuModel"), cpuModel()},
        {QStringLiteral("cpuCores"), QThread::idealThreadCount()},
        {QStringLiteral("totalRamGb"), round1(totalRamGb())},
        {QStringLiteral("freeRamGb"), round1(freeRamGb())},
        {QStringLiteral("renderConcurrency"), renderConcurrency()},
        {QStringLiteral("appVersion"), appVersion()},
        {QStringLiteral("qtVersion"), QString::fromLatin1(qVersion())},
        {QStringLiteral("screenletDir"), Paths::base()},
        {QStringLiteral("userDataDir"), Paths::userData()},
    };
}

bool SystemInfo::openExternal(const QString &url) const
{
    const QUrl u(url);
    if (u.scheme() != QLatin1String("http") && u.scheme() != QLatin1String("https"))
        return false;
    return QDesktopServices::openUrl(u);
}

void SystemInfo::revealFile(const QString &absolutePath) const
{
#if defined(Q_OS_MACOS)
    QProcess::startDetached(QStringLiteral("open"), {QStringLiteral("-R"), absolutePath});
#elif defined(Q_OS_WIN)
    QProcess::startDetached(QStringLiteral("explorer.exe"),
                            {QStringLiteral("/select,"), QDir::toNativeSeparators(absolutePath)});
#else
    QDesktopServices::openUrl(QUrl::fromLocalFile(QFileInfo(absolutePath).absolutePath()));
#endif
}

void SystemInfo::openFolder(const QString &absolutePath) const
{
    QDir().mkpath(absolutePath);
    QDesktopServices::openUrl(QUrl::fromLocalFile(absolutePath));
}

void SystemInfo::copyText(const QString &text) const
{
    if (auto *cb = QGuiApplication::clipboard())
        cb->setText(text);
}

void SystemInfo::relaunch(int delayMs)
{
    QTimer::singleShot(delayMs, qApp, [] {
        if (qEnvironmentVariableIsSet("SCREENLET_NO_RELAUNCH")) { // tests
            QCoreApplication::exit(0);
            return;
        }
        QStringList args = QCoreApplication::arguments();
        args.removeFirst();
        args.removeAll(QStringLiteral("--hidden"));
#if defined(Q_OS_MACOS)
        // Relaunch the .app bundle, not the inner binary, so macOS treats it
        // as a normal app launch.
        QDir bundle(QCoreApplication::applicationDirPath());
        bundle.cd(QStringLiteral("../.."));
        if (bundle.absolutePath().endsWith(QLatin1String(".app")))
            QProcess::startDetached(QStringLiteral("open"), {QStringLiteral("-n"), bundle.absolutePath()});
        else
            QProcess::startDetached(QCoreApplication::applicationFilePath(), args);
#else
        QProcess::startDetached(QCoreApplication::applicationFilePath(), args);
#endif
        QCoreApplication::exit(0);
    });
}

void SystemInfo::quitApp()
{
    m_quitting = true;
    emit quittingChanged();
    QTimer::singleShot(0, qApp, &QCoreApplication::quit);
}

QString SystemInfo::localPath(const QUrl &url) const
{
    return url.isLocalFile() ? url.toLocalFile() : url.toString();
}

QString SystemInfo::readTextFile(const QUrl &url) const
{
    QFile f(url.isLocalFile() ? url.toLocalFile() : url.toString());
    if (!f.open(QIODevice::ReadOnly) || f.size() > 20 * 1024 * 1024)
        return {};
    const QByteArray data = f.readAll();
    // Spreadsheet exports on Windows are often Latin-1; fall back when not UTF-8.
    const QString utf8 = QString::fromUtf8(data);
    return utf8.contains(QChar::ReplacementCharacter) ? QString::fromLatin1(data) : utf8;
}
