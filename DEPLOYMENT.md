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

Set these environment variables to forward each saved enquiry to email:

- `EMAIL_NOTIFICATIONS_ENABLED=1`
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
