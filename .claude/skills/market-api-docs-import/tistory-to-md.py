#!/usr/bin/env python3
"""Tistory 블로그 기반 API docs (.entry-content) → 마크다운 변환 (전략 C).

G마켓/옥션 ESM OpenAPI(etapi.gmarket.com) 처럼 Tistory 블로그에 글 1개 = API 1개
로 올라온 사이트용. 제목은 본문 밖 og:title 에 있고, 본문은 .entry-content.
글 끝의 "카테고리의 다른 글" 관련글 네비와 공유/좋아요 버튼은 제거한다.

usage:
  tistory-to-md.py <html_path> <section_kr> <post_id> <out_dir> <page_url> [content_selector]

- post_id : Tistory 글 번호(파일명/screenName 으로 사용).
- content_selector : 기본 .entry-content.
EXTRACT_DATE env 로 추출 시점 주입.
"""
import sys, re, os
from bs4 import BeautifulSoup
from markdownify import markdownify as md

args = sys.argv[1:]
html_path, section_kr, post_id, out_dir, page_url = args[:5]
selector = args[5] if len(args) > 5 else ".entry-content"

soup = BeautifulSoup(open(html_path, encoding="utf-8").read(), "html.parser")

# 제목: og:title 우선
og = soup.find("meta", property="og:title")
title = og["content"].strip() if og and og.get("content") else post_id

box = soup.select_one(selector)
if box is None:
    sys.stderr.write(f"[warn] {selector} not found for {post_id}\n")
    box = soup.body

# "… 카테고리의 다른 글" 관련글 블록 이후 전부 제거 (네비, spec 아님)
for el in box.find_all(["h2", "h3", "h4", "div", "section"]):
    txt = el.get_text(" ", strip=True)
    if "카테고리의 다른 글" in txt or "관련글" in txt:
        # 이 요소와 그 뒤 형제 모두 제거
        for sib in list(el.find_all_next()):
            sib.decompose()
        el.decompose()
        break

# 공유/좋아요/버튼류 제거
for sel in [".container_postbtn", ".post_share", ".another_category", ".tt_btn_share",
            "[class*=postbtn]", "[class*=btn_share]", "[class*=sns]"]:
    for el in box.select(sel):
        el.decompose()

body_md = md(str(box), heading_style="ATX", bullets="-")
body_md = re.sub(r"\n{3,}", "\n\n", body_md).strip()

today = os.environ.get("EXTRACT_DATE", "")
date_line = f"> 추출 시점: {today}\n" if today else "> 추출 시점: (EXTRACT_DATE env 미설정)\n"

header = (
    f"# {title}\n\n"
    f"> 출처: {page_url}\n"
    f"> 섹션: {section_kr}\n"
    f"> Tistory post id: `{post_id}`\n"
    f"{date_line}\n---\n\n"
)

os.makedirs(out_dir, exist_ok=True)
out = os.path.join(out_dir, post_id + ".md")
open(out, "w", encoding="utf-8").write(header + body_md + "\n")
print(out)
