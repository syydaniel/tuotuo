// 坨坨 · macOS shell for the abstract desktop pet.
// A borderless, transparent, full-screen panel hosts a WKWebView that runs web/pet.js.
// The panel ignores the mouse except where the page reports the pet (hit rects), so the rest of the screen stays clickable.
// It reads only: cursor position, on-screen window frames (no titles, no contents), battery level, the clock.

import Cocoa
import WebKit
import IOKit.ps
import ServiceManagement

final class PetWebView: WKWebView {
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
    override func willOpenMenu(_ menu: NSMenu, with event: NSEvent) { menu.removeAllItems() }   // no WebKit context menu
}

final class OverlayPanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate, NSMenuDelegate {
    var panel: OverlayPanel!
    var web: PetWebView!
    var statusItem: NSStatusItem!
    var petMenu = NSMenu()
    var hitRects: [NSRect] = []
    var ready = false
    var timer: Timer?
    var lastMouse = NSPoint(x: -99999, y: -99999)
    var screenFrame = NSRect.zero
    var statusText = "精神状态：加载中"
    var state: [String: Any] = [:]
    var acts: [[String]] = []
    var tickN = 0
    var lastWinKey = ""
    let dragBoard = NSPasteboard(name: .drag)
    lazy var dragCount = dragBoard.changeCount
    var fileDrag = false
    let defaults = UserDefaults.standard
    // developer hook: TUOTUO_DEBUG=<dir> writes web-view snapshots + state there and runs <dir>/cmd.js when it appears
    let debugDir = ProcessInfo.processInfo.environment["TUOTUO_DEBUG"]

    // ------------------------------------------------------------------ lifecycle
    func applicationDidFinishLaunching(_ n: Notification) {
        let me = NSRunningApplication.current
        if let id = Bundle.main.bundleIdentifier,
           NSRunningApplication.runningApplications(withBundleIdentifier: id).contains(where: { $0 != me }) {
            NSApp.terminate(nil); return   // one pet is enough
        }
        NSApp.setActivationPolicy(.accessory)
        setupPanel()
        setupStatusItem()
        petMenu.delegate = self
        timer = Timer(timeInterval: 1.0 / 30.0, repeats: true) { [weak self] _ in self?.tick() }
        RunLoop.main.add(timer!, forMode: .common)
        NotificationCenter.default.addObserver(self, selector: #selector(screensChanged), name: NSApplication.didChangeScreenParametersNotification, object: nil)
        NSWorkspace.shared.notificationCenter.addObserver(self, selector: #selector(wake), name: NSWorkspace.didWakeNotification, object: nil)
    }

    func setupPanel() {
        let scr = NSScreen.screens.first ?? NSScreen.main!
        screenFrame = scr.frame
        panel = OverlayPanel(contentRect: scr.frame, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = false
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary, .ignoresCycle]
        panel.ignoresMouseEvents = true
        panel.isMovable = false
        panel.hidesOnDeactivate = false
        panel.isReleasedWhenClosed = false
        panel.becomesKeyOnlyIfNeeded = true

        let cfg = WKWebViewConfiguration()
        let uc = WKUserContentController()
        uc.add(self, name: "pet")
        // saved preferences are injected before any page script runs
        var prefs: [String: Any] = [:]
        for k in ["mute", "skin", "size", "met"] { if let v = defaults.object(forKey: "pref." + k) { prefs[k] = v } }
        let json = (try? JSONSerialization.data(withJSONObject: prefs)).flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
        uc.addUserScript(WKUserScript(source: "window.__TUO_PREFS = \(json);", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        cfg.userContentController = uc
        cfg.mediaTypesRequiringUserActionForPlayback = []
        web = PetWebView(frame: NSRect(origin: .zero, size: scr.frame.size), configuration: cfg)
        web.setValue(false, forKey: "drawsBackground")
        web.autoresizingMask = [.width, .height]
        web.allowsMagnification = false
        web.allowsBackForwardNavigationGestures = false
        web.navigationDelegate = self
        // A fully transparent window counts as occluded, which would make WebKit pause the page (no animation frames).
        let occl = Selector(("_setWindowOcclusionDetectionEnabled:"))
        if web.responds(to: occl) { web.perform(occl, with: false as NSNumber) }
        panel.contentView = web
        let dir = Bundle.main.resourceURL!.appendingPathComponent("web")
        web.loadFileURL(dir.appendingPathComponent("index.html"), allowingReadAccessTo: dir)
        panel.orderFrontRegardless()
    }

    // never navigate away from the pet page (e.g. a file dropped somewhere unexpected)
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let u = action.request.url
        decisionHandler(u?.isFileURL == true && u?.path.hasSuffix("/web/index.html") == true ? .allow : .cancel)
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { ready = false; webView.reload() }

    @objc func screensChanged() { if ready { sendInit() } }
    @objc func wake() { if ready { sendInit(); sendBattery() } }

    // ------------------------------------------------------------------ bridge
    func js(_ s: String) { if ready { web.evaluateJavaScript(s, completionHandler: nil) } }
    func jsString(_ s: String) -> String {
        let d = try? JSONSerialization.data(withJSONObject: [s]); let a = d.flatMap { String(data: $0, encoding: .utf8) } ?? "[\"\"]"
        return String(a.dropFirst().dropLast())
    }
    func command(_ name: String, _ arg: Any? = nil) {
        var a = "null"
        if let s = arg as? String { a = jsString(s) } else if let d = arg as? Double { a = "\(d)" } else if let i = arg as? Int { a = "\(i)" } else if let b = arg as? Bool { a = b ? "true" : "false" }
        js("TUOHOST.command(\(jsString(name)), \(a))")
    }

    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
        guard let d = m.body as? [String: Any], let type = d["type"] as? String else { return }
        switch type {
        case "ready":
            ready = true
            acts = (d["acts"] as? [[String]]) ?? []
            sendInit(); sendWindows(force: true); sendBattery()
        case "hit":
            hitRects = ((d["rects"] as? [[Double]]) ?? []).compactMap { $0.count == 4 ? NSRect(x: $0[0], y: $0[1], width: $0[2], height: $0[3]) : nil }
        case "status":
            statusText = (d["text"] as? String) ?? statusText
        case "state":
            state = d
        case "pref":
            if let k = d["key"] as? String { defaults.set(d["value"], forKey: "pref." + k) }
        case "menu":
            let x = (d["x"] as? Double) ?? 0, y = (d["y"] as? Double) ?? 0
            let p = web.convert(NSPoint(x: x, y: panel.frame.height - y), from: nil)
            petMenu.popUp(positioning: nil, at: p, in: web)
        case "quit":
            NSApp.terminate(nil)
        default: break
        }
    }

    func sendInit() {
        let scr = NSScreen.screens.first ?? NSScreen.main!
        screenFrame = scr.frame
        panel.setFrame(scr.frame, display: true)
        let vf = scr.visibleFrame
        let menuBar = scr.frame.maxY - vf.maxY
        let dock = vf.minY - scr.frame.minY
        let floor = scr.frame.height - max(dock, 2)
        js("TUOHOST.init({w:\(scr.frame.width),h:\(scr.frame.height),floor:\(floor),ceil:\(menuBar)})")
        lastWinKey = ""
    }

    // ------------------------------------------------------------------ polling (60 Hz)
    func tick() {
        guard panel != nil else { return }
        tickN += 1
        let g = NSEvent.mouseLocation
        let p = NSPoint(x: g.x - screenFrame.minX, y: screenFrame.maxY - g.y)   // top-left origin, like the page
        let pressed = NSEvent.pressedMouseButtons & 1 == 1
        let dc = dragBoard.changeCount
        if dc != dragCount { dragCount = dc; if pressed { fileDrag = true } }
        if !pressed { fileDrag = false }
        let pad: CGFloat = fileDrag ? -36 : 0
        let inside = hitRects.contains { $0.insetBy(dx: pad, dy: pad).contains(p) }
        if panel.ignoresMouseEvents == inside { panel.ignoresMouseEvents = !inside }
        if ready && (abs(p.x - lastMouse.x) + abs(p.y - lastMouse.y) > 0.4) {
            lastMouse = p
            js("TUOHOST.mouse(\(Int(p.x)),\(Int(p.y)))")
        }
        if tickN % 15 == 0 { sendWindows() }
        if tickN % 1800 == 0 { sendBattery() }
        if tickN % 30 == 0, let b = statusItem.button { b.toolTip = "坨坨 · " + statusText }
        if let dir = debugDir, tickN % 15 == 0 { debugTick(dir) }
    }

    func debugTick(_ dir: String) {
        let fm = FileManager.default, cmd = dir + "/cmd.js"
        if fm.fileExists(atPath: cmd), let src = try? String(contentsOfFile: cmd, encoding: .utf8) {
            try? fm.removeItem(atPath: cmd)
            web.evaluateJavaScript(src) { r, e in
                let out = "\(r.map { "\($0)" } ?? "nil") \(e.map { "\($0)" } ?? "")"
                try? out.write(toFile: dir + "/cmd.out", atomically: true, encoding: .utf8)
            }
        }
        if fm.fileExists(atPath: dir + "/snap.req") {
            try? fm.removeItem(atPath: dir + "/snap.req")
            let cfg = WKSnapshotConfiguration()
            web.takeSnapshot(with: cfg) { img, _ in
                guard let img = img, let tiff = img.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff),
                      let png = rep.representation(using: .png, properties: [:]) else { return }
                try? png.write(to: URL(fileURLWithPath: dir + "/snap.png"))
            }
        }
        let st: [String: Any] = ["occl": panel.occlusionState.contains(.visible), "ignores": panel.ignoresMouseEvents, "hit": hitRects.map { [$0.minX, $0.minY, $0.width, $0.height] },
                                 "mouse": [lastMouse.x, lastMouse.y], "status": statusText, "screen": [screenFrame.width, screenFrame.height], "ready": ready]
        if let d = try? JSONSerialization.data(withJSONObject: st) { try? d.write(to: URL(fileURLWithPath: dir + "/state.json")) }
    }

    func sendWindows(force: Bool = false) {
        guard ready, let info = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else { return }
        let myPid = ProcessInfo.processInfo.processIdentifier
        var out: [[Int]] = []
        for w in info {
            guard (w[kCGWindowLayer as String] as? Int) == 0,
                  (w[kCGWindowOwnerPID as String] as? Int32) != myPid,
                  let b = w[kCGWindowBounds as String] as? [String: CGFloat],
                  let id = w[kCGWindowNumber as String] as? Int else { continue }
            if ((w[kCGWindowAlpha as String] as? Double) ?? 1) < 0.1 { continue }
            let x = b["X"] ?? 0, y = b["Y"] ?? 0, ww = b["Width"] ?? 0, hh = b["Height"] ?? 0
            if ww < 120 || hh < 60 { continue }
            // Quartz window coordinates are top-left based on the main display, same as the overlay
            out.append([id, Int(x - screenFrame.minX), Int(y), Int(ww), Int(hh)])
            if out.count >= 14 { break }
        }
        let key = out.map { $0.map(String.init).joined(separator: ",") }.joined(separator: ";")
        if key == lastWinKey && !force { return }
        lastWinKey = key
        js("TUOHOST.windows([\(out.map { "[\($0.map(String.init).joined(separator: ","))]" }.joined(separator: ","))])")
    }

    func sendBattery() {
        guard ready, let snap = IOPSCopyPowerSourcesInfo()?.takeRetainedValue(),
              let list = IOPSCopyPowerSourcesList(snap)?.takeRetainedValue() as? [CFTypeRef] else { return }
        for ps in list {
            guard let d = IOPSGetPowerSourceDescription(snap, ps)?.takeUnretainedValue() as? [String: Any],
                  let cur = d[kIOPSCurrentCapacityKey] as? Int, let mx = d[kIOPSMaxCapacityKey] as? Int, mx > 0 else { continue }
            let charging = (d[kIOPSPowerSourceStateKey] as? String) == kIOPSACPowerValue
            js("TUOHOST.battery(\(Double(cur) / Double(mx)),\(charging))")
            return
        }
    }

    // ------------------------------------------------------------------ menus
    func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        statusItem.button?.image = statusIcon()
        statusItem.button?.toolTip = "坨坨"
        let m = NSMenu(); m.delegate = self
        statusItem.menu = m
    }

    func statusIcon() -> NSImage {
        let img = NSImage(size: NSSize(width: 18, height: 18), flipped: false) { _ in
            let body = NSBezierPath()
            body.move(to: NSPoint(x: 2.2, y: 5.5))
            body.curve(to: NSPoint(x: 9, y: 16), controlPoint1: NSPoint(x: 1.5, y: 12.5), controlPoint2: NSPoint(x: 4.5, y: 16))
            body.curve(to: NSPoint(x: 15.8, y: 5.5), controlPoint1: NSPoint(x: 13.5, y: 16), controlPoint2: NSPoint(x: 16.5, y: 12.5))
            body.curve(to: NSPoint(x: 9, y: 2), controlPoint1: NSPoint(x: 15.4, y: 2.5), controlPoint2: NSPoint(x: 12, y: 2))
            body.curve(to: NSPoint(x: 2.2, y: 5.5), controlPoint1: NSPoint(x: 6, y: 2), controlPoint2: NSPoint(x: 2.6, y: 2.5))
            body.close()
            NSColor.black.setStroke(); body.lineWidth = 1.6; body.stroke()
            NSColor.black.setFill()
            NSBezierPath(ovalIn: NSRect(x: 4.6, y: 7.6, width: 4.4, height: 4.4)).fill()
            NSBezierPath(ovalIn: NSRect(x: 11.2, y: 9.2, width: 2.4, height: 2.4)).fill()
            return true
        }
        img.isTemplate = true
        return img
    }

    func item(_ title: String, _ sel: Selector?, _ obj: Any? = nil, on: Bool = false, enabled: Bool = true) -> NSMenuItem {
        let it = NSMenuItem(title: title, action: sel, keyEquivalent: "")
        it.target = self; it.representedObject = obj; it.state = on ? .on : .off; it.isEnabled = enabled
        return it
    }

    func menuNeedsUpdate(_ menu: NSMenu) {
        menu.removeAllItems()
        menu.autoenablesItems = false
        let fromBar = menu === statusItem.menu
        let hidden = (state["hidden"] as? Bool) ?? false, off = (state["offWork"] as? Bool) ?? false
        menu.addItem(item(statusText, nil, enabled: false))
        menu.addItem(.separator())
        if fromBar {
            if off { menu.addItem(item("叫它回来加班", #selector(cmd(_:)), "back")) }
            menu.addItem(item(hidden && !off ? "把它叫回来" : "召唤到鼠标旁边", #selector(cmd(_:)), "summon"))
        }
        menu.addItem(item("摸摸它", #selector(cmd(_:)), "petted"))
        menu.addItem(item("喂它（把文件拖到它身上）", #selector(cmd(_:)), "feedHint"))
        menu.addItem(item("扔个球给你捡", #selector(cmd(_:)), "ball"))
        let perf = NSMenuItem(title: "让它表演", action: nil, keyEquivalent: "")
        let sub = NSMenu()
        sub.addItem(item("随机一个", #selector(cmd(_:)), "random"))
        sub.addItem(.separator())
        for a in acts where a.count == 2 { sub.addItem(item(a[1], #selector(act(_:)), a[0])) }
        perf.submenu = sub
        menu.addItem(perf)
        menu.addItem(.separator())
        menu.addItem(item("换个颜色", #selector(cmd(_:)), "skin"))
        let sizeItem = NSMenuItem(title: "大小", action: nil, keyEquivalent: "")
        let sm = NSMenu(); let cur = (state["size"] as? Double) ?? 1
        for (t, v) in [("小一坨", 0.8), ("正常一坨", 1.0), ("大一坨", 1.3), ("巨大一坨", 1.7)] {
            let it = item(t, #selector(size(_:)), v, on: abs(cur - v) < 0.01); sm.addItem(it)
        }
        sizeItem.submenu = sm
        menu.addItem(sizeItem)
        menu.addItem(item("让它闭嘴三十分钟", #selector(cmd(_:)), "quiet", on: (state["quiet"] as? Bool) ?? false))
        menu.addItem(item("静音", #selector(cmd(_:)), "mute", on: (state["mute"] as? Bool) ?? false))
        if #available(macOS 13.0, *) {
            menu.addItem(item("开机也要见到它", #selector(toggleLogin), on: SMAppService.mainApp.status == .enabled))
        }
        menu.addItem(.separator())
        menu.addItem(item("关于坨坨", #selector(about)))
        menu.addItem(item("让它走…", #selector(cmd(_:)), "leave"))
        menu.addItem(item("立即退出（没有剧情）", #selector(quitNow)))
    }

    @objc func cmd(_ s: NSMenuItem) { if let n = s.representedObject as? String { command(n) } }
    @objc func act(_ s: NSMenuItem) { if let n = s.representedObject as? String { command("act", n) } }
    @objc func size(_ s: NSMenuItem) { if let v = s.representedObject as? Double { command("size", v) } }
    @objc func quitNow() { NSApp.terminate(nil) }
    @objc func toggleLogin() {
        guard #available(macOS 13.0, *) else { return }
        do {
            if SMAppService.mainApp.status == .enabled { try SMAppService.mainApp.unregister() } else { try SMAppService.mainApp.register() }
        } catch {
            NSApp.activate(ignoringOtherApps: true)
            let a = NSAlert(); a.messageText = "没设置成功"
            a.informativeText = "可以在 系统设置 > 通用 > 登录项 里手动添加坨坨。\n(\(error.localizedDescription))"
            a.runModal()
        }
    }
    @objc func about() {
        NSApp.activate(ignoringOtherApps: true)
        NSApp.orderFrontStandardAboutPanel(options: [
            .applicationName: "坨坨",
            .credits: NSAttributedString(string: "一只把网络热词当真的抽象桌宠。\n点它、拖它、把文件拖给它。\n它不删文件、不读键盘、不联网。\n\n它没用，但它很抽象。", attributes: [.font: NSFont.systemFont(ofSize: 11), .foregroundColor: NSColor.secondaryLabelColor]),
        ])
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
