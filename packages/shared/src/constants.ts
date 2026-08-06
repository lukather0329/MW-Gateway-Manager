// Domain: labels of 1-63 chars, alnum + hyphen, dot-separated, no leading/trailing hyphen per label.
export const DOMAIN_REGEX =
  /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))+$/;

// Host: IPv4, "localhost", or a simple hostname (letters/digits/hyphen/dot).
export const HOST_REGEX = /^[A-Za-z0-9.-]{1,253}$/;

export const MIN_PORT = 1;
export const MAX_PORT = 65535;
export const SYSTEM_PORTS = new Set([80, 443]);

// Any of these characters occurring in a field that ends up in a filename,
// Apache directive, or spawned command argument is rejected outright.
export const DANGEROUS_CHARS_REGEX = /["';|&`<>$\r\n]|\.\.(\/|\\)/;

export const HEALTH_CHECK_DEFAULT_TIMEOUT_MS = 3000;
