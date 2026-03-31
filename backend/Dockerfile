FROM python:3.11

WORKDIR /app

COPY requirements.txt .
RUN pip install --default-timeout=120 --retries 10 -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["python", "main.py"]