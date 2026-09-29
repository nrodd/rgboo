"""Persistent, conservative request limits, reset on YouTube's Pacific day."""
import sqlite3
from datetime import datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

PACIFIC = ZoneInfo("America/Los_Angeles")


class BudgetExhausted(Exception):
    pass


class YouTubeBudget:
    def __init__(self, path, reply_limit=160, read_limit=1000):
        if path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(path)
        self.reply_limit, self.read_limit = reply_limit, read_limit
        self.db.execute("CREATE TABLE IF NOT EXISTS budget (day TEXT PRIMARY KEY, reads INTEGER, replies INTEGER, blocked INTEGER)")
        self.db.commit()

    def now(self):
        return datetime.now(PACIFIC)

    def reserve(self, kind):
        day = self.now().date().isoformat()
        # Reserve before network IO; failures and uncertain deliveries count.
        with self.db:
            self.db.execute("INSERT OR IGNORE INTO budget VALUES (?, 0, 0, 0)", (day,))
            column, limit = ("replies", self.reply_limit) if kind == "reply" else ("reads", self.read_limit)
            changed = self.db.execute(
                f"UPDATE budget SET {column} = {column} + 1 WHERE day = ? AND blocked = 0 AND {column} < ?",
                (day, limit),
            ).rowcount
        if not changed:
            raise BudgetExhausted()

    def block_today(self):
        with self.db:
            self.db.execute("INSERT INTO budget VALUES (?, 0, 0, 1) ON CONFLICT(day) DO UPDATE SET blocked = 1",
                            (self.now().date().isoformat(),))

    def reset_delay(self):
        now = self.now()
        midnight = datetime.combine(now.date() + timedelta(days=1), time(), PACIFIC)
        return max(1, midnight.timestamp() - now.timestamp() + 60)
