#!/usr/bin/env python3
"""정적 HTML API docs 페이지(.content-box) → 마크다운 변환 (전략 B).

로젠택배(openapihome.ilogen.com) 처럼 서버 렌더 HTML + JS nav(menuData.js) +
별도 example JSON 구조를 가진 사이트용. Zendesk article JSON 이 아닌, 일반 HTML
페이지에서 본문 컨테이너만 뽑아 markdownify 로 변환한다.

usage:
  static-html-to-md.py <html_path> <section_kr> <screen> <out_dir> <page_url> [example_json] [content_selector]

- example_json : 선택. {screen: {input:..., output:...}} 형태면 본문에 예시 병합. 없으면 "" 전달.
- content_selector : 선택. 본문 컨테이너 CSS 셀렉터 (기본 .content-box).
"""
import sys, json, re, os
from bs4 import BeautifulSoup
from markdownify import markdownify as md

args = sys.argv[1:]
html_path, section_kr, screen, out_dir, page_url = args[:5]
example_path = args[5] if len(args) > 5 else ""
selector = args[6] if len(args) > 6 else ".content-box"

soup = BeautifulSoup(open(html_path, encoding="utf-8").read(), "html.parser")
box = soup.select_one(selector) or soup.body

# h2 = article 제목 (본문에서 제거하고 헤더로 승격)
h2 = box.find("h2")
title = h2.get_text(strip=True) if h2 else screen
if h2:
    h2.decompose()

# 버튼 처리: btn-indigo => HTTP method 라벨 보존, 그 외(Example 등) => 제거
for btn in box.find_all("button"):
    cls = btn.get("class", [])
    label = btn.get_text(strip=True)
    if "btn-indigo" in cls:
        p = soup.new_tag("p")
        b = soup.new_tag("strong")
        b.string = f"HTTP Method: {label}"
        p.append(b)
        btn.replace_with(p)
    else:
        btn.decompose()

body_md = md(str(box), heading_style="ATX", bullets="-")
body_md = re.sub(r"\n{3,}", "\n\n", body_md).strip()

# 요청/응답 예시 병합 (example JSON 제공 시)
ex_md = ""
if example_path and os.path.exists(example_path):
    ex = json.load(open(example_path, encoding="utf-8")).get(screen, {})
    if ex:
        ex_md = "\n\n## 요청/응답 예시\n"
        if "input" in ex:
            ex_md += "\n**Input**\n\n```json\n" + json.dumps(ex["input"], ensure_ascii=False, indent=2) + "\n```\n"
        if "output" in ex:
            ex_md += "\n**Output**\n\n```json\n" + json.dumps(ex["output"], ensure_ascii=False, indent=2) + "\n```\n"

today = os.environ.get("EXTRACT_DATE", "")
date_line = f"> 추출 시점: {today}\n" if today else "> 추출 시점: (EXTRACT_DATE env 미설정)\n"

header = (
    f"# {title}\n\n"
    f"> 출처: {page_url}\n"
    f"> 섹션: {section_kr}\n"
    f"> screenName: `{screen}`\n"
    f"{date_line}\n---\n\n"
)

os.makedirs(out_dir, exist_ok=True)
out = os.path.join(out_dir, screen + ".md")
open(out, "w", encoding="utf-8").write(header + body_md + ex_md + "\n")
print(out)
