#!/usr/bin/env python3
# 表紙アート(art/cover-art.png)にタイトルを組んで KDP判型 1600x2560 で書き出す。
from PIL import Image, ImageDraw, ImageFont

ROOT = "/Users/yuki/workspace/the-board-of-one-and-a-devil"
ART = f"{ROOT}/art/cover-art.png"
FONT = "/System/Library/Fonts/ヒラギノ明朝 ProN.ttc"
W, H = 1600, 2560

def f(size, idx=0):
    try: return ImageFont.truetype(FONT, size, index=idx)
    except Exception: return ImageFont.truetype(FONT, size)

# 1) 背景=アートを cover で敷く(中央クロップ)
art = Image.open(ART).convert("RGB")
scale = max(W / art.width, H / art.height)
art2 = art.resize((round(art.width * scale), round(art.height * scale)), Image.LANCZOS)
left = (art2.width - W) // 2; top = (art2.height - H) // 2
canvas = art2.crop((left, top, left + W, top + H))

d = ImageDraw.Draw(canvas)
DARK = (32, 36, 43); RED = (192, 57, 43); MUTED = (90, 90, 100)

def center(text, font, y, fill):
    w = d.textlength(text, font=font)
    d.text(((W - w) / 2, y), text, font=font, fill=fill)
    return w

def center_two(a, b, font, y, fa, fb):
    wa = d.textlength(a, font=font); wb = d.textlength(b, font=font)
    x = (W - (wa + wb)) / 2
    d.text((x, y), a, font=font, fill=fa)
    d.text((x + wa, y), b, font=font, fill=fb)

# 2) タイトル(上部の余白に)。「悪魔」だけ赤。
title = f(150, idx=1)
center("6人の役員と", title, 200, DARK)
center_two("1匹の", "悪魔", title, 200 + 182, DARK, RED)
# サブタイトル
sub = f(50)
center("── ひとり会社の取締役会", sub, 200 + 182 + 182 + 28, MUTED)

# 3) 著者・版元(下部)
au = f(54); pr = f(34)
center("粟田Kenny", au, H - 230, DARK)
center("Atsume Press", pr, H - 150, MUTED)

canvas.save(f"{ROOT}/cover/cover.png")
canvas.convert("RGB").save(f"{ROOT}/cover/cover.jpg", quality=92)
print(f"wrote cover/cover.png and cover/cover.jpg ({W}x{H})")
