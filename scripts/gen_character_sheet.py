#!/usr/bin/env python3
# キャラシート（7人の参照画像）を gemini-3-pro-image-preview で生成。
# 正典: art/CHARACTER-SHEET.md。全挿絵の一貫性の基準。
import os, json, base64, urllib.request, time, sys, datetime

KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
assert KEY, "GEMINI_API_KEY required (source /Users/yuki/.env)"
MODEL = "gemini-3-pro-image-preview"
URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={KEY}"
OUT = "/Users/yuki/workspace/the-board-of-one-and-a-devil/art"
os.makedirs(OUT, exist_ok=True)
LOG = open(f"{OUT}/gen.log", "a")

def log(m):
    line = f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {m}"
    print(line); LOG.write(line + "\n"); LOG.flush()

STYLE = (
  "Warm hand-drawn editorial line illustration with soft watercolor fill. "
  "Muted pastel palette: sage green, beige, cream, soft warm grey. Confident thin clean outlines, "
  "lots of warm negative space, gentle 'storybook for grown-ups' tone with a touch of dry wit. "
  "ONE red accent color (#c0392b) used ONLY for the devil (its horns, tail, and apple). "
  "Plain warm cream background. NO text, NO letters, NO captions, NO labels anywhere in the image."
)

# キャラ参照シート: 7人を一列に、全身、ニュートラルなポーズ。服の色で明確に描き分ける。
SHEET = (
  "A character reference line-up sheet: seven distinct characters standing side by side in a row, "
  "full body, neutral simple poses, evenly spaced on a plain cream background. Left to right: "
  "(1) THE CHAIR — an ordinary calm Japanese man in a plain neutral grey sweatshirt, relaxed, holding a CAN of coffee. "
  "(2) CEO — a quiet upright man in a GREY TURTLENECK with thin round glasses, calmly polishing his glasses. "
  "(3) CMO — a friendly soft-smiling person in a BEIGE jacket, always holding a small NOTEBOOK and pen. "
  "(4) CTO — a gruff man in a BLACK HOODIE (hood lightly up), arms crossed, holding a black coffee MUG. "
  "(5) COO — a neat crisp person in a WHITE SHIRT with rolled-up sleeves, holding a thin LAPTOP. "
  "(6) CFO — a deadpan expressionless man in a NAVY blazer, holding a small CALCULATOR. "
  "(7) THE DEVIL — a SMALL black imp silhouette with tiny RED (#c0392b) horns and a red tail, "
  "sitting BACKWARDS on a small wooden chair, BITING a red apple, half-lidded smug eyes and a smirk. "
  "Make each clearly different by clothing color. Keep designs simple and iconic so they can be reused consistently. Wide 16:9 composition."
)

def gen(name, prompt, n=1):
    ok = 0
    for i in range(n):
        body = json.dumps({
          "contents": [{"parts": [{"text": STYLE + "\n\n" + prompt}]}],
          "generationConfig": {"responseModalities": ["IMAGE", "TEXT"]}
        }).encode()
        req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json"})
        tag = name if n == 1 else f"{name}_{i+1}"
        for attempt in range(3):
            try:
                log(f"→ generating {tag} (attempt {attempt+1})")
                with urllib.request.urlopen(req, timeout=180) as resp:
                    data = json.load(resp)
                got = False
                for part in data["candidates"][0]["content"]["parts"]:
                    if "inlineData" in part:
                        img = base64.b64decode(part["inlineData"]["data"])
                        path = f"{OUT}/{tag}.png"
                        open(path, "wb").write(img)
                        log(f"  ✔ {tag}.png ({len(img)//1024} KB)")
                        got = True; ok += 1; break
                if got:
                    break
                log(f"  ✗ {tag}: no image. resp head: {json.dumps(data)[:300]}")
            except Exception as e:
                log(f"  ! {tag} attempt {attempt+1}: {e}")
                time.sleep(3)
    return ok

if __name__ == "__main__":
    log("=== character sheet generation start ===")
    got = gen("character-sheet", SHEET, n=2)  # 2案
    log(f"=== done: {got} image(s) ===")
