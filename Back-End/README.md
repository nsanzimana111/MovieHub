# MovieHub Backend

This folder contains the Node.js + Express backend for the MovieHub local movie marketplace.

## Quick start

1. Start MySQL in XAMPP.
2. In phpMyAdmin, import `../database/schema.sql` first, then import `../database/seed.sql`. Both scripts use the `moviehub_db` database. Import the schema only for a fresh install: it drops and recreates the MovieHub tables.
3. Ensure `.env` has the same MySQL host, port, user, password, and database (`DB_NAME=moviehub_db`) as the XAMPP server you imported into. The default MySQL port is `3306`.
4. Run `npm install` in this folder.
5. Start the API with `npm run dev`; it listens on port 5000.

If login or registration reports `Table 'moviehub_db.users' doesn't exist`, the schema has not been imported into the database instance configured in `.env`. Import the schema and seed as above, then restart the backend. Do not use `schema.sql` to repair an existing database with data you need, because it drops the existing MovieHub tables.

The demo seed file is for local development only. Never import it into the production database; create the first production account through registration, then grant the admin role using the secure SQL procedure in the root README.

## Main features

- MySQL database integration
- JWT auth and role checks
- Movie CRUD with local file upload validation
- Payment orders and manual approval workflow
- Purchase and download authorization
- Audit logging and secure route patterns

## Payment workflow

Users create a 24-hour RWF order, transfer the displayed amount using the active payment destination, then submit a transaction reference and/or proof notes. The order remains locked while it is pending or awaiting review. Admins must compare the submitted details with official payment account records and explicitly approve or reject the submission; user-entered references and screenshots are not automatically verified. Only an approved submission creates an active purchase and enables the protected download route.

The admin dashboard provides movie upload/edit/archive, payment review, user suspend/reactivate, purchase listing/revocation, and payment destination settings. Movie uploads accept a video file and an optional poster image. Uploaded posters are served publicly; movie files remain behind purchase authorization.

Production deployment instructions and required environment variables are in the root `README.md`.
