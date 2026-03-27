# Deployment Guide

Complete guide for setting up CI/CD with GitHub Actions and deploying to your VPS.

## GitHub Actions Setup

### 1. CI Pipeline (Runs on every push/PR)

The `.github/workflows/ci.yml` file automatically:
- ✅ Installs dependencies
- ✅ Builds TypeScript
- ✅ Runs ESLint
- ✅ Checks code formatting
- ✅ Builds Docker image

This runs on Node 18 and 20 to ensure compatibility.

**Status:** Will show ✅/❌ on your PRs and commits.

### 2. Deploy Pipeline (Runs on push to `main`)

The `.github/workflows/deploy.yml` file:
- Connects to your VPS via SSH
- Pulls latest code
- Installs dependencies
- Builds the project
- Restarts the service with PM2
- Notifies Slack (optional)

## VPS Setup Requirements

### Create VPS Directory

SSH into your VPS and create the project directory:

```bash
ssh user@your-vps.com
sudo mkdir -p /var/www/shopify
sudo chown $USER:$USER /var/www/shopify
cd /var/www/shopify
```

### Initialize Git Repository

```bash
git init
git config user.email "deploy@example.com"
git config user.name "GitHub Deploy"
```

### Create PM2 Configuration

Create `ecosystem.config.cjs` on the VPS:

```javascript
module.exports = {
  apps: [
    {
      name: 'shopify-importer',
      script: 'dist/index.js',
      args: 'web',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
    },
  ],
};
```

### Create `.env` File

```bash
cd /var/www/shopify
cat > .env << EOF
SHOPIFY_STORE_URL=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxx
PORT=3000
DEBUG=false
EOF
```

### Install Dependencies

```bash
npm install -g pm2
npm install
npm run build
```

### Test PM2

```bash
pm2 start ecosystem.config.cjs
pm2 logs shopify-importer
pm2 save
```

Access at: `http://your-vps-ip:3000`

### Setup Nginx Reverse Proxy (Optional)

Create `/etc/nginx/sites-available/shopify.conf`:

```nginx
server {
    listen 80;
    server_name shopify.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and restart Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/shopify.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## GitHub Secrets Configuration

GitHub Actions needs these secrets to deploy. Go to:

**Settings → Secrets and variables → Actions → New repository secret**

Add these secrets:

| Secret Name | Value | Example |
|------------|-------|---------|
| `VPS_HOST` | Your VPS IP or domain | `192.168.1.100` |
| `VPS_USER` | SSH username | `cisco` |
| `VPS_SSH_KEY` | Private SSH key (RSA) | See below |
| `VPS_PORT` | SSH port (optional) | `22` |
| `SLACK_WEBHOOK` | Slack webhook URL (optional) | `https://hooks.slack.com/...` |

### Generate SSH Key for GitHub

On your VPS:

```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy
# Copy the entire private key output
```

Add the public key to authorized_keys:

```bash
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

**In GitHub:**
1. Go to repository Settings → Secrets
2. Click "New repository secret"
3. Name: `VPS_SSH_KEY`
4. Value: Paste the **entire** private key content (including `-----BEGIN RSA PRIVATE KEY-----`)
5. Save

### Optional: Slack Notifications

To enable Slack deployment notifications:

1. Go to your Slack workspace
2. Create an Incoming Webhook: https://api.slack.com/apps
3. Copy the webhook URL
4. Add it as a GitHub secret: `SLACK_WEBHOOK`

---

## Manual VPS Deployment

If you want to deploy manually without GitHub Actions:

```bash
ssh user@your-vps.com
cd /var/www/shopify

# Pull latest code
git fetch origin main
git reset --hard origin/main

# Install & build
npm install
npm run build

# Restart PM2
pm2 restart shopify-importer
pm2 save
```

---

## Monitoring Deployments

### GitHub Actions Dashboard

1. Go to your repository
2. Click **Actions** tab
3. See all workflow runs with status

### VPS Monitoring

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs shopify-importer

# Monitor processes
pm2 monit

# See app info
pm2 info shopify-importer
```

### Nginx Logs

```bash
# Access logs
tail -f /var/log/nginx/access.log

# Error logs
tail -f /var/log/nginx/error.log
```

---

## Troubleshooting

### Deployment fails with "Permission denied"

The SSH key or directory permissions are wrong:

```bash
# On VPS, check permissions
ls -la ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh

# Verify you can SSH
ssh -i ~/.ssh/github_deploy user@localhost
```

### "npm: command not found" on VPS

Node.js might not be installed:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version
npm --version
```

### PM2 not restarting app

Check if PM2 is running:

```bash
pm2 status
pm2 start ecosystem.config.cjs
pm2 save
sudo env PATH=$PATH:/usr/local/bin /usr/local/bin/pm2 startup -u $USER
```

### App runs but not accessible

Check port and firewall:

```bash
# Check if port is listening
netstat -tlnp | grep 3000

# Check firewall
sudo ufw allow 3000/tcp
```

### Nginx returning 502 Bad Gateway

App might have crashed:

```bash
pm2 logs shopify-importer
# Look for errors, restart:
pm2 restart shopify-importer
```

---

## Zero-Downtime Deployment

For larger deployments, use PM2's graceful reload:

Update `.github/workflows/deploy.yml`:

```bash
pm2 gracefulReload shopify-importer
```

Or manually:

```bash
pm2 gracefulReload shopify-importer
```

This waits for requests to finish before restarting.

---

## Rollback

If something goes wrong, quickly revert:

```bash
cd /var/www/shopify
git log --oneline  # Find the commit to revert to
git reset --hard <commit-hash>
npm install
npm run build
pm2 restart shopify-importer
```

---

## Security Best Practices

✅ **Keep secrets secure:**
- Never commit `.env` to git
- Use GitHub secrets, not environment variables
- Rotate SSH keys periodically

✅ **Limit SSH access:**
- Only allow key-based auth (no passwords)
- Use SSH key with passphrase if possible
- Limit SSH port access via firewall

✅ **Monitor deployments:**
- Review GitHub Actions logs
- Check PM2 logs for errors
- Set up Slack notifications

✅ **Backup before deploy:**
```bash
# VPS: backup current version
cp -r /var/www/shopify /var/www/shopify.backup.$(date +%s)
```

---

## Continuous Improvement

Monitor these metrics after deploying:

- **Build time:** Target <60 seconds for full CI
- **Deploy time:** Target <5 minutes from push to live
- **Uptime:** Should be 99.9%+ with PM2
- **Error rate:** Monitor PM2 logs and Slack notifications

---

## Next Steps

1. ✅ Push your code to GitHub
2. ✅ Add GitHub secrets (VPS_HOST, VPS_USER, VPS_SSH_KEY)
3. ✅ Setup VPS directory and PM2 config
4. ✅ Push to `main` branch to trigger deploy
5. ✅ Monitor GitHub Actions and PM2 logs
6. ✅ Access app at `http://your-vps-ip:3000`

Questions? Check the CI and Deploy workflow files in `.github/workflows/` for exact commands.
