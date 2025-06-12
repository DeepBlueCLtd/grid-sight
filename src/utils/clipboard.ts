/**
 * Copies text to the clipboard using the modern Clipboard API with fallback to document.execCommand
 * @param text The text to copy to the clipboard
 * @returns A promise that resolves to true if the copy was successful, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Try the modern Clipboard API first
  if (navigator.clipboard && window.isSecureContext) {
    try {
      console.log('about to write text', text);
      await navigator.clipboard.writeText(text);
      console.log('written text')
      return true;
    } catch (err) {
      console.warn('Clipboard API failed, falling back to execCommand:', err);
    }
  }

  // Fallback to document.execCommand
  const textarea = document.createElement('textarea');
  
  // Make the textarea invisible
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  textarea.style.left = '0';
  textarea.style.top = '0';
  
  // Set the text and make it readonly
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  
  // Add to document
  document.body.appendChild(textarea);
  
  try {
    // Select the text
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    
    // Copy the text
    const success = document.execCommand('copy');
    if (!success) {
      throw new Error('execCommand("copy") returned false');
    }
    
    return true;
  } catch (err) {
    console.error('Failed to copy text:', err);
    return false;
  } finally {
    // Clean up
    if (document.body.contains(textarea)) {
      document.body.removeChild(textarea);
    }
  }
}
