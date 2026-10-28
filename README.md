<p align="center">
  <img src="https://content.umami.is/website/images/umami-logo.png" alt="Umami Logo" width="100">
</p>

<h1 align="center">Umami</h1>

<p align="center">
  <i>Umami is a privacy-first analytics platform. Traffic, campaigns, behavior, conversions, and revenue in one place — no cookies, no surveillance, self-hosted or in the cloud.</i>
</p>

<p align="center">
  <a href="https://github.com/umami-software/umami/releases"><img src="https://img.shields.io/github/release/umami-software/umami.svg" alt="GitHub Release" /></a>
  <a href="https://github.com/umami-software/umami/blob/master/LICENSE"><img src="https://img.shields.io/github/license/umami-software/umami.svg" alt="MIT License" /></a>
  <a href="https://github.com/umami-software/umami/actions"><img src="https://img.shields.io/github/actions/workflow/status/umami-software/umami/ci.yml" alt="Build Status" /></a>
  <a href="https://cloud.umami.is/share/LGazGOecbDtaIwDr/umami.is" style="text-decoration: none;"><img src="https://img.shields.io/badge/Try%20Demo%20Now-Click%20Here-brightgreen" alt="Umami Demo" /></a>
</p>

---

## 🚀 Getting Started

A detailed getting started guide can be found at [umami.is/docs](https://umami.is/docs/).

---

## 🛠 Installing from Source

### Requirements

- A server with Node.js version 18.18+.
- A PostgreSQL database version v12.14+.

### Get the source code and install packages

```bash
git clone https://github.com/umami-software/umami.git
cd umami
pnpm install
```

### Configure Umami

Create an `.env` file with the following:

```bash
DATABASE_URL=connection-url
```

Optional: set `API_URL` to change the base URL used by internal UI API calls.
Relative paths are served under `BASE_PATH`; absolute URLs are proxied through the local `/api` route.
For example, `API_URL=/internal-api` or `API_URL=https://api.example.com/api`.

Optional: set `TWO_FACTOR_ENCRYPTION_KEY` to a 64-character hex string to enable two-factor
authentication. Generate one with `openssl rand -hex 32`. Two-factor authentication is unavailable
and cannot be required until this key is set.

The connection URL format:

```bash
postgresql://username:mypassword@localhost:5432/mydb
```

### Build the Application

```bash
pnpm run build
```

The build step will create tables in your database if you are installing for the first time. It will also create a login user with username **admin** and password **umami**.

### Start the Application

```bash
pnpm run start
```

By default, this will launch the application on `http://localhost:3000`. You will need to either [proxy](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/) requests from your web server or change the [port](https://nextjs.org/docs/api-reference/cli#production) to serve the application directly.

---

## 🐳 Installing with Docker

Umami provides Docker images as well as a Docker compose file for easy deployment.

Docker image:

```bash
docker pull docker.umami.is/umami-software/umami:latest
```

Docker compose (Runs Umami with a PostgreSQL database):

```bash
docker compose up -d
```

---

## 🔄 Getting Updates

To get the latest features, simply do a pull, install any new dependencies, and rebuild:

```bash
git pull
pnpm install
pnpm build
```

To update the Docker image, simply pull the new images and rebuild:

```bash
docker compose pull
docker compose up --force-recreate -d
```

---

## 🛟 Support

<p align="center">
  <a href="https://github.com/umami-software/umami"><img src="https://img.shields.io/badge/GitHub--blue?style=social&logo=github" alt="GitHub" /></a>
  <a href="https://twitter.com/umami_software"><img src="https://img.shields.io/badge/Twitter--blue?style=social&logo=twitter" alt="Twitter" /></a>
  <a href="https://linkedin.com/company/umami-software"><img src="https://img.shields.io/badge/LinkedIn--blue?style=social&logo=linkedin" alt="LinkedIn" /></a>
  <a href="https://umami.is/discord"><img src="https://img.shields.io/badge/Discord--blue?style=social&logo=discord" alt="Discord" /></a>
</p>

[release-shield]: https://img.shields.io/github/release/umami-software/umami.svg
[releases-url]: https://github.com/umami-software/umami/releases
[license-shield]: https://img.shields.io/github/license/umami-software/umami.svg
[license-url]: https://github.com/umami-software/umami/blob/master/LICENSE
[build-shield]: https://img.shields.io/github/actions/workflow/status/umami-software/umami/ci.yml
[build-url]: https://github.com/umami-software/umami/actions
[github-shield]: https://img.shields.io/badge/GitHub--blue?style=social&logo=github
[github-url]: https://github.com/umami-software/umami
[twitter-shield]: https://img.shields.io/badge/Twitter--blue?style=social&logo=twitter
[twitter-url]: https://twitter.com/umami_software
[linkedin-shield]: https://img.shields.io/badge/LinkedIn--blue?style=social&logo=linkedin
[linkedin-url]: https://linkedin.com/company/umami-software
[discord-shield]: https://img.shields.io/badge/Discord--blue?style=social&logo=discord
[discord-url]: https://discord.com/invite/4dz4zcXYrQ

---

## Rétention des données : site Régitex (25 mois)

La politique de confidentialité de regitex.com annonce que les données d'audience « sont conservées 25 mois, puis supprimées ». Umami 3.3.1 n'a aucune rétention native : cette instance ajoute donc une purge, limitée au site Régitex (`352a3bc1-e204-45e8-b23e-ec2bc50a2b3d`, fixé dans le code). Aucun autre site de l'instance n'est touché.

- **Route** : `GET` ou `POST /api/cron/retention`, protégée par la variable d'environnement `RETENTION_SECRET` (32 caractères minimum; sans elle, la route répond 503). Secret de préférence en `Authorization: Bearer …` (un `?secret=…` dans l'URL finit dans les journaux d'accès), sinon en `?secret=…`.
- **Essai à blanc (par défaut)** : compte, table par table, les lignes antérieures à `now() - 25 mois`, sans rien supprimer.
- **Écriture** : ajouter `&mode=write`. Tout se fait dans une seule transaction (tout ou rien) et la réponse donne le nombre de lignes supprimées par table.
- **Tables couvertes** (un test échoue si une montée de version d'Umami ajoute une table liée à un site sans la classer) : `session_replay_saved`, `session_replay`, `heatmap_event`, `revenue`, `event_data` (y compris les lignes rattachées à un événement purgé), `session_data`, `session_link`, `website_event`, puis `session` (une session encore liée à des données récentes est gardée).
- **Tâche cron canner** (Calcul → Tâches cron) : `https://<domaine Stats GB>/api/cron/retention?mode=write` avec l'en-tête `Authorization`, ou avec `&secret=…` si la tâche n'accepte pas d'en-tête, tous les jours à 4 h (`0 4 * * *`). Une exécution quotidienne garde au plus 25 mois et un jour. Une exécution mensuelle (`0 4 1 * *`) laisserait vivre une ligne jusqu'à 26 mois, et la première vraie purge tomberait le 1er décembre 2028, après l'échéance du 27 novembre 2028.
- **Échéancier** : les données commencent le 27 octobre 2026. Jusqu'au 27 novembre 2028, chaque exécution doit afficher 0 partout, sauf lignes d'essai antérieures au 27 octobre 2026. Une réponse autre que 200 (503 : secret absent; 500 : erreur) veut dire que rien n'est purgé : la surveiller.
- **Test** : `scripts/test-retention.sh` (Postgres local) applique les migrations, sème deux sites et vérifie que l'essai à blanc et l'écriture concordent et que l'autre site reste intact. Tests unitaires : `npx vitest run src/lib/retention.test.ts src/app/api/cron/retention`.
- **Repli sans route** : dans l'Atelier de données canner, exécuter les requêtes de `src/lib/retention.ts` en remplaçant `$1` par l'identifiant du site et `$2` par `now() - interval '25 months'`.
