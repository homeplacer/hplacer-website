// Preserve the public forms' permissive formatting rule: at least seven digits,
// punctuation, or whitespace characters. HTML compiles patterns in Unicode v
// mode, which requires escaping literal parentheses and hyphens in a class.
export const PUBLIC_PHONE_PATTERN = "[0-9\\(\\)+.\\s\\-]{7,}";
