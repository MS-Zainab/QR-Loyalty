/**
 * Copy text to clipboard with fallback for browsers without navigator.clipboard support.
 * Returns true if successful, false otherwise.
 */
export async function copyToClipboard(text) {
  // Primary method: modern Clipboard API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('Clipboard API failed, trying fallback:', err);
    }
  }

  // Fallback method: textarea + execCommand (works in most browsers including HTTP localhost)
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const success = document.execCommand('copy');
    document.body.removeChild(textarea);

    if (success) {
      return true;
    } else {
      console.error('execCommand copy failed');
      return false;
    }
  } catch (err) {
    console.error('Clipboard fallback failed:', err);
    return false;
  }
}
