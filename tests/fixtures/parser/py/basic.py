# fixture: Python 函数与类定义
import os
import sys
from pathlib import Path
from typing import Optional

def format_date(date):
    """格式化日期"""
    return date.isoformat()


def add(a: int, b: int) -> int:
    return a + b


class Animal:
    def __init__(self, name: str):
        self.name = name

    def speak(self) -> str:
        return f"{self.name} makes a sound."


class Dog(Animal):
    def speak(self) -> str:
        return f"{self.name} barks."
