/**
 * Normalize a phone number to canonical format.
 * Supports Pakistan mobile formats: 03XXXXXXXXX, 923XXXXXXXXX, +923XXXXXXXXX → +923XXXXXXXXX
 * Also handles general E.164 numbers (10-15 digits).
 */
function normalizePhoneNumber(phoneInput) {
  if (!phoneInput || typeof phoneInput !== 'string') return null;

  const cleaned = phoneInput.replace(/[\s\-\.\(\)]/g, '').trim();

  // Validate Pakistan mobile formats: 03XXXXXXXXX, 923XXXXXXXXX, +923XXXXXXXXX
  const pkMatch = cleaned.match(/^(?:\+?92|0)?(3\d{9})$/);
  if (pkMatch) {
    return `+92${pkMatch[1]}`;
  }

  // General E.164 phone numbers (10 to 15 digits)
  const intlMatch = cleaned.match(/^(\+?\d{10,15})$/);
  if (intlMatch) {
    let num = intlMatch[1];
    if (!num.startsWith('+')) {
      num = '+' + num;
    }
    return num;
  }

  return null;
}

module.exports = { normalizePhoneNumber };
