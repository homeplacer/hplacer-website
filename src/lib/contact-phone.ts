// Client-side structural validation only; the intake API must enforce the same
// required-phone contract independently. This does not verify reachability.
// Literal parentheses/hyphens are escaped for the HTML pattern's Unicode v mode.
export const CONTACT_PHONE_PATTERN = " *\\+?[0-9\\(\\). \\-]+";
const phoneFormat = new RegExp(`^(?:${CONTACT_PHONE_PATTERN})$`);

export function isValidContactPhone(value: string): boolean {
  const phone = value.trim();
  if (!phoneFormat.test(phone)) return false;
  const digits = phone.replace(/\D/g, "");
  if (phone.startsWith("+")) return digits.length >= 7 && digits.length <= 15;
  return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
}
