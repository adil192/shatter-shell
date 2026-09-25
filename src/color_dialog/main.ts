#!/usr/bin/gjs --module

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk';

const EXT_PATH_DEFAULTS = [
    GLib.get_home_dir() + '/.local/share/gnome-shell/extensions/',
    '/usr/share/gnome-shell/extensions/',
];
const DEFAULT_HINT_COLOR = 'rgba(53, 132, 228, 1)'; // adwaita blue

/** Look for the extension in path */
function getExtensionPath(uuid: string) {
    let ext_path = null;

    for (let i = 0; i < EXT_PATH_DEFAULTS.length; i++) {
        const path = EXT_PATH_DEFAULTS[i];
        const file = Gio.File.new_for_path(path + uuid);
        log(file.get_path()!);
        if (file.query_exists(null)) {
            ext_path = file;
            break;
        }
    }

    return ext_path;
}

function getSettings(schema: string) {
    const extensionPath = getExtensionPath('shatter-shell@adilhanney.com');
    if (!extensionPath) throw new Error('getSettings() can only be called when extension is available');

    // The following will load a custom path for a user defined gsettings/schemas folder
    const GioSSS = Gio.SettingsSchemaSource;
    const schemaDir = extensionPath.get_child('schemas');

    const schemaSource = schemaDir.query_exists(null)
        ? GioSSS.new_from_directory(schemaDir.get_path()!, GioSSS.get_default(), false)
        : GioSSS.get_default();

    const schemaObj = schemaSource?.lookup(schema, true);

    if (!schemaObj) {
        throw new Error('Schema ' + schema + ' could not be found for extension ');
    }
    return new Gio.Settings({ settings_schema: schemaObj });
}
/**
 * Launch a Gtk.ColorDialog. And then save the color RGBA/alpha values in GSettings of shatter-shell.
 * Using the settings.connect('changed') mechanism, the extension is able to listen to when the color changes in realtime.
 */
function launch_color_dialog(application: Gtk.Application) {
    const settings = getSettings('org.gnome.shell.extensions.shatter-shell');

    const win = new Gtk.ApplicationWindow({
        application,
        title: 'Choose Color',
        modal: true,
        visible: false,
    });

    const rgba = new Gdk.RGBA();
    const _ = rgba.parse(settings.get_string('hint-color-rgba')) || rgba.parse(DEFAULT_HINT_COLOR);

    const color_dialog = new Gtk.ColorDialog({
        title: 'Choose Color',
        with_alpha: true,
    });

    color_dialog.choose_rgba(win, rgba, null, (_, result) => {
        try {
            const rgba = color_dialog.choose_rgba_finish(result);
            settings.set_string('hint-color-rgba', rgba.to_string());
            Gio.Settings.sync();
        } catch { /* Dialog dismissed by user */ }
        win.close();
        application.quit();
    });
}

function main() {
    const application = new Gtk.Application({
        application_id: 'org.gnome.shell.extensions.shatter-shell.color-dialog',
    });
    application.connect('activate', () => launch_color_dialog(application));
    return application.run(null);
}

main();
