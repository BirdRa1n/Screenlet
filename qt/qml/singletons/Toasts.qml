pragma Singleton
import QtQuick

// Toast queue rendered by components/ToastHost.qml.
QtObject {
    property ListModel items: ListModel {}
    property int seq: 0

    function show(kind, text) {
        seq += 1
        items.append({ uid: seq, kind: kind, text: text })
        if (items.count > 4)
            items.remove(0)
    }
    function success(t) { show("success", t) }
    function error(t) { show("error", t) }
    function info(t) { show("info", t) }

    function dismiss(uid) {
        for (let i = 0; i < items.count; ++i)
            if (items.get(i).uid === uid) {
                items.remove(i)
                return
            }
    }
}
