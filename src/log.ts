// simplified log4j levels
export enum LOG_LEVELS {
    OFF,
    ERROR,
    WARN,
    INFO,
    DEBUG,
}

/**
 * parse level at runtime so we don't have to restart shattershell
 */
export function log_level(): LOG_LEVELS {
    // log.js is at the level of prefs.js where the shattershell Ext instance
    // is not yet available or visible, so we have to use the built in
    // ExtensionUtils to get the current settings
    const settings = globalThis.shatterShellExtension?.getSettings();
    const log_level = settings?.get_uint('log-level') ?? LOG_LEVELS.OFF;
    return log_level;
}

export function log(text: string) {
    globalThis.log('shatter-shell: ' + text);
}

export function error(text: string) {
    if (log_level() > LOG_LEVELS.OFF) log('[ERROR] ' + text);
}

export function warn(text: string) {
    if (log_level() > LOG_LEVELS.ERROR) log('[WARN] ' + text);
}

export function info(text: string) {
    if (log_level() > LOG_LEVELS.WARN) log('[INFO] ' + text);
}

export function debug(text: string) {
    if (log_level() > LOG_LEVELS.INFO) log('[DEBUG] ' + text);
}
