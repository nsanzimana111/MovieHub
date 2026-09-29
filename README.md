# MovieHub

MovieHub is a React/Vite frontend with a Node.js/Express API and MySQL database. The API and web app deploy separately: the API is prepared for Render, and the frontend is prepared for Vercel.

## Project map

- Frontend entry: `Front-End/index.html` -> `Front-End/src/main.jsx` -> `Front-End/src/App.jsx`
- Frontend dependencies/build: `Front-End/package.json`; production output is `Front-End/dist`
- API entry: `Back-End/src/server.js` -> `Back-End/src/app.js`
- API dependencies/start: `Back-End/package.json`; `npm start` runs the server
- API routes: `/api/auth`, `/api/movies`, `/api/payments`, `/api/admin`; health endpoint: `/api/health`
- Database schema: `database/schema.sql`; demo-only data: `database/seed.sql`
- Uploaded file storage: `UPLOAD_DIR/movies` (private downloads) and `UPLOAD_DIR/posters` (public images)

## Before production

1. Create an empty MySQL database with a managed MySQL provider that supports external TLS connections. Do not use XAMPP or `localhost` for production.
2. Import `database/schema.sql` once into that empty database. This script drops/recreates MovieHub tables, so never run it against data you need to keep.
3. Do not import `database/seed.sql` in production. It contains demo accounts and sample records.
4. Deploy the API service on Render from this repository using `render.yaml`. The blueprint uses a paid single-instance service with a persistent disk mounted at `/var/data/uploads`; do not scale it to multiple instances while using local disk uploads.
5. Set the Render API environment variables listed below. Render generates `PORT`; the server uses it automatically.
6. Deploy `Front-End` as the Vercel project root. Set `VITE_API_URL` to the full Render API URL ending in `/api`, and set `VITE_ASSET_URL` to the API origin (no `/api`). Vite variables are public build-time values; never put credentials in them.
7. Once Vercel gives you the production site domain, add that exact origin to Render's `FRONTEND_URL` and redeploy the API. Include the scheme, e.g. `https://moviehub.example`; comma-separate additional exact origins if needed.
8. Register your own account on the deployed app. Promote it to admin in the production database using the SQL below, substituting your account email. Do not share that email/password here or commit it to the repository.
9. Sign in through `/admin/login`, set the official payment destination, then upload a small test movie and poster. Use licensed test content only.

### Render environment variables

Create these under the Render API service's **Environment** settings. Do not commit the values.

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DB_HOST` | Hostname from your managed MySQL provider |
| `DB_PORT` | Provider's TLS MySQL port, commonly `3306` |
| `DB_USER` | Database user created for MovieHub |
| `DB_PASSWORD` | Set directly in Render's secret environment field |
| `DB_NAME` | Production database/schema name |
| `DB_SSL` | `true` |
| `DB_SSL_REJECT_UNAUTHORIZED` | `true`; use the provider's CA configuration if required, not a permanent verification bypass |
| `DB_SSL_CA` | Optional provider CA certificate text, only when required by your database provider |
| `JWT_SECRET` | Generate a unique random value of at least 32 characters and set only in Render |
| `FRONTEND_URL` | Exact Vercel origin, such as `https://moviehub.example` |
| `UPLOAD_DIR` | `/var/data/uploads` (already declared by `render.yaml`) |
| `JWT_EXPIRES_IN` | `7d` (already declared by `render.yaml`) |
| `MAX_MOVIE_FILE_SIZE_MB` | `2048` by default; lower it to fit your plan and storage budget |
| `MAX_POSTER_FILE_SIZE_MB` | `5` |
| `PAYMENT_CURRENCY` | `RWF` |

Render's persistent disk is required because the database stores upload file paths. The disk is durable across service restarts but belongs to that one service instance; it is not shared storage for horizontal scaling. For multiple instances, move movies and posters to private/public object storage (for example S3-compatible storage) and store object keys instead of local paths. Large uploads and downloads consume disk, bandwidth, and request time; validate the host's upload/request limits before accepting production-sized films.

### Vercel environment variables

Set both for **Production** and, as appropriate, Preview deployments, then redeploy after changing them.

| Variable | Example |
| --- | --- |
| `VITE_API_URL` | `https://moviehub-api.onrender.com/api` |
| `VITE_ASSET_URL` | `https://moviehub-api.onrender.com` |

The `.env.example` files contain local-development examples only. Vite embeds `VITE_*` values in the public JavaScript bundle. Keep database credentials, JWT secrets, and provider secrets exclusively on the API host.

### API route map

| Area | Routes |
| --- | --- |
| Authentication | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/change-password` |
| Movie catalog | `GET /api/movies`, `GET /api/movies/categories`, `GET /api/movies/:id` |
| Movie administration | `GET /api/movies/admin/all`, `POST /api/movies`, `PUT /api/movies/:id`, `DELETE /api/movies/:id`; category create/update/delete under `/api/movies/categories` |
| Orders and library | `GET /api/payments/settings`, `POST /api/payments/orders`, `GET /api/payments/orders/my`, `POST /api/payments/orders/:id/submit`, `GET /api/payments/purchases/my`, `GET /api/movies/:id/download` |
| Admin payment/purchase | `/api/payments/admin/orders`, `/api/payments/admin/submissions/:id`, approve/reject actions below submissions, `/api/payments/admin/settings`, `/api/payments/admin/purchases` and `/api/payments/admin/purchases/:id/revoke` |
| Admin operations | `GET /api/admin/dashboard`, `GET /api/admin/users`, `PATCH /api/admin/users/:id/status`, `GET /api/admin/audit-logs` |

### Generate a JWT secret without sharing it

In a local terminal, generate a value and paste it directly into Render's secret field. Do not paste it into chat, source code, or a committed file.

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

### Promote your first account to admin

After registering your own account, run this SQL in the production database console, replacing the email with your account email:

```sql
UPDATE users
SET role_id = (SELECT id FROM roles WHERE name = 'admin')
WHERE email = 'YOUR_REGISTERED_EMAIL';
```

Confirm exactly one row was changed, then sign out and back in to receive an admin token. Do not reuse the demo account in production.

## Local development

1. Start MySQL and import `database/schema.sql`, then optionally `database/seed.sql` into a fresh local database.
2. Copy `Back-End/.env.example` to `Back-End/.env` and set local MySQL values. Copy `Front-End/.env.example` to `Front-End/.env.local` if you want to override the Vite proxy.
3. Install and run each app in its own terminal:

```powershell
cd Back-End
npm ci
npm run dev
```

```powershell
cd Front-End
npm ci
npm run dev
```

Without `Front-End/.env.local`, Vite proxies `/api` and `/uploads` to `http://localhost:5000`.

## Deployment smoke tests

Set `$api` to your deployed API base URL ending in `/api`. These checks use no secret and do not print credentials:

```powershell
$api = 'https://moviehub-api.onrender.com/api'
Invoke-RestMethod "$api/health"
Invoke-RestMethod "$api/movies?search=patrol"
Invoke-RestMethod "$api/movies/1"
```

Then test registration/login through the site, authenticated movie upload using a small licensed MP4 and image, payment order creation, manual admin review, and approved download. Verify the uploaded poster URL loads from the API origin. Verify a movie download returns `401` when unauthenticated and `403` for an authenticated user without an approved purchase; do not approve a real transfer unless you personally checked the official payment records.

For database verification, use the Render service logs for the successful MySQL connection and test authenticated registration/listing. Never publish database URLs, connection strings, or screenshots containing secrets.

## Deployment files

- `render.yaml`: Render API, persistent disk, health check, and secret-variable prompts
- `Front-End/vercel.json`: client-side route fallback for React Router
- `.gitignore`: environment files, build output, dependencies, uploads, and local database dumps
- `Back-End/.env.example`, `Front-End/.env.example`: non-secret local configuration examples