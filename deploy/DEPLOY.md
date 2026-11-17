# Deploying VoyagerOTA

One droplet runs everything:

| Address | What |
|---|---|
| `voyagerota.com` (`www` redirects here) | landing page |
| `docs.voyagerota.com` | documentation |
| `app.voyagerota.com` | dashboard |
| `api.voyagerota.com` | core API for the dashboard and the ESP32 boards |

```
nginx ─┬─ voyagerota.com, docs., app.  →  /var/www/voyagerota/current/{landing,docs,app}
       └─ api.                          →  voyager-api (127.0.0.1:8080)
voyager-api, voyager-workers, voyager-crons  (systemd, user voyager)
MariaDB + Redis on the droplet, firmware and backups in Cloudflare R2
```

Boards use `ota.setBaseURL("https://api.voyagerota.com")`.

## Before you start

- [ ] Ubuntu 22.04 or 24.04 droplet, at least 1 GB RAM
- [ ] DNS in DigitalOcean (Networking, Domains, voyagerota.com), five **A** records to the droplet IP:
  `@`, `www`, `docs`, `app`, `api`
- [ ] Clerk **production** instance for `voyagerota.com`, with the DNS records Clerk lists added in DigitalOcean
- [ ] Brevo sender domain verified (SPF, DKIM, DMARC records from Brevo added in DigitalOcean)
- [ ] R2 buckets `voyager-firmware` and `voyager-backups`, one API token each (Object Read & Write, that bucket only)
- [ ] The secrets in your password manager, never in chat or git

## 1. Copy the setup script to the droplet

The repos are private, so copy the one file from your computer:

```bash
scp deploy/setup.sh root@YOUR_DROPLET_IP:/root/setup.sh
```

## 2. Run the setup (once)

```bash
ssh root@YOUR_DROPLET_IP
```

```bash
sudo bash /root/setup.sh voyagerota.com
```

It installs Node, MariaDB, Redis, nginx and certbot, adds 2 GB swap, turns on the firewall,
creates the `voyager` user and the database, and installs the services.

Halfway it prints **two deploy keys**. Add each one on GitHub as a **read-only deploy key**
(repo, Settings, Deploy keys, Add deploy key): the first on `voyagerota-core`, the second on
`voyagerota-web`. Then press Enter and it clones both repos.

Running it again is safe, every step skips what is already done.

## 3. Fill in the settings

```bash
sudo -u voyager nano /opt/voyagerota/core/.env
```

Fill the empty values: Clerk live keys, Brevo key and alert email, R2 account id and keys,
backup keys. The database password and keep link secret are already generated.

```bash
sudo -u voyager nano /opt/voyagerota/web/.env.app.local
```

Put the Clerk `pk_live_...` key after `VITE_CLERK_PUBLISHABLE_KEY=`.

## 4. HTTPS

Once DNS points at the droplet:

```bash
sudo certbot --nginx -d voyagerota.com -d www.voyagerota.com -d docs.voyagerota.com -d app.voyagerota.com -d api.voyagerota.com
```

Certificates renew by themselves.

## 5. First deploy

```bash
sudo bash /opt/voyagerota/core/deploy/deploy.sh
```

If you already have firmware files from before, copy them into R2 once:

```bash
cd /opt/voyagerota/core && sudo -u voyager npm run storage:migrate
```

## 6. Check it

- `https://voyagerota.com`, `https://docs.voyagerota.com`, `https://app.voyagerota.com` open
- `https://api.voyagerota.com/health` answers `{"status":"ok"}`
- Sign up, create a project, flash a board with the starter sketch, approve it,
  upload a release, test it on staging, promote it, revoke it
- Reboot the droplet, everything comes back by itself

## Everyday

| Task | Command |
|---|---|
| Deploy the latest `unstable` | `sudo bash /opt/voyagerota/core/deploy/deploy.sh` |
| Deploy a tag or commit | `sudo bash /opt/voyagerota/core/deploy/deploy.sh v1.0.0` |
| Different refs for core and web | `sudo bash /opt/voyagerota/core/deploy/deploy.sh <core>:<web>` |
| Go back to the previous deploy | `sudo bash /opt/voyagerota/core/deploy/deploy.sh --rollback` |
| Service status | `systemctl status voyager-api voyager-workers voyager-crons` |
| Live logs | `journalctl -u voyager-api -f` |
| Deploy history | `cat /opt/voyagerota/deploys.log` |
| Back up now | `sudo -u voyager bash /opt/voyagerota/core/deploy/backup.sh` |
| List backups | `sudo bash /opt/voyagerota/core/deploy/restore.sh` |
| Restore the newest backup | `sudo bash /opt/voyagerota/core/deploy/restore.sh latest` |

A deploy checks `/health` before switching the sites over. If the API doesn't come up it goes
back to the previous deploy by itself. If a step fails before that, the code is put back and
the running services are never touched.

The database is backed up to `voyager-backups` every night at 03:15, the last 14 days are kept.
Restore one on a spare machine now and then, a backup nobody has restored is only a hope.

## Moving to another server

1. Run the setup on the new server, fill in the same settings
2. Restore the newest backup: `sudo bash /opt/voyagerota/core/deploy/restore.sh latest`
3. Deploy, then point the five DNS records at the new IP

Firmware lives in R2, so nothing else needs copying.
