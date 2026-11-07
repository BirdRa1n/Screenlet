pragma Singleton
import QtQuick

// App navigation: one current page + params. Pages are lazily created by
// Main.qml; `go()` is the only way to switch.
QtObject {
    id: nav

    property string page: "painel"
    property var params: ({})
    property var history: []

    signal navigated(string page, var params)

    function go(p, prm) {
        if (p === page && !prm)
            return
        history.push({ page: page, params: params })
        if (history.length > 30)
            history.shift()
        params = prm || ({})
        page = p
        navigated(p, params)
    }

    function back(fallback) {
        const prev = history.pop()
        if (prev) {
            params = prev.params
            page = prev.page
        } else {
            params = ({})
            page = fallback || "painel"
        }
        navigated(page, params)
    }
}
