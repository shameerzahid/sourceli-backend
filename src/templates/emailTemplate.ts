/**
 * HTML email template matching Sourceli landing page branding.
 * Uses inline styles for maximum email client compatibility.
 *
 * Colors from landing: primary #293E31, accent #FE8340, background #F5F5F0,
 * text light #FCF9F4, text gray #4A4A4A, footer #27372b, secondary #DACEC2
 */
const BRAND = {
  primary: '#293E31',
  primaryDark: '#27372b',
  accent: '#FE8340',
  accentHover: '#e87538',
  background: '#F5F5F0',
  secondary: '#DACEC2',
  textLight: '#FCF9F4',
  textGray: '#4A4A4A',
  textDark: '#404A3D',
  white: '#ffffff',
  border: '#E5E5E0',
} as const;

/**
 * Escape HTML to prevent XSS and break long URLs for wrapping.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Convert plain text message to HTML paragraphs (preserve line breaks).
 */
function messageToHtml(message: string): string {
  const escaped = escapeHtml(message);
  return escaped
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:${BRAND.textGray};">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

/**
 * Build full HTML email with Sourceli branding.
 */
export function getEmailHtml(title: string, message: string): string {
  const bodyHtml = messageToHtml(message);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(title)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${BRAND.background};font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:${BRAND.background};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color:${BRAND.primary};padding:24px 28px;text-align:center;">
              <span style="font-size:22px;font-weight:700;color:${BRAND.textLight};letter-spacing:-0.02em;">Sourceli</span>
              <div style="height:4px;width:48px;background-color:${BRAND.accent};margin:12px auto 0;border-radius:2px;"></div>
            </td>
          </tr>
          <!-- Title -->
          <tr>
            <td style="background-color:${BRAND.white};padding:28px 28px 8px;border-bottom:1px solid ${BRAND.border};">
              <h1 style="margin:0;font-size:20px;font-weight:600;color:${BRAND.primary};line-height:1.3;">${escapeHtml(title)}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background-color:${BRAND.white};padding:20px 28px 32px;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:${BRAND.primaryDark};padding:20px 28px;text-align:center;">
              <p style="margin:0;font-size:12px;color:${BRAND.secondary};opacity:0.95;">You received this email from Sourceli.</p>
              <p style="margin:6px 0 0;font-size:12px;color:${BRAND.secondary};opacity:0.8;">© Sourceli · Fresh produce marketplace</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
