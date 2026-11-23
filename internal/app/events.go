package app

import "github.com/egoist/mygo"

// MenuCommand is sent when a native menu item that the frontend owns is
// chosen. The frontend decides what the command means.
type MenuCommand struct {
	Command string `json:"command"`
}

// MenuCommandEvent carries native menu actions to the page.
var MenuCommandEvent = mygo.NewEvent[MenuCommand]("menuCommand")

// PiStatusChanged is sent when background pi discovery finishes or the user
// changes the configured executable.
type PiStatusChanged struct {
	Status PiStatus `json:"status"`
}

// PiStatusEvent reports pi discovery results.
var PiStatusEvent = mygo.NewEvent[PiStatusChanged]("piStatusChanged")
