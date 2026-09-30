import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

export const WelcomePage = GObject.registerClass(class WelcomePage extends Gtk.Box {
    constructor() {
        super({
            orientation: Gtk.Orientation.VERTICAL,
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER,
            spacing: 4,
        });

        this.append(new Gtk.Label({
            label: '<span size="xx-large">Welcome to Shatter Shell</span>',
            use_markup: true,
            margin_bottom: 16,
        }));

        this.append(new Gtk.Label({
            label: `For full functionality of Shatter Shell, some of your system's default keybindings need updating.`,
            justify: Gtk.Justification.CENTER,
        }));
        this.append(new Gtk.Label({
            label: 'Click the button below to complete setup.',
            justify: Gtk.Justification.CENTER,
            margin_bottom: 32,
        }));

        {
            const button = new Gtk.Button();
            button.label = 'Setup keyboard shortcuts';
            button.add_css_class('suggested-action');
            button.add_css_class('pill');
            this.append(button);
        }
        {
            const button = new Gtk.Button();
            button.label = 'Or opt out';
            button.add_css_class('pill');
            button.add_css_class('flat');
            this.append(button);
        }
    }
});
