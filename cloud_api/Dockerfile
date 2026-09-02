# Build context must be the repo root (not cloud_api/), since the image
# also needs the shared/ package:
#   docker build -f cloud_api/Dockerfile -t rgboo-api .

FROM python:3.12-slim

WORKDIR /app

COPY cloud_api/requirements.txt ./cloud_api/requirements.txt
RUN pip install --no-cache-dir -r cloud_api/requirements.txt

COPY shared ./shared
COPY cloud_api ./cloud_api

ENV PORT=8080
EXPOSE 8080

# The trailing () calls the factory at worker boot, so the Flask app (and
# its Firestore client) is built per worker rather than at module import
# time. Written as a call rather than with --factory, which needs
# gunicorn >= 22; this pin is 21.2.0.
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "cloud_api.app:create_app()"]
