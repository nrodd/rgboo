"""Accept a single !color command, never a substring of a chat message."""
import re

import webcolors

COMMAND = re.compile(r"!([a-zA-Z]+|#?(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3}))", re.ASCII)
HEX = re.compile(r"#?(?:[0-9a-f]{6}|[0-9a-f]{3})", re.ASCII)


def parse_color(message: str) -> dict[str, int] | None:
    match = COMMAND.fullmatch(message.strip())
    if not match:
        return None
    value = match[1].lower()
    try:
        # Names take precedence over unprefixed hex (e.g. !red).
        rgb = webcolors.name_to_rgb(value)
    except ValueError:
        if value == "rebeccapurple":
            rgb = (102, 51, 153)
        elif HEX.fullmatch(value):
            rgb = webcolors.hex_to_rgb("#" + value.lstrip("#"))
        else:
            return None
    return dict(zip(("r", "g", "b"), rgb))
