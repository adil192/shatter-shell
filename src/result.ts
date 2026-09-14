export type Result<T, E> = Ok<T> | Err<E>;

export interface Ok<T> {
    ok: true;
    value: T;
}

export interface Err<E> {
    ok: false;
    why: E;
}

export function Ok<T, E>(value: T): Result<T, E> {
    return { ok: true, value };
}

export function Err<T, E>(why: E): Result<T, E> {
    return { ok: false, why };
}
