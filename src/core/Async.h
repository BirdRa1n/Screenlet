#pragma once

#include <QFutureWatcher>
#include <QJSEngine>
#include <QJSValue>
#include <QObject>
#include <QPointer>
#include <QVariant>
#include <QtConcurrent/QtConcurrentRun>

#include <functional>

// Helpers for the "call from QML with a callback" pattern used by every
// service method that does I/O or networking:
//
//   Kodi.ping(id, function (result) { ... })
//
// Work runs off the GUI thread (QtConcurrent) and the callback is always
// invoked back on the GUI thread, so QML never blocks.
namespace Async {

// The single QML engine, set once in main().
inline QPointer<QJSEngine> &engine()
{
    static QPointer<QJSEngine> e;
    return e;
}

inline void invoke(QJSValue cb, const QVariant &value)
{
    if (!cb.isCallable() || !engine())
        return;
    const QJSValue result = cb.call({engine()->toScriptValue(value)});
    if (result.isError())
        qWarning("QML callback error: %s", qPrintable(result.toString()));
}

// Runs `work` on the thread pool; delivers its QVariant result to `cb` on
// the thread that owns `context`.
inline void run(QObject *context, QJSValue cb, std::function<QVariant()> work,
                std::function<void(const QVariant &)> after = {})
{
    auto *watcher = new QFutureWatcher<QVariant>(context);
    QObject::connect(watcher, &QFutureWatcher<QVariant>::finished, context, [watcher, cb, after]() mutable {
        const QVariant result = watcher->result();
        if (after)
            after(result);
        invoke(cb, result);
        watcher->deleteLater();
    });
    watcher->setFuture(QtConcurrent::run(std::move(work)));
}

inline QVariantMap ok(QVariantMap extra = {})
{
    extra.insert(QStringLiteral("ok"), true);
    return extra;
}

inline QVariantMap fail(const QString &error)
{
    return {{QStringLiteral("ok"), false}, {QStringLiteral("error"), error}};
}

} // namespace Async
