#include "Gpu.h"

#include "services/Settings.h"

#include <QCoreApplication>
#include <QDir>
#include <QOffscreenSurface>
#include <QQuickWindow>
#include <QSGRendererInterface>
#include <QVariantMap>

#include <rhi/qrhi.h>

#include <algorithm>
#include <memory>

#if QT_CONFIG(vulkan)
#include <QtGui/private/qvulkandefaultinstance_p.h>
#endif

#if defined(Q_OS_WIN)
#include <windows.h>
#include <dxgi1_6.h>
#include <wrl/client.h>
using Microsoft::WRL::ComPtr;
#endif

namespace {

Gpu::Status g_status;

QVariantMap api(const QString &value, const QString &text, const QString &hint)
{
    return {{QStringLiteral("value"), value}, {QStringLiteral("text"), text}, {QStringLiteral("hint"), hint}};
}

QString platformDefault()
{
#if defined(Q_OS_MACOS)
    return QStringLiteral("metal");
#elif defined(Q_OS_WIN)
    return QStringLiteral("d3d11");
#else
    return QStringLiteral("opengl");
#endif
}

bool supported(const QString &v)
{
    for (const QVariant &a : Gpu::apis())
        if (a.toMap().value(QStringLiteral("value")).toString() == v)
            return true;
    return false;
}

QSGRendererInterface::GraphicsApi toQsg(const QString &v)
{
    if (v == QLatin1String("metal"))
        return QSGRendererInterface::Metal;
    if (v == QLatin1String("d3d11"))
        return QSGRendererInterface::Direct3D11;
    if (v == QLatin1String("d3d12"))
        return QSGRendererInterface::Direct3D12;
    if (v == QLatin1String("vulkan"))
        return QSGRendererInterface::Vulkan;
    if (v == QLatin1String("opengl"))
        return QSGRendererInterface::OpenGL;
    return QSGRendererInterface::Unknown;
}

// Creates (and drops) a QRhi of the requested backend: the cheapest way to
// know the API will start before Qt Quick commits to it.
bool probe(const QString &v, QString *why)
{
    // The fallback surface must outlive the QRhi (its destructor uses it).
    std::unique_ptr<QOffscreenSurface> surface;
    std::unique_ptr<QRhi> rhi;
#if defined(Q_OS_WIN)
    if (v == QLatin1String("d3d11")) {
        QRhiD3D11InitParams p;
        rhi.reset(QRhi::create(QRhi::D3D11, &p));
    } else if (v == QLatin1String("d3d12")) {
        QRhiD3D12InitParams p;
        rhi.reset(QRhi::create(QRhi::D3D12, &p));
    }
#endif
#if defined(Q_OS_MACOS) || defined(Q_OS_IOS)
    if (v == QLatin1String("metal")) {
        QRhiMetalInitParams p;
        rhi.reset(QRhi::create(QRhi::Metal, &p));
    }
#endif
#if QT_CONFIG(vulkan)
    if (v == QLatin1String("vulkan")) {
        QVulkanInstance *inst = Gpu::vulkanInstance();
        if (!inst) {
            *why = QStringLiteral("Vulkan não está disponível neste computador (driver ausente).");
            return false;
        }
#ifdef SCREENLET_VULKAN_SDK
        QRhiVulkanInitParams p;
        p.inst = inst;
        rhi.reset(QRhi::create(QRhi::Vulkan, &p));
#else
        return true; // no SDK headers: a working instance is the best check we have
#endif
    }
#endif
#if QT_CONFIG(opengl)
    if (v == QLatin1String("opengl")) {
        surface.reset(QRhiGles2InitParams::newFallbackSurface());
        QRhiGles2InitParams p;
        p.fallbackSurface = surface.get();
        rhi.reset(QRhi::create(QRhi::OpenGLES2, &p));
    }
#endif
    if (!rhi) {
        if (why->isEmpty())
            *why = QStringLiteral("%1 não pôde ser iniciado nesta placa de vídeo.").arg(Gpu::apiLabel(v));
        return false;
    }
    return true;
}

#if defined(Q_OS_WIN)
bool sameLuid(const LUID &a, const LUID &b) { return a.LowPart == b.LowPart && a.HighPart == b.HighPart; }

bool isSoftware(IDXGIAdapter1 *a)
{
    DXGI_ADAPTER_DESC1 d{};
    a->GetDesc1(&d);
    return (d.Flags & DXGI_ADAPTER_FLAG_SOFTWARE) || (d.VendorId == 0x1414 && d.DeviceId == 0x8c); // Basic Render
}
#endif

} // namespace

namespace Gpu {

QVariantList apis()
{
    QVariantList out;
#if defined(Q_OS_MACOS)
    out << api(QStringLiteral("auto"), QStringLiteral("Automático (Metal)"), QStringLiteral("Recomendado no Mac."))
        << api(QStringLiteral("metal"), QStringLiteral("Metal"), QStringLiteral("API nativa da Apple, para Apple Silicon e Intel."))
        << api(QStringLiteral("opengl"), QStringLiteral("OpenGL (legado)"), QStringLiteral("Só para diagnóstico: obsoleto no macOS."));
#elif defined(Q_OS_WIN)
    out << api(QStringLiteral("auto"), QStringLiteral("Automático (Direct3D 11)"), QStringLiteral("Recomendado: funciona em qualquer placa."))
        << api(QStringLiteral("d3d12"), QStringLiteral("Direct3D 12"), QStringLiteral("Placas NVIDIA e AMD dedicadas recentes, com drivers atualizados."))
        << api(QStringLiteral("d3d11"), QStringLiteral("Direct3D 11"), QStringLiteral("O mais estável: integradas Intel/AMD e placas antigas."))
#if QT_CONFIG(vulkan)
        << api(QStringLiteral("vulkan"), QStringLiteral("Vulkan"), QStringLiteral("NVIDIA e AMD com drivers atualizados."))
#endif
        << api(QStringLiteral("opengl"), QStringLiteral("OpenGL"), QStringLiteral("Compatibilidade com drivers antigos ou máquinas virtuais."));
#else
    out << api(QStringLiteral("auto"), QStringLiteral("Automático (OpenGL)"), QString())
#if QT_CONFIG(vulkan)
        << api(QStringLiteral("vulkan"), QStringLiteral("Vulkan"), QStringLiteral("NVIDIA, AMD e Intel com drivers Mesa/proprietários recentes."))
#endif
        << api(QStringLiteral("opengl"), QStringLiteral("OpenGL"), QString());
#endif
    return out;
}

QString apiLabel(const QString &value)
{
    static const QHash<QString, QString> names = {
        {QStringLiteral("metal"), QStringLiteral("Metal")},
        {QStringLiteral("d3d11"), QStringLiteral("Direct3D 11")},
        {QStringLiteral("d3d12"), QStringLiteral("Direct3D 12")},
        {QStringLiteral("vulkan"), QStringLiteral("Vulkan")},
        {QStringLiteral("opengl"), QStringLiteral("OpenGL")},
    };
    return names.value(value == QLatin1String("auto") ? platformDefault() : value, value);
}

QVariantList adapters()
{
    QVariantList out;
#if defined(Q_OS_WIN)
    ComPtr<IDXGIFactory1> factory;
    if (FAILED(CreateDXGIFactory1(IID_PPV_ARGS(&factory))))
        return out;
    ComPtr<IDXGIAdapter1> a;
    QList<LUID> seenLuids;
    QStringList seenNames;
    for (UINT i = 0; factory->EnumAdapters1(i, &a) != DXGI_ERROR_NOT_FOUND; ++i, a.Reset()) {
        if (isSoftware(a.Get()))
            continue;
        DXGI_ADAPTER_DESC1 d{};
        a->GetDesc1(&d);
        // The same GPU can be listed again through a virtual display driver
        // (Parsec, remote desktop…): show each card once.
        const QString key = QString::fromWCharArray(d.Description) + QString::number(d.DedicatedVideoMemory);
        if (std::any_of(seenLuids.cbegin(), seenLuids.cend(), [&](const LUID &l) { return sameLuid(l, d.AdapterLuid); })
            || seenNames.contains(key))
            continue;
        seenLuids << d.AdapterLuid;
        seenNames << key;
        const QString vendor = d.VendorId == 0x10DE ? QStringLiteral("nvidia")
                               : d.VendorId == 0x1002 ? QStringLiteral("amd")
                               : d.VendorId == 0x8086 ? QStringLiteral("intel")
                                                      : QStringLiteral("other");
        const qint64 vramMb = qint64(d.DedicatedVideoMemory / (1024 * 1024));
        out << QVariantMap{{QStringLiteral("name"), QString::fromWCharArray(d.Description)},
                           {QStringLiteral("vendor"), vendor},
                           {QStringLiteral("vramMb"), vramMb},
                           // Integrated GPUs carve out little or no dedicated VRAM.
                           {QStringLiteral("integrated"), vramMb < 1024}};
    }
#endif
    return out;
}

int adapterIndexFor(const QString &pref)
{
#if defined(Q_OS_WIN)
    if (pref != QLatin1String("high") && pref != QLatin1String("low"))
        return -1;
    ComPtr<IDXGIFactory6> f6;
    if (FAILED(CreateDXGIFactory1(IID_PPV_ARGS(&f6))))
        return -1; // pre-1803 Windows: no preference API
    ComPtr<IDXGIAdapter1> wanted;
    const auto gp = pref == QLatin1String("high") ? DXGI_GPU_PREFERENCE_HIGH_PERFORMANCE : DXGI_GPU_PREFERENCE_MINIMUM_POWER;
    if (FAILED(f6->EnumAdapterByGpuPreference(0, gp, IID_PPV_ARGS(&wanted))) || isSoftware(wanted.Get()))
        return -1;
    DXGI_ADAPTER_DESC1 wd{};
    wanted->GetDesc1(&wd);
    ComPtr<IDXGIAdapter1> a;
    for (UINT i = 0; f6->EnumAdapters1(i, &a) != DXGI_ERROR_NOT_FOUND; ++i, a.Reset()) {
        DXGI_ADAPTER_DESC1 d{};
        a->GetDesc1(&d);
        if (sameLuid(d.AdapterLuid, wd.AdapterLuid))
            return int(i);
    }
#else
    Q_UNUSED(pref);
#endif
    return -1;
}

void writeWindowsGpuPreference(const QString &pref)
{
#if defined(Q_OS_WIN)
    HKEY key = nullptr;
    if (RegCreateKeyExW(HKEY_CURRENT_USER, L"Software\\Microsoft\\DirectX\\UserGpuPreferences", 0, nullptr, 0,
                        KEY_SET_VALUE, nullptr, &key, nullptr) != ERROR_SUCCESS)
        return;
    const std::wstring exe = QDir::toNativeSeparators(QCoreApplication::applicationFilePath()).toStdWString();
    if (pref == QLatin1String("high") || pref == QLatin1String("low")) {
        const std::wstring data = pref == QLatin1String("high") ? L"GpuPreference=2;" : L"GpuPreference=1;";
        RegSetValueExW(key, exe.c_str(), 0, REG_SZ, reinterpret_cast<const BYTE *>(data.c_str()),
                       DWORD((data.size() + 1) * sizeof(wchar_t)));
    } else {
        RegDeleteValueW(key, exe.c_str());
    }
    RegCloseKey(key);
#else
    Q_UNUSED(pref);
#endif
}

#if QT_CONFIG(vulkan)
// The same instance Qt Quick gives its windows when none is set.
QVulkanInstance *vulkanInstance() { return QVulkanDefaultInstance::instance(); }
#endif

void applyAtStartup()
{
    Settings *s = Settings::instance();

    // GPU first: the API probe below already runs on the chosen adapter.
    const QString pref = s->gpuPreference();
    if (pref != QLatin1String("auto")) {
        writeWindowsGpuPreference(pref); // Vulkan/OpenGL follow the OS setting
        const int idx = adapterIndexFor(pref);
        if (idx >= 0 && !qEnvironmentVariableIsSet("QT_D3D_ADAPTER_INDEX"))
            qputenv("QT_D3D_ADAPTER_INDEX", QByteArray::number(idx));
    }

    // Encoder: only the FFmpeg path reads this (Windows uses Media Foundation
    // directly unless "cpu"), and only at the first recording.
    if (s->videoEncoder() == QLatin1String("cpu"))
        qputenv("QT_FFMPEG_ENCODING_HW_DEVICE_TYPES", ",");

    g_status = {};
    g_status.requested = s->graphicsApi();
    g_status.gpuPreference = pref;
    g_status.videoEncoder = s->videoEncoder();
    QString chosen = g_status.requested;
    if (chosen != QLatin1String("auto") && !supported(chosen)) {
        // e.g. "metal" restored from a Mac backup on Windows.
        g_status.note = QStringLiteral("%1 não existe neste sistema; usando o padrão.").arg(apiLabel(chosen));
        chosen = QStringLiteral("auto");
        s->setGraphicsApi(chosen);
        g_status.requested = chosen;
    }
    if (chosen != QLatin1String("auto")) {
        QString why;
        if (probe(chosen, &why)) {
            QQuickWindow::setGraphicsApi(toQsg(chosen));
        } else {
            g_status.note = why + QStringLiteral(" Usando o padrão (%1).").arg(apiLabel(QStringLiteral("auto")));
            chosen = QStringLiteral("auto");
        }
    }
    g_status.active = chosen == QLatin1String("auto") ? platformDefault() : chosen;
}

const Status &status() { return g_status; }

} // namespace Gpu
