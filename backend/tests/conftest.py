import pytest


# Configure pytest-asyncio to treat all async tests as asyncio by default
def pytest_configure(config):
    config.addinivalue_line(
        "markers", "asyncio: mark test as async"
    )
