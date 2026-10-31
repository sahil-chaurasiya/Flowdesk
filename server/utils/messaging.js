const nodemailer = require('nodemailer');

// ─── Email ────────────────────────────────────────────────────────────────────

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendWelcomeEmail({ toEmail, clientName, portalEmail, portalPassword, loginUrl }) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('[Email] SMTP not configured — skipping welcome email.');
    return;
  }

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a2e">
      <h2 style="color:#4f6ef0">Welcome to the Client Portal, ${clientName}!</h2>
      <p>Your account has been created. Here are your login credentials:</p>
      <table style="background:#f5f7ff;border-radius:8px;padding:16px;width:100%;border-collapse:collapse">
        <tr><td style="padding:6px 12px;font-weight:bold;width:40%">Portal URL</td><td style="padding:6px 12px"><a href="${loginUrl}">${loginUrl}</a></td></tr>
        <tr><td style="padding:6px 12px;font-weight:bold">Email</td><td style="padding:6px 12px">${portalEmail}</td></tr>
        <tr><td style="padding:6px 12px;font-weight:bold">Password</td><td style="padding:6px 12px"><code>${portalPassword}</code></td></tr>
      </table>
      <p style="margin-top:20px;color:#666;font-size:13px">Please change your password after your first login.</p>
      <p style="margin-top:32px;color:#999;font-size:12px">If you have any questions, reply to this email or contact your account manager.</p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject: 'Your Client Portal Credentials',
    html,
  });

  console.log(`[Email] Welcome email sent to ${toEmail}`);
}

// ─── WhatsApp via Twilio ──────────────────────────────────────────────────────

async function sendWelcomeWhatsApp({ whatsappPhone, clientName, portalEmail, portalPassword, loginUrl }) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_WHATSAPP_FROM) {
    console.warn('[WhatsApp] Twilio not configured — skipping WhatsApp message.');
    return;
  }

  // Normalise number: strip non-digits then prefix with +
  const raw = (whatsappPhone || '').replace(/\D/g, '');
  if (!raw) {
    console.warn('[WhatsApp] No phone number provided — skipping WhatsApp message.');
    return;
  }
  const to = `whatsapp:+${raw}`;
  const from = process.env.TWILIO_WHATSAPP_FROM.startsWith('whatsapp:')
    ? process.env.TWILIO_WHATSAPP_FROM
    : `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`;

  const body =
    `Hi ${clientName}! 👋\n\n` +
    `Your client portal account is ready.\n\n` +
    `🔗 *Portal:* ${loginUrl}\n` +
    `📧 *Email:* ${portalEmail}\n` +
    `🔑 *Password:* ${portalPassword}\n\n` +
    `Please log in and change your password at your earliest convenience.`;

  const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  await twilio.messages.create({ from, to, body });

  console.log(`[WhatsApp] Welcome message sent to ${to}`);
}

// ─── Combined helper ──────────────────────────────────────────────────────────

async function sendClientWelcomeMessages({ client, portalEmail, portalPassword }) {
  const loginUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  const results = await Promise.allSettled([
    // Email — use portalEmail as the login email
    sendWelcomeEmail({
      toEmail: portalEmail,
      clientName: client.name,
      portalEmail,
      portalPassword,
      loginUrl,
    }),
    // WhatsApp — use whatsappPhone field if present, else fall back to phone
    sendWelcomeWhatsApp({
      whatsappPhone: client.whatsappPhone || client.phone,
      clientName: client.name,
      portalEmail,
      portalPassword,
      loginUrl,
    }),
  ]);

  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[Messaging] Channel ${i === 0 ? 'email' : 'whatsapp'} failed:`, r.reason?.message || r.reason);
    }
  });
}

module.exports = { sendClientWelcomeMessages };