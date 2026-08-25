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

# --factory defers building the Flask app (and its Firestore client)
# until each gunicorn worker boots, instead of at module import time.
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--factory", "cloud_api.app:create_app"]
