import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

export const WelcomePage = GObject.registerClass(class WelcomePage extends Gtk.Box {
    constructor() {
        super({
            orientation: Gtk.Orientation.VERTICAL,
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER,
        });
        this.append(new Gtk.Label({
            label: 'Welcome',
        }));
    }
});
