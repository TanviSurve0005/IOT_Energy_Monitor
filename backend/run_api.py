import uvicorn
from src.api.main import app
from src.utils.config import config


if __name__ == "__main__":
    uvicorn.run(app, host=config.API_HOST, port=config.API_PORT, log_level="info")
