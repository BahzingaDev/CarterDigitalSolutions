# Deployment

This app is prepared for a single same-origin deployment: Flask serves the built Vite frontend and the `/api` routes from one web service.

## Required Environment Variables

- `FLASK_ENV=production`
- `PYTHON_VERSION=3.12.11`
- `FORCE_HTTPS=1`
- `SECRET_KEY`: long random value used by Flask.
- `MONGODB_URI`: MongoDB connection string, for example from MongoDB Atlas. `MONGO_URI` is also supported.
- `MONGODB_DATABASE=carter_digital_solutions`. `MONGO_DATABASE` is also supported.
- `MONGODB_ENQUIRY_COLLECTION=enquiries`. `MONGO_ENQUIRY_COLLECTION` is also supported.
- `MONGODB_ADMIN_COLLECTION=admin_users`: collection used for administrator accounts.
- `MONGODB_TEMPLATE_COLLECTION=admin_templates`: reusable email templates.
- `MONGODB_RECORD_COLLECTION=admin_records`: flexible custom business records.
- `MONGODB_PROJECT_COLLECTION=projects`: project pipeline records.
- `MONGODB_SERVICE_COLLECTION=service_catalogue`: public service catalogue overrides.
- `MONGODB_CUSTOMER_COLLECTION=customers`: editable CRM customer metadata.
- `MONGODB_SETTINGS_COLLECTION=admin_settings`: communication signatures and admin preferences.
- `MONGODB_SERVICE_CATEGORY_COLLECTION=service_categories`: service category structure and display order.
- `ALLOWED_ORIGINS`: deployed site origin, for example `https://www.carterdigitalsolutions.co.uk`.

## Optional Email Notifications

Set these environment variables to forward each saved enquiry to email. HTTPS providers are recommended on Render because direct SMTP can be blocked or time out.

- `EMAIL_NOTIFICATIONS_ENABLED=1`

### Resend

- `EMAIL_PROVIDER=resend`
- `RESEND_API_KEY`: Resend API key.
- `RESEND_WEBHOOK_SECRET`: signing secret for the Resend webhook endpoint.
- `ENQUIRY_EMAIL_TO`: destination inbox for enquiries.
- `ENQUIRY_EMAIL_FROM`: verified sender address, for example `Carter Digital Solutions <hello@yourdomain.com>`.
- `ENQUIRY_TIMEZONE=Europe/London`: timezone used when formatting enquiry timestamps.
- `CUSTOMER_AUTO_REPLY_ENABLED=1`: sends a confirmation email to the person submitting the form.
- `CUSTOMER_EMAIL_FROM`: verified sender used for the customer confirmation email.

Resend tags are included for `email_type`, `enquiry_type`, `project_type`, and `priority`.

Register `https://your-domain.example/api/webhooks/resend` in Resend and select the email delivery events you want to track. The endpoint verifies `svix-id`, `svix-timestamp`, and `svix-signature` against `RESEND_WEBHOOK_SECRET`; unsigned requests are rejected. Enable at least sent, delivered, delayed, bounced, complained, failed, opened, clicked, and suppressed events.

To show customer replies in communication history, also enable `email.received` and configure a Resend receiving address or custom-domain MX records. The webhook retrieves the full plain-text body from Resend's Receiving API before matching the sender to their latest enquiry.

Resend sends through `https://api.resend.com/emails` using the `from`, `to`, `subject`, and `text` fields required by their send email API.

### SMTP

- `SMTP_HOST`: SMTP server hostname.
- `SMTP_PORT=587`
- `SMTP_USERNAME`: SMTP account username.
- `SMTP_PASSWORD`: SMTP account password or app password.
- `SMTP_USE_TLS=1`
- `SMTP_USE_SSL=0`
- `SMTP_FORCE_IPV4=1`
- `SMTP_TIMEOUT=10`
- `ENQUIRY_EMAIL_TO`: destination inbox for enquiries.
- `ENQUIRY_EMAIL_FROM`: verified sender address. Defaults to `SMTP_USERNAME` if omitted.

Email delivery is non-blocking for users: if MongoDB saves the enquiry but SMTP fails, the API still returns success and the SMTP error is logged.

## Admin Authentication

The admin area at `/admin` uses an HTTP-only, secure Flask session. Administrator credentials are stored in MongoDB with scrypt password hashing. Configure these Render environment variables:

- `ADMIN_EMAIL`: the only email address authorised to create and use the owner account.
- `MONGODB_ADMIN_COLLECTION=admin_users`: MongoDB collection used for the account.
- `ADMIN_SESSION_MINUTES=60`: rolling session lifetime.
- `ADMIN_LOGIN_RATE_LIMIT_MAX=5`: failed attempts permitted in the window.
- `ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS=900`: login throttling window.
- `ADMIN_EXPORT_LIMIT=100`: maximum enquiries loaded by the dashboard, capped internally at 500.

After deployment, visit `/admin`. If no account exists for `ADMIN_EMAIL`, the guarded first-run screen lets you choose your name and password. The submitted email must exactly match `ADMIN_EMAIL`; the server hashes the password before inserting the account into MongoDB. MongoDB creates `admin_users` on that first insert, so the collection may not be visible before setup is submitted. Once created, public account registration closes automatically.

Remove the obsolete `ADMIN_PASSWORD_HASH` and `ADMIN_EXPORT_TOKEN` environment variables after the new login has been verified.

Admin write requests use a per-session CSRF token and same-origin validation. Login attempts are rate limited by IP address.

## Enquiry Rate Limiting

The enquiry endpoint applies an in-memory rate limit before database writes:

- `ENQUIRY_RATE_LIMIT_MAX=5`
- `ENQUIRY_RATE_LIMIT_WINDOW_SECONDS=900`

This limits repeated submissions by IP address and email address. For heavier traffic or multiple app instances, replace this with a shared store such as Redis.

## Render Build

Use the included `render.yaml`, or configure a web service manually:

- Build command: `cd frontend && npm ci && npm run build && cd .. && pip install -r backend/requirements.txt`
- Start command: `gunicorn backend.wsgi:app`
- Health check path: `/api/ready`

## MongoDB

Create a MongoDB Atlas cluster or managed MongoDB instance, then set `MONGODB_URI` in the host's environment variables. The app creates indexes for enquiry `created_at`, `email`, and `type` fields on first write.

## Local Checks

- Frontend: `cd frontend && npm run build`
- Backend compile: `python -m py_compile backend\app.py backend\config.py backend\routes\*.py backend\schemas\*.py backend\services\*.py backend\utils\*.py`
- API health: `/api/health`
- Database readiness: `/api/ready`
