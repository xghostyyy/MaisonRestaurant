export const config = {
  PORT: parseInt(process.env.PORT) || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  SESSION_SECRET:
    process.env.SESSION_SECRET || 'maison-dev-secret-change-in-production-32chars!!',
  DB_PATH: process.env.DB_PATH || './data/app.db',
  BASE_URL: process.env.BASE_URL || 'http://localhost:3000',
  EMAIL_HOST: process.env.EMAIL_HOST || 'localhost',
  EMAIL_PORT: parseInt(process.env.EMAIL_PORT) || 1025,
  EMAIL_USER: process.env.EMAIL_USER || '',
  EMAIL_PASS: process.env.EMAIL_PASS || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'Maison <noreply@maison.restaurant>',
  isProd: process.env.NODE_ENV === 'production',
}
