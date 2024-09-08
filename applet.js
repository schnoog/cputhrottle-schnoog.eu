const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const Gettext = imports.gettext;
const Settings = imports.ui.settings;
const UUID = 'cputhrottle@schnoog.eu';
const AppletDir = imports.ui.appletManager.appletMeta[UUID].path;


Gettext.bindtextdomain(UUID, GLib.get_home_dir() + '/.local/share/locale')

function _(str) {
  return Gettext.dgettext(UUID, str);
}




function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        this.settings = new Settings.AppletSettings(this, UUID, instance_id);
        this.ThrottleBin = GLib.get_home_dir() + '/.local/share/cinnamon/applets/' + UUID +'/ThrottleCPU.sh';

        
        this.settings.bind('default-step', 'defaultStep', this._onDefaultStepChanged);
        this._applyDefaultStep();


        // Initial frequency load
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 3000, Lang.bind(this, this._updateFrequencyLabel));

        // Create a popup menu
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this._loadCPULevels();
    },

    _applyDefaultStep: function() {
        // Use the value from the settings and execute the command
        let level = this.defaultStep || "0";  // Fallback to "0" if defaultStep is not set
        
        Util.spawnCommandLine(`${this.ThrottleBin} ${level}`);
        //this._updateFrequencyLabel();
    },

    _updateFrequencyLabel: function() {
        // Run the script to get the current level index
        let [success, output] = GLib.spawn_command_line_sync(`${this.ThrottleBin} g`);
        
        if (success) {
            let currentIndex = parseInt(output.toString().trim(), 10);
    
            // Check if the parsed index is a valid number
            if (isNaN(currentIndex)) {
                // If the value is not a number, set the label to "unknown"
                this.set_applet_label("unknown");
                this.set_applet_tooltip(_("Current CPU Frequency"));
                return;
            }
    
            // Run the script to get all available frequencies
            let [successFreq, freqOutput] = GLib.spawn_command_line_sync(this.ThrottleBin);
    
            if (successFreq) {
                let lines = freqOutput.toString().split('\n');
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
                            let level = parseInt(parts[1], 10);
                            let frequencyHz = parseInt(parts[2], 10);
                            let frequencyGHz = (frequencyHz / 1000000).toFixed(2);  // Convert to GHz
                            freqMap[level] = frequencyGHz;
                        }
                    }
                }
    
                // Get the current frequency in GHz based on the current index
                let currentFrequencyGHz = freqMap[currentIndex];
    
                // Set the applet label to display the current frequency in GHz
                if (currentFrequencyGHz) {
                    this.set_applet_label(`${currentFrequencyGHz} GHz`);
                    this.set_applet_tooltip(_("Current CPU Frequency"));
                } else {
                    // If the frequency corresponding to the current index is not found, set the label to "unknown"
                    this.set_applet_label("unknown");
                    this.set_applet_tooltip(_("Current CPU Frequency"));
                }
            } else {
                // If the frequency retrieval command fails, set the label to "unknown"
                this.set_applet_label("unknown");
                this.set_applet_tooltip(_("Current CPU Frequency"));
            }
        } else {
            // If the initial command fails, set the label to "unknown"
            this.set_applet_label("unknown");
            this.set_applet_tooltip(_("Current CPU Frequency"));
        }
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
                    let frequencyHz = parseInt(parts[2], 10);
                    let frequencyGHz = (frequencyHz / 1000000).toFixed(2);  // Convert to GHz
                    freqMap[level] = frequencyGHz;
                }
            }
        }

        // Create a submenu for selecting throttle values
        this._sliderMenuItem = new PopupMenu.PopupSubMenuMenuItem(_("Select Throttle Level"));
        this.menu.addMenuItem(this._sliderMenuItem);

        // Create menu items for each level (0 to 8) with frequencies in GHz
        for (let level in freqMap) {
            let frequency = freqMap[level];
            let label = `Level ${level} (${frequency} GHz)`;
            let item = new PopupMenu.PopupMenuItem(label);
            item.connect('activate', function() {
                this._onValueSelected(level);
            }.bind(this));
            this._sliderMenuItem.menu.addMenuItem(item);
        }
    },

    _onValueSelected: function(level) {
        // Execute the script with the selected level as an argument
        Util.spawnCommandLine(`${this.ThrottleBin} ${level}`);

        // Show "Updating..." to indicate the frequency is being updated
        this.set_applet_label("Updating...");
        this.set_applet_tooltip(_("Applying new CPU frequency..."));

        // Delay the frequency label update by 3 seconds
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 3000, Lang.bind(this, this._updateFrequencyLabel));
    },

    on_applet_clicked: function() {
        this.menu.toggle();  // Show/hide the dropdown menu
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(orientation, panel_height, instance_id);
}
