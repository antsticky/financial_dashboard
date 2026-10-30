import logging 
from .formatter import ColorFormatter

def get_logger(name: str):
    handler = logging.StreamHandler()
    handler.setFormatter(ColorFormatter("%(asctime)s | %(levelname)s | %(name)s | %(message)s"))

    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    logger.addHandler(handler)

    return logger