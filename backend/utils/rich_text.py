from html import escape
from html.parser import HTMLParser
import re

import bleach


ALLOWED_TAGS = {"p", "div", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "a", "blockquote", "font"}
ALLOWED_ATTRIBUTES = {"a": ["href", "target", "rel"], "font": ["face", "size", "color"]}


def sanitize_rich_text(value: object) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    if not re.search(r"</?[a-z][^>]*>", text, re.IGNORECASE):
        text = escape(text).replace("\n", "<br>")
    return bleach.clean(text, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRIBUTES, protocols={"https", "mailto"}, strip=True)


def rich_text_to_plain(value: object) -> str:
    parser = _PlainTextParser()
    parser.feed(sanitize_rich_text(value))
    parser.close()
    return parser.text().strip()


class _PlainTextParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs):
        if tag == "br":
            self.parts.append("\n")
        elif tag == "li":
            self.parts.append("- ")

    def handle_endtag(self, tag: str):
        if tag in {"p", "div", "blockquote"}:
            self.parts.append("\n\n")
        elif tag == "li":
            self.parts.append("\n")

    def handle_data(self, data: str):
        self.parts.append(data)

    def text(self) -> str:
        return "".join(self.parts)
