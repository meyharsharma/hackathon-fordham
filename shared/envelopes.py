"""NLIP envelope helpers + thin httpx client (nlip-client not on PyPI)."""
from __future__ import annotations
import json
import httpx
from nlip_sdk.nlip import NLIP_Message, NLIP_Factory, AllowedFormats


def make_request(payload: dict) -> NLIP_Message:
    """Build an NLIP request envelope carrying a JSON task spec."""
    return NLIP_Factory.create_text(
        json.dumps(payload), language="json"
    )


def parse_response(msg: NLIP_Message) -> dict | str:
    """Pull the text content out of an NLIP response. Try JSON first."""
    content = msg.content
    if isinstance(content, dict):
        return content
    try:
        return json.loads(content)
    except (json.JSONDecodeError, TypeError):
        return content


async def send(url: str, payload: dict, timeout: float = 300.0) -> dict | str:
    """POST an NLIP message to a server, return parsed response content."""
    req = make_request(payload)
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post(url, json=req.model_dump())
        r.raise_for_status()
        msg = NLIP_Message.model_validate(r.json())
        return parse_response(msg)


def reply_text(text: str) -> NLIP_Message:
    return NLIP_Factory.create_text(text)


def reply_json(data: dict | list) -> NLIP_Message:
    return NLIP_Factory.create_text(json.dumps(data), language="json")
