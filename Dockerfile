FROM python:3.13-slim

WORKDIR /app

COPY app.py ./app.py
COPY public ./public
COPY server/tasks.json ./server/tasks.json

EXPOSE 5000

CMD ["python", "app.py"]