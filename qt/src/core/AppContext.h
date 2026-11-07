#pragma once

#include <QJSEngine>
#include <QObject>
#include <QQmlEngine>

// Every backend service is a QML singleton backed by ONE C++ instance owned
// by AppContext (created in main before the QML engine loads). QML gets that
// same instance through the static create() below — never a second copy.
//
// Usage inside a class (QML_ELEMENT / QML_SINGLETON must stay literal so moc
// sees them):
//
//   class Foo : public QObject {
//       Q_OBJECT
//       QML_ELEMENT
//       QML_SINGLETON
//       SL_SINGLETON(Foo)
//   public:
//       explicit Foo(QObject *parent);
//   };
#define SL_SINGLETON(T)                                                         \
public:                                                                         \
    static T *instance() { return s_instance; }                                 \
    static T *create(QQmlEngine *, QJSEngine *)                                 \
    {                                                                           \
        QJSEngine::setObjectOwnership(s_instance, QJSEngine::CppOwnership);     \
        return s_instance;                                                      \
    }                                                                           \
                                                                                \
private:                                                                        \
    static inline T *s_instance = nullptr;                                      \
    void registerInstance() { s_instance = this; }                              \
                                                                                \
public:

class AppContext : public QObject
{
    Q_OBJECT
public:
    explicit AppContext(QObject *parent);
    ~AppContext() override;

    // Runs after the QML engine exists (IPTV autostart, updater, …).
    void startBackground(bool startedHidden);
};
