# Deployment

This app is prepared for a single same-origin deployment: Flask serves the built Vite frontend and the `/api` routes from one web service.

## Required Environment Variables

- `FLASK_ENV=production`
- `FORCE_HTTPS=1`
- `SECRET_KEY`: long random value used by Flask.
- `MONGODB_URI`: MongoDB connection string, for example from MongoDB Atlas.
- `MONGODB_DATABASE=carter_digital_solutions`
- `MONGODB_ENQUIRY_COLLECTION=enquiries`
- `ALLOWED_ORIGINS`: deployed site origin, for example `https://www.carterdigitalsolutions.co.uk`.

## Render Build

Use the included `render.yaml`, or configure a web service manually:

- Build command: `cd frontend && npm ci && npm run build && cd ../backend && pip install -r requirements.txt`
- Start command: `cd backend && gunicorn wsgi:app`
- Health check path: `/api/ready`

## MongoDB

Create a MongoDB Atlas cluster or managed MongoDB instance, then set `MONGODB_URI` in the host's environment variables. The app creates indexes for enquiry `created_at`, `email`, and `type` fields on first write.

## Local Checks

- Frontend: `cd frontend && npm run build`
- Backend compile: `python -m py_compile backend\app.py backend\config.py backend\routes\*.py backend\schemas\*.py backend\services\*.py backend\utils\*.py`
- API health: `/api/health`
- Database readiness: `/api/ready`
