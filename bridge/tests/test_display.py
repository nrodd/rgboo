import threading
from unittest.mock import Mock

from ..display import ColorPublisher

"""
Unit tests for the color/username SSE publisher (bridge/display.py). The POST
runs on a worker thread, so tests hand off a payload and wait on an Event
rather than sleeping.
"""


def test_publish_posts_username_and_color():
    done = threading.Event()
    calls = []

    def poster(url, secret, display):
        calls.append((url, secret, display))
        done.set()

    publisher = ColorPublisher('https://example.com/api/update-color', 'secret', poster)
    publisher.start()
    try:
        publisher.publish('tester', 10, 20, 30)
        assert done.wait(timeout=2)
    finally:
        publisher.stop()

    assert calls == [(
        'https://example.com/api/update-color',
        'secret',
        {'username': 'tester', 'r': 10, 'g': 20, 'b': 30},
    )]


def test_publish_failure_does_not_kill_the_worker():
    calls = []
    first = threading.Event()
    second = threading.Event()

    def poster(_url, _secret, display):
        calls.append(display)
        if len(calls) == 1:
            first.set()
            raise RuntimeError('boom')
        second.set()

    publisher = ColorPublisher('https://example.com', None, poster)
    publisher.start()
    try:
        publisher.publish('a', 1, 2, 3)
        assert first.wait(timeout=2)
        # The worker must survive the exception and keep draining the queue.
        publisher.publish('b', 4, 5, 6)
        assert second.wait(timeout=2)
    finally:
        publisher.stop()

    assert len(calls) == 2
