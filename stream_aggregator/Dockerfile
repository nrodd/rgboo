FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && useradd --create-home --uid 10001 aggregator \
    && mkdir /data && chown aggregator:aggregator /data
COPY *.py ./stream_aggregator/
USER aggregator
CMD ["python", "-m", "stream_aggregator"]
