import QRCode from 'qrcode';

export const APP_MOBILE_URL = 'https://smart-irm.ai.studio';
export const APP_MOBILE_DOMAIN = 'smart-irm.ai.studio';

export async function generateQRCodeDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: 320,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('Failed to generate QR code data URL:', err);
    return '';
  }
}

export function getPatientTrackingUrl(queueNumber?: string, patientId?: string, forceDomain?: boolean): string {
  // Use https://smart-irm.ai.studio as official mobile link or origin
  let baseUrl = APP_MOBILE_URL;
  
  if (!forceDomain && typeof window !== 'undefined' && window.location.hostname && !window.location.hostname.includes('localhost')) {
    // If running in live environment, use current origin
    baseUrl = `${window.location.origin}${window.location.pathname}`;
  }

  try {
    const url = new URL(baseUrl);
    if (queueNumber) {
      url.searchParams.set('track', queueNumber.trim());
    } else if (patientId) {
      url.searchParams.set('id', patientId.trim());
    } else {
      url.searchParams.set('mode', 'patient');
    }
    return url.toString();
  } catch {
    return `${APP_MOBILE_URL}${queueNumber ? `?track=${encodeURIComponent(queueNumber)}` : ''}`;
  }
}

export function getWhatsAppShareUrl(patientName: string, queueNumber: string, boxTitle: string, trackingUrl: string): string {
  const queueText = queueNumber && queueNumber.trim() ? `Nomor Antrean: *${queueNumber}*\n` : '';
  const message = `*TIKET ANTRIAN ONLINE IRM RSPP*\n\n` +
    `Halo ${patientName},\n` +
    queueText +
    `Tujuan: *${boxTitle}*\n\n` +
    `Akses aplikasi & pantau antrean Anda secara live di HP Anda melalui tautan:\n` +
    `${trackingUrl || APP_MOBILE_URL}\n\n` +
    `Link Aplikasi: *${APP_MOBILE_DOMAIN}*\n\n` +
    `_Instalasi Rehabilitasi Medis RSPP_`;

  return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
}
