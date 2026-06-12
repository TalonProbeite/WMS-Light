import uvicorn
from app.core.config import settings
from app.core.logger import setup_logging

if __name__ == "__main__":
    uvicorn.run(
        'app.main:app',
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level='info',
        access_log=False
    )