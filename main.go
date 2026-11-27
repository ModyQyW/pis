// PiS is a desktop coding agent built on mygo with pi as the engine.
package main

import (
	"fmt"
	"log"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"

	"github.com/egoist/mygo"
	"github.com/egoist/mygo/plugins/updater"

	"pis/internal/agent"
	"pis/internal/app"
	"pis/internal/auth"
	"pis/internal/bridge"
	"pis/internal/files"
	"pis/internal/gitx"
	"pis/internal/guard"
	"pis/internal/mcp"
	"pis/internal/piconf"
	"pis/internal/sessions"
	"pis/internal/settings"
)

func main() {
	mygo.App.SetName("PiS")
	mygo.Use(updater.Plugin)

	dataDir, err := mygo.App.Path(mygo.PathUserData)
	if err != nil {
		log.Printf("pis: user data directory: %v", err)
		dataDir = filepath.Join(os.TempDir(), "pis")
	}
	store, err := settings.Open(dataDir)
	if err != nil {
		// A corrupt settings file must not prevent the app from opening.
		log.Printf("pis: %v (using defaults)", err)
	}

	app.ApplyTheme(store.Snapshot().Theme)
	app.ApplyLanguage(store.Snapshot().Language)
	mgr := agent.NewManager(func(ev agent.Event) { AgentEvent.Broadcast(ev) })
	if bridgePath, err := bridge.Ensure(dataDir); err == nil {
		mgr.SetBridgePath(bridgePath)
	} else {
		log.Printf("pis: bridge extension: %v", err)
	}
	guardPolicy := app.EffectiveGuardPolicy(store.Snapshot(), guard.Detected(sessions.AgentDir()))
	if mygo.IsDev() {
		if override := os.Getenv("PIS_GUARD_OVERRIDE"); override != "" {
			guardPolicy = override
		}
	}
	mgr.SetGuardPolicy(guardPolicy)
	svc := app.New(store, dataDir, mgr)
	if mygo.IsDev() {
		if open := os.Getenv("PIS_OPEN"); open != "" {
			if _, err := svc.OpenProject(open); err != nil {
				log.Printf("pis: open project: %v", err)
			}
		}
	}
	mygo.BindAs("Desktop", svc)
	mygo.BindAs("Agent", mgr)
	mygo.BindAs("Sessions", app.NewSessions(mgr))
	mygo.BindAs("Files", files.New())
	mygo.BindAs("Git", gitx.New())
	mygo.BindAs("MCP", mcp.New())
	mygo.BindAs("PiConfig", piconf.New(store))
	authMgr := auth.New(mgr.Executable, func(o auth.Output) { AuthOutput.Broadcast(o) }, func(e auth.Exit) { AuthExit.Broadcast(e) })
	mygo.BindAs("Auth", authMgr)

	mygo.App.WhenReady(func() {
		mygo.App.SetMenu(buildMenu())
		openWindow()
	})
	mygo.App.OnWindowAllClosed(func() {
		mygo.App.Quit()
	})
	mygo.App.OnActivate(func(hasVisibleWindows bool) {
		if !hasVisibleWindows {
			openWindow()
		}
	})
	var quitting atomic.Bool
	mygo.App.OnBeforeQuit(func(e *mygo.QuitEvent) {
		if quitting.Load() || e.SessionEnding {
			return
		}
		n := mgr.RunningCount()
		if n == 0 {
			return
		}
		e.PreventDefault()
		go func() {
			result, err := mygo.Dialog.Message(mygo.MessageOptions{
				Type:               mygo.MessageWarning,
				Title:              "Sessions are running",
				Message:            fmt.Sprintf("%d session%s still working. Quit and stop the runs?", n, plural(n)),
				Detail:             "PiS will stop the pi processes. Session files stay on disk and can be resumed.",
				Buttons:            []string{"Cancel", "Quit and Stop"},
				DefaultButton:      0,
				CancelButton:       0,
				DestructiveButtons: []int{1},
			})
			if err != nil || result.Button != 1 {
				return
			}
			quitting.Store(true)
			mygo.App.Quit()
		}()
	})
	mygo.App.OnWillQuit(func(*mygo.QuitEvent) {
		authMgr.Shutdown()
		mgr.Shutdown()
	})
	if err := mygo.App.Run(); err != nil {
		log.Fatal(err)
	}
}

// AgentEvent carries pi session events, coalesced deltas, and status changes.
var AgentEvent = mygo.NewEvent[agent.Event]("agentEvent")

// AuthOutput and AuthExit carry the in-app login terminal.
var (
	AuthOutput = mygo.NewEvent[auth.Output]("authOutput")
	AuthExit   = mygo.NewEvent[auth.Exit]("authExit")
)

func openWindow() {
	pageURL := "/"
	if mygo.IsDev() {
		if session := os.Getenv("PIS_OPEN_SESSION"); session != "" {
			pageURL = "/?session=" + url.QueryEscape(session)
		}
		if prompt := os.Getenv("PIS_DEV_PROMPT"); prompt != "" {
			sep := "?"
			if strings.Contains(pageURL, "?") {
				sep = "&"
			}
			pageURL += sep + "prompt=" + url.QueryEscape(prompt)
		}
	}
	win := mygo.NewWindow(mygo.WindowOptions{
		Title:                "PiS",
		URL:                  pageURL,
		Width:                1320,
		Height:               860,
		MinWidth:             960,
		MinHeight:            620,
		TitleBarStyle:        mygo.TitleBarHiddenInset,
		TrafficLightPosition: &mygo.Point{X: 16, Y: 19},
		BackgroundColor:      "light-dark(#f7f6f3, #141413)",
		StateKey:             "main",
		Hidden:               true,
		Page:                 mygo.PageOptions{DevTools: mygo.DevToolsAuto},
	})
	win.OnReadyToShow(win.Show)
}

func plural(n int) string {
	if n == 1 {
		return ""
	}
	return "s are"
}

func buildMenu() *mygo.Menu {
	emit := func(command string) func(*mygo.MenuItem, *mygo.Window) {
		return func(_ *mygo.MenuItem, win *mygo.Window) {
			msg := app.MenuCommand{Command: command}
			if win == nil {
				_ = app.MenuCommandEvent.Broadcast(msg)
				return
			}
			_ = app.MenuCommandEvent.Emit(win, msg)
		}
	}
	return mygo.NewMenu([]*mygo.MenuItem{
		{Role: mygo.RoleAppMenu},
		{Label: "File", Submenu: []*mygo.MenuItem{
			{Label: "New Chat", Accelerator: "CmdOrCtrl+N", Click: emit("newChat")},
			{Label: "Open Project…", Accelerator: "CmdOrCtrl+O", Click: emit("openProject")},
			mygo.Separator(),
			{Label: "Close Session", Accelerator: "CmdOrCtrl+W", Click: emit("closeSession")},
			mygo.Separator(),
			{Label: "Settings…", Accelerator: "CmdOrCtrl+,", Click: emit("settings")},
			mygo.Separator(),
			{Role: mygo.RoleQuit},
		}},
		{Role: mygo.RoleEditMenu},
		{Label: "View", Submenu: []*mygo.MenuItem{
			{Label: "Command Palette…", Accelerator: "CmdOrCtrl+K", Click: emit("commandPalette")},
			mygo.Separator(),
			{Label: "Toggle Sidebar", Accelerator: "CmdOrCtrl+B", Click: emit("toggleSidebar")},
			{Label: "Toggle Changes", Accelerator: "CmdOrCtrl+Shift+G", Click: emit("toggleChanges")},
			mygo.Separator(),
			{Role: mygo.RoleReload},
			{Role: mygo.RoleToggleDevTools},
			mygo.Separator(),
			{Role: mygo.RoleResetZoom},
			{Role: mygo.RoleZoomIn},
			{Role: mygo.RoleZoomOut},
			mygo.Separator(),
			{Role: mygo.RoleToggleFullScreen},
		}},
		{Label: "Session", Submenu: []*mygo.MenuItem{
			{Label: "Stop Run", Click: emit("stop")},
			{Label: "Compact Context…", Accelerator: "CmdOrCtrl+Shift+C", Click: emit("compact")},
			{Label: "Session Tree…", Accelerator: "CmdOrCtrl+Shift+T", Click: emit("sessionTree")},
			{Label: "Model & Thinking…", Accelerator: "CmdOrCtrl+Shift+M", Click: emit("modelPicker")},
			mygo.Separator(),
			{Label: "Rename Session…", Click: emit("renameSession")},
			{Label: "Export as HTML…", Click: emit("exportHtml")},
			{Label: "Reveal Session File", Click: emit("revealSession")},
		}},
		{Role: mygo.RoleWindowMenu},
		{Label: "Help", Submenu: []*mygo.MenuItem{
			updater.MenuItem(),
			mygo.Separator(),
			{Label: "Pi Documentation", Click: func(*mygo.MenuItem, *mygo.Window) {
				_ = mygo.Shell.OpenExternal("https://pi.dev/docs/latest")
			}},
			{Label: "Mygo Documentation", Click: func(*mygo.MenuItem, *mygo.Window) {
				_ = mygo.Shell.OpenExternal("https://mygo.run/docs")
			}},
		}},
	})
}
