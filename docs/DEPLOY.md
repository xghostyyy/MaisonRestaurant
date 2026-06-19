# Deployment Guide

Production deployment on a Linux VPS using **Caddy** (reverse proxy + TLS) and **PM2** (process manager).

---

## Prerequisites

- Ubuntu 22.04 / Debian 12 server
- Domain pointed at the server IP
- Node.js 20 LTS installed (`nvm` recommended)
- `npm`, `git` installed

---

## 1. Install PM2

```bash
npm install -g pm2
```

---

## 2. Install Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy
```

---

## 3. Clone and configure the app

```bash
git clone https://github.com/xghostyyy/MaisonRestaurant.git /srv/maison
cd /srv/maison
npm ci --omit=dev
```

Create `.env`:

```bash
cp .env.example .env
nano .env
```

Fill in all values — especially:
- `SESSION_SECRET` — random 32+ character string (`openssl rand -hex 32`)
- `NODE_ENV=production`
- `PORT=3000`
- SMTP credentials (or leave blank to print to logs)
- `APP_URL=https://yourdomain.com`

Run migrations and seed:

```bash
npm run setup
```

---

## 4. PM2 process configuration

Create `ecosystem.config.cjs` in the project root:

```js
module.exports = {
  apps: [
    {
      name: 'maison',
      script: 'server.js',
      instances: 1,          // SQLite is single-writer — keep at 1
      exec_mode: 'fork',
      env_file: '.env',
      out_file: '/var/log/maison/out.log',
      error_file: '/var/log/maison/err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
}
```

```bash
sudo mkdir -p /var/log/maison
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # follow the printed command to enable auto-start on boot
```

---

## 5. Caddy configuration

`/etc/caddy/Caddyfile`:

```caddyfile
yourdomain.com {
    reverse_proxy localhost:3000

    # Cache static assets
    @static path /css/* /js/* /img/* /uploads/*
    header @static Cache-Control "public, max-age=31536000, immutable"

    encode gzip
    log {
        output file /var/log/caddy/maison.access.log
    }
}
```

Reload Caddy:

```bash
sudo systemctl reload caddy
```

Caddy automatically provisions a Let's Encrypt TLS certificate.

---

## 6. SQLite backup (cron)

SQLite's `.backup` command produces a safe hot copy. Add a daily backup cron:

```bash
sudo crontab -e
```

Add:

```cron
# Daily backup of Maison DB at 03:00
0 3 * * * sqlite3 /srv/maison/data/app.db ".backup '/srv/maison/backups/app-$(date +\%Y\%m\%d).db'" && find /srv/maison/backups -name '*.db' -mtime +30 -delete
```

Create the backup directory:

```bash
mkdir -p /srv/maison/backups
```

This keeps 30 days of daily backups. For off-site copies, pipe to an S3-compatible store with `rclone` or `aws s3 cp`.

---

## 7. Deploying updates

```bash
cd /srv/maison
git pull origin main
npm ci --omit=dev
npm run setup          # safe to re-run — migrations are idempotent
pm2 reload maison      # zero-downtime reload
```

---

## 8. Monitoring

```bash
pm2 monit              # real-time CPU/RAM dashboard
pm2 logs maison        # tail logs
pm2 status             # process list
```

---

## Security checklist for production

- [ ] `NODE_ENV=production` set
- [ ] `SESSION_SECRET` is a strong random value (not the default)
- [ ] Firewall blocks port 3000 from the public; only Caddy proxies to it (`ufw allow 80,443/tcp && ufw deny 3000`)
- [ ] `.env` not readable by other users (`chmod 600 .env`)
- [ ] `data/` and `backups/` not under the web root
- [ ] Automatic security updates enabled (`unattended-upgrades`)
- [ ] SSH key auth only (no password login)
