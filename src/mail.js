import nodemailer from 'nodemailer'
import { config } from './config.js'

let transporter

function getTransporter() {
  if (!transporter) {
    if (!config.EMAIL_HOST || config.EMAIL_HOST === 'localhost') {
      // Dev: log to console
      transporter = { sendMail: async (opts) => { console.log('[MAIL]', JSON.stringify(opts, null, 2)); return { messageId: 'dev' } } }
    } else {
      transporter = nodemailer.createTransport({
        host: config.EMAIL_HOST,
        port: config.EMAIL_PORT,
        auth: config.EMAIL_USER ? { user: config.EMAIL_USER, pass: config.EMAIL_PASS } : undefined,
      })
    }
  }
  return transporter
}

export async function sendReservationConfirmation(reservation) {
  const manageUrl = `${config.BASE_URL}/reserve/${reservation.manage_token}`
  const date = new Date(reservation.starts_at)
  const dateStr = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

  await getTransporter().sendMail({
    from: config.EMAIL_FROM,
    to: reservation.guest_email,
    subject: `Ваша бронь в Maison — ${dateStr}`,
    text: `
Здравствуйте, ${reservation.guest_name}!

Ваша заявка на бронирование получена.

Дата: ${dateStr}
Время: ${timeStr}
Гостей: ${reservation.party_size}

Статус: Ожидает подтверждения. Мы свяжемся с вами в ближайшее время.

Управление бронью (перенос / отмена):
${manageUrl}

С уважением,
Ресторан Maison
    `.trim(),
    html: `
<p>Здравствуйте, <strong>${reservation.guest_name}</strong>!</p>
<p>Ваша заявка на бронирование получена.</p>
<table style="margin:16px 0">
  <tr><td style="padding:4px 16px 4px 0;color:#5C5650">Дата</td><td>${dateStr}</td></tr>
  <tr><td style="padding:4px 16px 4px 0;color:#5C5650">Время</td><td>${timeStr}</td></tr>
  <tr><td style="padding:4px 16px 4px 0;color:#5C5650">Гостей</td><td>${reservation.party_size}</td></tr>
</table>
<p>Статус: <strong>Ожидает подтверждения</strong>. Мы свяжемся с вами в ближайшее время.</p>
<p><a href="${manageUrl}" style="display:inline-block;padding:12px 24px;background:#D98A2B;color:#fff;text-decoration:none;border-radius:6px">Управление бронью</a></p>
<p style="color:#5C5650;font-size:14px">Отмена возможна не позднее, чем за 4 часа до визита через ссылку выше.</p>
<p>С уважением,<br/>Ресторан Maison</p>
    `,
  })
}
