"""Tiny in-process pub/sub for Server-Sent Events.

Any handler that mutates dataset / settings / pages emits an event; clients
subscribed to /api/events receive it and can refresh their UI in real time.
"""
from __future__ import annotations
import asyncio
import json
import time
from typing import AsyncIterator


_subscribers: list[asyncio.Queue] = []


def publish(kind: str, data: dict | None = None) -> None:
    """Broadcast an event. Safe to call from a sync request handler."""
    payload = {"kind": kind, "at": time.time(), "data": data or {}}
    for q in list(_subscribers):
        try:
            q.put_nowait(payload)
        except asyncio.QueueFull:
            pass


async def subscribe() -> AsyncIterator[str]:
    """Async generator that yields SSE-formatted strings."""
    q: asyncio.Queue = asyncio.Queue(maxsize=128)
    _subscribers.append(q)
    try:
        # Immediate hello so clients know they're connected.
        yield _sse({"kind": "hello", "at": time.time()})
        # Heartbeat every 25s keeps proxies happy.
        while True:
            try:
                evt = await asyncio.wait_for(q.get(), timeout=25.0)
                yield _sse(evt)
            except asyncio.TimeoutError:
                yield ": ping\n\n"
    finally:
        if q in _subscribers:
            _subscribers.remove(q)


def _sse(evt: dict) -> str:
    return f"event: {evt.get('kind', 'message')}\ndata: {json.dumps(evt, ensure_ascii=False)}\n\n"
