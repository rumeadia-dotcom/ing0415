#!/usr/bin/env python3
"""Zendesk Help Center article JSON → 마크다운 변환.

usage:
  python3 zendesk-article-to-md.py <article.json> "<section_name>" <out_dir>

전제:
  pip3 install --user markdownify beautifulsoup4
"""
import json
import os
import re
import sys
from datetime import date

from markdownify import markdownify as md


def slugify(text: str) -> str:
    """파일명용 슬러그 — 한글 보존 + 공백 → hyphen."""
    text = re.sub(r"[^\w가-힣\s-]", "", text, flags=re.UNICODE)
    text = re.sub(r"\s+", "-", text.strip())
    return text[:80]


def main() -> None:
    if len(sys.argv) != 4:
        print(
            'usage: zendesk-article-to-md.py <article.json> "<section_name>" <out_dir>',
            file=sys.stderr,
        )
        sys.exit(1)

    article_path, section_name, out_dir = sys.argv[1:4]

    with open(article_path, encoding="utf-8") as f:
        data = json.load(f)

    art = data["article"]
    title = art["title"]
    body_html = art.get("body") or ""
    body_md = md(body_html, heading_style="ATX").strip()

    slug = slugify(title)
    os.makedirs(out_dir, exist_ok=True)
    md_path = os.path.join(out_dir, f"{slug}.md")

    content = (
        f"# {title}\n\n"
        f"> 출처: <{art['html_url']}>\n"
        f"> Zendesk article id: `{art['id']}`\n"
        f"> 섹션: {section_name}\n"
        f"> 추출 시점: {date.today().isoformat()}\n\n"
        f"---\n\n"
        f"{body_md}\n"
    )

    with open(md_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(md_path)


if __name__ == "__main__":
    main()
