from src.tools.calculator.registry import Calculator

@Calculator.register
def mul(a, b):
    return a * b