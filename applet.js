const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Lang = imports.lang;
const GLib = imports.gi.GLib;

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        
        this.set_applet_icon_name("cpu-symbolic");
        this.set_applet_tooltip(_("Click here to throttle CPU"));

        // Create a popup menu
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this.ThrottleBin = '/home/shared/scripts/CPUThrottle/ThrottleCPU.sh';
        this._loadCPULevels();
    },

    _loadCPULevels: function() {
        // Run the script and capture the output
        let [success, output] = GLib.spawn_command_line_sync(this.ThrottleBin);

        if (success) {
            let outputString = output.toString();
            this._parseAndCreateMenu(outputString);
        }
    },

    _parseAndCreateMenu: function(output) {
        // Extract levels and frequencies
        let lines = output.split('\n');
        let freqMap = {};

        let freqSection = false;
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (line.startsWith("Possible frequencies:")) {
                freqSection = true;
                continue;
            }
            if (freqSection && line.match(/^\(\d+\)\s+\d+/)) {
                let parts = line.match(/\((\d+)\)\s+(\d+)/);
                if (parts && parts.length === 3) {
                    let level = parts[1];
                    let frequency = parts[2];
                    freqMap[level] = frequency;
                }
            }
        }

        // Create a submenu for selecting throttle values
        this._sliderMenuItem = new PopupMenu.PopupSubMenuMenuItem(_("Select Throttle Level"));
        this.menu.addMenuItem(this._sliderMenuItem);

        // Create menu items for each level (0 to 8) with frequencies
        for (let level in freqMap) {
            let frequency = freqMap[level];
            let label = `Level ${level} (${frequency} Hz)`;
            let item = new PopupMenu.PopupMenuItem(label);
            item.connect('activate', function() {
                this._onValueSelected(level);
            }.bind(this));
            this._sliderMenuItem.menu.addMenuItem(item);
        }
    },

    _onValueSelected: function(level) {
        // Execute the script with the selected level as an argument
        var tmpl = this.ThrottleBin;
        Util.spawnCommandLine(`${tmpl} ${level}`);
    },

    on_applet_clicked: function() {
        this.menu.toggle();  // Show/hide the dropdown menu
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(orientation, panel_height, instance_id);
}
