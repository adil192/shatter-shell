import Gio from 'gi://Gio';
import { LogLevel } from './log_level.js';

/**
 * A wrapper around {@link console.log} and similar methods.
 *
 * Shatter Shell is a chatty program so this class applies a user-controlled
 * {@link LogLevel} filter.
 */
export class Log {
    static settings: Gio.Settings | null;

    static log_level(): LogLevel {
        return this.settings?.get_uint('log-level') ?? LogLevel.OFF;
    }

    static error(msg: string) {
        if (this.log_level() < LogLevel.ERROR) return;
        console.error(`shatter-shell: [ERROR] ${msg}`);
    }

    static warn(msg: string) {
        if (this.log_level() < LogLevel.WARN) return;
        console.warn(`shatter-shell: [WARN] ${msg}`);
    }

    static info(msg: string) {
        if (this.log_level() < LogLevel.INFO) return;
        console.info(`shatter-shell: [INFO] ${msg}`);
    }

    static debug(msg: string) {
        if (this.log_level() < LogLevel.DEBUG) return;
        console.debug(`shatter-shell: [DEBUG] ${msg}`);
    }
}
export { LogLevel };
