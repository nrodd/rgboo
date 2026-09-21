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


def test_burst_keeps_only_latest_display_behind_slow_post():
    entered = threading.Event()
    release = threading.Event()
    latest_sent = threading.Event()
    calls = []

    def poster(_url, _secret, display):
        calls.append(display['username'])
        if len(calls) == 1:
            entered.set()
            assert release.wait(5)
        else:
            latest_sent.set()

    publisher = ColorPublisher('unused', poster=poster)
    publisher.start()
    try:
        publisher.publish('first', 1, 2, 3)
        assert entered.wait(2)
        for index in range(20000):
            publisher.publish(str(index), 4, 5, 6)
        release.set()
        assert latest_sent.wait(2)
    finally:
        release.set()
        publisher.stop()
    assert calls == ['first', '19999']
    assert not publisher._thread.is_alive()


def test_stop_discards_pending_display_and_rejects_late_updates():
    publisher = ColorPublisher('unused', poster=Mock())
    publisher.publish('pending', 1, 2, 3)
    publisher.stop()
    publisher.publish('late', 1, 2, 3)
    assert publisher._pending is None
