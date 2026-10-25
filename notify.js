// Notification emails via EmailJS (loaded globally from the EmailJS CDN script).
//
// SETUP: in EmailJS create ONE template (Email Templates → Create New) with
//   To email:  {{to_email}}
//   Subject:   {{subject}}
//   Content:   {{message}}
// then paste its Template ID below. Until then, notifications are skipped
// (everything is still saved in Firebase).
//
// HIPAA: notification emails must never contain health details — only
// "you have something new, please log in".
const EMAILJS_SERVICE_ID = 'service_txf5npp';
const EMAILJS_PUBLIC_KEY = 'GLrZXNUH4Ja0S0--j';
const NOTIFY_TEMPLATE_ID = 'YOUR_NOTIFY_TEMPLATE_ID';

export const KELLY_EMAIL = 'QuestforWellness22@gmail.com';
export const PORTAL_URL = 'https://questforwellnessllc.com/client-portal';

export const notificationsConfigured = () =>
  NOTIFY_TEMPLATE_ID !== 'YOUR_NOTIFY_TEMPLATE_ID' && typeof window.emailjs !== 'undefined';

/** Send a notification email. Never throws; returns true if sent. */
export async function sendNotification({ to_email, subject, message }) {
  if (!notificationsConfigured()) {
    console.warn('Notification email skipped: EmailJS notify template not configured.');
    return false;
  }
  try {
    await window.emailjs.send(EMAILJS_SERVICE_ID, NOTIFY_TEMPLATE_ID, { to_email, subject, message }, EMAILJS_PUBLIC_KEY);
    return true;
  } catch (err) {
    console.error('Notification email failed:', err);
    return false;
  }
}
