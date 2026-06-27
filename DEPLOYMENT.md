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
- `ALLOWED_ORIGINS`: deployed site origin, for example `https://www.carterdigitalsolutions.co.uk`.

## Optional Email Notifications

Set these environment variables to forward each saved enquiry to email. HTTPS providers are recommended on Render because direct SMTP can be blocked or time out.

- `EMAIL_NOTIFICATIONS_ENABLED=1`

### Resend

- `EMAIL_PROVIDER=resend`
- `RESEND_API_KEY`: Resend API key.
- `ENQUIRY_EMAIL_TO`: destination inbox for enquiries.
- `ENQUIRY_EMAIL_FROM`: verified sender address, for example `Carter Digital Solutions <hello@yourdomain.com>`.
- `ENQUIRY_TIMEZONE=Europe/London`: timezone used when formatting enquiry timestamps.
- `CUSTOMER_AUTO_REPLY_ENABLED=1`: sends a confirmation email to the person submitting the form.
- `CUSTOMER_EMAIL_FROM`: verified sender used for the customer confirmation email.

Resend tags are included for `email_type`, `enquiry_type`, `project_type`, and `priority`.

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

The admin area at `/admin` uses an HTTP-only, secure Flask session. Configure these Render environment variables:

- `ADMIN_EMAIL`: the email address used to sign in.
- `ADMIN_PASSWORD_HASH`: a Werkzeug password hash, never the plain-text password.
- `ADMIN_SESSION_MINUTES=60`: rolling session lifetime.
- `ADMIN_LOGIN_RATE_LIMIT_MAX=5`: failed attempts permitted in the window.
- `ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS=900`: login throttling window.
- `ADMIN_EXPORT_LIMIT=100`: maximum enquiries loaded by the dashboard, capped internally at 500.

Generate the password hash locally. The prompt hides the password so it is not written to shell history:

`python backend/scripts/generate_admin_password.py`

Paste the complete value into `ADMIN_PASSWORD_HASH` in Render. It must begin with `scrypt:32768:8:1$`; include the `scrypt:` prefix and every `$`-separated section, without quotes or the `Value:` label. Save the environment changes and allow Render to redeploy before testing. Remove the legacy `ADMIN_EXPORT_TOKEN` variable after the new login has been verified.

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
