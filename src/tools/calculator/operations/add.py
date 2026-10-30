from src.tools.calculator.registry import Calculator

@Calculator.register
def add(a, b):
    return a + b
