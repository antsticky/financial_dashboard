from typing import Callable

from src.shared.logger import get_logger

logger = get_logger(__name__)

class Calculator:
    operations: dict[str, Callable] = {}

    @classmethod
    def register(cls, func):
        cls.operations[func.__name__] = func
        return func

    def execute(self, name, *args):
        return self.operations[name](*args)
    
    def __getitem__(self, name):
        try:
            return self.operations[name]
        except KeyError as e:
            logger.error(f"Calculator was called with unknown operation {name} use on of the {list(self.operations.keys())}")
            raise ValueError(f"Unknown operation '{name}'") from e
