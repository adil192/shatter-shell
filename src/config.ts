import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

const CONF_DIR = GLib.get_user_config_dir() + '/shatter-shell';
export const CONF_FILE = CONF_DIR + '/config.json';

export interface FloatRule {
    class?: string;
    title?: string;
    disabled?: boolean;
}

interface Ok<T> {
    tag: 0;
    value: T;
}

interface Error {
    tag: 1;
    why: string;
}

type Result<T> = Ok<T> | Error;

export const DEFAULT_FLOAT_RULES: Array<FloatRule> = [
    { class: 'Authy Desktop' },
    { class: 'com.github.amezin.ddterm' },
    { class: 'com.github.donadigo.eddy' },
    { class: 'Conky' },
    { title: 'Discord Updater' },
    { class: 'Enpass', title: 'Enpass Assistant' },
    { class: 'Gjs', title: 'Settings' },
    { class: 'Gnome-initial-setup' },
    { class: 'Gnome-terminal', title: 'Preferences – General' },
    { class: 'Guake' },
    { class: 'Io.elementary.sideload' },
    { title: 'JavaEmbeddedFrame' },
    { class: 'KotatogramDesktop', title: 'Media viewer' },
    { class: 'Mozilla VPN' },
    { class: 'update-manager', title: 'Software Updater' },
    { class: 'Solaar' },
    { class: 'steam', title: '^((?!Steam).)*$' },
    { class: 'steam', title: '^.*(Guard|Login|Sign in).*' },
    { class: 'steam', title: 'Sign in to Steam' },
    { class: 'TelegramDesktop', title: 'Media viewer' },
    { class: 'Zotero', title: 'Quick Format Citation' },
    { class: 'firefox', title: '^(?!.*Mozilla Firefox).*$' },
    { class: 'org.mozilla.firefox', title: 'Picture-in-Picture' },
    { class: 'org.mozilla.firefox', title: 'About Mozilla Firefox' },
    { class: 'gnome-screenshot' },
    { class: 'ibus-.*' },
    { class: 'jetbrains-toolbox' },
    { class: 'jetbrains-webstorm', title: 'Customize WebStorm' },
    { class: 'jetbrains-webstorm', title: 'License Activation' },
    { class: 'jetbrains-webstorm', title: 'Welcome to WebStorm' },
    { class: 'krunner' },
    { class: 'pritunl' },
    { class: 're.sonny.Junction' },
    { class: 'system76-driver' },
    { class: 'tilda' },
    { class: 'zoom' },
    { class: '^.*action=join.*$' },
    { class: 'gjs' },
    { class: 'git-credential-manager' },
    { class: 'xwaylandvideobridge' },
];

const _regExpCache = new Map<string, RegExp>();
function getRegExp(pattern: string) {
    let regExp = _regExpCache.get(pattern);
    if (!regExp) {
        regExp = new RegExp(pattern, 'i');
        _regExpCache.set(pattern, regExp);
    }
    return regExp;
}

export class Config {
    /** List of windows that should float, regardless of their WM hints */
    float: Array<FloatRule> = [];

    /** Logs window details on focus of window */
    log_on_focus: boolean = false;

    /** Add a floating exception which matches by wm_class */
    add_app_exception(wmclass: string) {
        for (const r of this.float) {
            if (r.class === wmclass && r.title === undefined) return;
        }

        this.float.push({ class: wmclass });
        this.sync_to_disk();
    }

    /** Add a floating exception which matches by wm_title */
    add_window_exception(wmclass: string, title: string) {
        for (const r of this.float) {
            if (r.class === wmclass && r.title === title) return;
        }

        this.float.push({ class: wmclass, title });
        this.sync_to_disk();
    }

    window_shall_float(wclass: string, title: string): boolean {
        for (const rule of this.float.concat(DEFAULT_FLOAT_RULES)) {
            if (rule.class && !getRegExp(rule.class).test(wclass)) continue;

            if (rule.title && !getRegExp(rule.title).test(title)) continue;

            return !rule.disabled;
        }

        return false;
    }

    reload() {
        const conf = Config.from_config();

        if (conf.tag === 0) {
            const c = conf.value;
            this.float = c.float;
            this.log_on_focus = c.log_on_focus;
        } else {
            log(`error loading conf: ${conf.why}`);
        }
    }

    rule_disabled(rule: FloatRule): boolean {
        for (const value of this.float.values()) {
            if (value.disabled && rule.class === value.class && value.title === rule.title) {
                return true;
            }
        }

        return false;
    }

    to_json(): string {
        return JSON.stringify(this, set_to_json, 2);
    }

    toggle_system_exception(wmclass: string | undefined, wmtitle: string | undefined, disabled: boolean) {
        if (disabled) {
            for (const value of DEFAULT_FLOAT_RULES) {
                if (value.class === wmclass && value.title === wmtitle) {
                    value.disabled = disabled;
                    this.float.push(value);
                    this.sync_to_disk();
                    return;
                }
            }
        }

        let index = 0;
        let found = false;
        for (const value of this.float) {
            if (value.class === wmclass && value.title === wmtitle) {
                found = true;
                break;
            }
            index += 1;
        }

        if (found) swap_remove(this.float, index);

        this.sync_to_disk();
    }

    remove_user_exception(wmclass: string | undefined, wmtitle: string | undefined) {
        let index = 0;
        const found = [];
        for (const value of this.float.values()) {
            if (value.class === wmclass && value.title === wmtitle) {
                found.push(index);
            }

            index += 1;
        }

        if (found.length !== 0) {
            for (const idx of found) swap_remove(this.float, idx);

            this.sync_to_disk();
        }
    }

    static from_json(json: string): Config {
        try {
            return JSON.parse(json);
        } catch (_) {
            return new Config();
        }
    }

    private static from_config(): Result<Config> {
        const stream = Config.read();
        if (stream.tag === 1) return stream;
        const value = Config.from_json(stream.value);
        return { tag: 0, value };
    }

    private static gio_file(): Result<Gio.File> {
        try {
            const conf = Gio.File.new_for_path(CONF_FILE);

            if (!conf.query_exists(null)) {
                const dir = Gio.File.new_for_path(CONF_DIR);
                if (!dir.query_exists(null) && !dir.make_directory(null)) {
                    return { tag: 1, why: 'failed to create shatter-shell config directory' };
                }

                const example = new Config();
                example.float.push({ class: 'shatter-shell-example', title: 'shatter-shell-example' });

                conf.create(Gio.FileCreateFlags.NONE, null).write_all(JSON.stringify(example, undefined, 2), null);
            }

            return { tag: 0, value: conf };
        } catch (why) {
            return { tag: 1, why: `Gio.File I/O error: ${why}` };
        }
    }

    private static read(): Result<string> {
        try {
            const file = Config.gio_file();
            if (file.tag === 1) return file;

            const [, buffer] = file.value.load_contents(null);

            return { tag: 0, value: imports.byteArray.toString(buffer) };
        } catch (why) {
            return { tag: 1, why: `failed to read shatter-shell config: ${why}` };
        }
    }

    private static write(data: string): Result<Gio.File> {
        try {
            const file = Config.gio_file();
            if (file.tag === 1) return file;

            file.value.replace_contents(data, null, false, Gio.FileCreateFlags.NONE, null);

            return { tag: 0, value: file.value };
        } catch (why) {
            return { tag: 1, why: `failed to write to config: ${why}` };
        }
    }

    sync_to_disk() {
        Config.write(this.to_json());
    }
}

function set_to_json(_key: string, value: unknown) {
    if (typeof value === 'object' && value instanceof Set) {
        return [...value];
    }
    return value;
}

function swap_remove<T>(array: Array<T>, index: number): T | undefined {
    array[index] = array[array.length - 1];
    return array.pop();
}
