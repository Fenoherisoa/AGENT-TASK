/**
 * Clipboard Assistant
 * Provides rapid copy utilities for operator task handling.
 * Enforces security policy: NEVER copies OTPs, session cookies, or tokens.
 */

export interface CopyResult {
  success: boolean;
  field: string;
  value?: string;
  error?: string;
}

export async function copyToClipboard(fieldName: string, textToCopy: string | undefined): Promise<CopyResult> {
  if (!textToCopy || textToCopy.trim() === '') {
    return {
      success: false,
      field: fieldName,
      error: `Champ ${fieldName} vide`
    };
  }

  // Safety check: prohibit copying cookies, session tokens or OTP keywords
  const lower = fieldName.toLowerCase();
  if (lower.includes('cookie') || lower.includes('otp') || lower.includes('session')) {
    return {
      success: false,
      field: fieldName,
      error: 'Action non autorisée: les tokens et cookies ne sont pas gérés automatiquement'
    };
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(textToCopy);
      return { success: true, field: fieldName, value: textToCopy };
    } else {
      // Fallback for non-https / older webview contexts
      const textArea = document.createElement('textarea');
      textArea.value = textToCopy;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      textArea.remove();

      if (successful) {
        return { success: true, field: fieldName, value: textToCopy };
      }
      return { success: false, field: fieldName, error: 'Échec de la commande de copie' };
    }
  } catch (err: any) {
    return {
      success: false,
      field: fieldName,
      error: err.message || 'Erreur d\'accès au presse-papier'
    };
  }
}
