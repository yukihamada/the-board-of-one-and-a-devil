#!/usr/bin/env python3
# ch10の文字漏れ修正 + 表紙アート(キャラ/悪魔・文字なし・縦)を生成。参照=character-sheet_1。
import os, json, base64, urllib.request, time, datetime

KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
assert KEY
MODEL = "gemini-3-pro-image-preview"
URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={KEY}"
ROOT = "/Users/yuki/workspace/the-board-of-one-and-a-devil"
REF_B64 = base64.b64encode(open(f"{ROOT}/art/character-sheet_1.png", "rb").read()).decode()
LOG = open(f"{ROOT}/art/gen.log", "a")

def log(m):
    line = f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {m}"; print(line); LOG.write(line+"\n"); LOG.flush()

STYLE = ("Warm hand-drawn editorial line illustration with soft watercolor fill, muted pastel palette "
  "(sage green, beige, cream, soft warm grey), confident thin outlines, warm negative space, gentle wit. "
  "ONE red accent (#c0392b) used ONLY for the devil (horns, tail, apple). "
  "ABSOLUTELY NO text, NO letters, NO numbers, NO captions, NO labels, NO writing of any kind anywhere; "
  "any books/papers are completely BLANK.")
CAST = ("Use the EXACT seven character designs from the attached reference sheet (identical clothing/props): "
  "THE CHAIR (grey sweatshirt, can), CEO (grey turtleneck, round glasses), CMO (beige jacket, notebook), "
  "CTO (black hoodie, black mug), COO (white shirt rolled sleeves, laptop), CFO (navy blazer, calculator), "
  "DEVIL (small black imp, red horns/tail, backwards on a chair biting a red apple).")

JOBS = [
 ("viewer/public/illustrations/ch10-finale", "16:9 wide. half-year review: all seven seated around the round table, a stack of BLANK bound booklets and a red apple core on the table, everyone a little warmer and closer, the DEVIL relaxed on his backward chair. bright white warm light, quietly emotional. NO text anywhere."),
 ("art/cover-art", "VERTICAL book-cover portrait composition (2:3), elegant and iconic. A warm round meeting table seen from a slightly elevated three-quarter angle, six executives softly suggested around it, and as the clear focal point the small black DEVIL with red horns and red tail sitting BACKWARDS on his chair biting a red apple. Generous empty cream space at the TOP third for a title to be added later. Minimal, premium, muted palette with the single red accent on the devil. NO text at all."),
]

def gen(rel, scene):
    out = f"{ROOT}/{rel}.png"
    body = json.dumps({"contents":[{"parts":[
        {"inlineData":{"mimeType":"image/png","data":REF_B64}},
        {"text": STYLE + "\n\n" + CAST + "\n\nSCENE: " + scene}]}],
        "generationConfig":{"responseModalities":["IMAGE","TEXT"]}}).encode()
    req = urllib.request.Request(URL, data=body, headers={"Content-Type":"application/json"})
    for a in range(3):
        try:
            log(f"→ {rel} (attempt {a+1})")
            with urllib.request.urlopen(req, timeout=180) as resp: data = json.load(resp)
            for p in data["candidates"][0]["content"]["parts"]:
                if "inlineData" in p:
                    open(out,"wb").write(base64.b64decode(p["inlineData"]["data"]))
                    log(f"  ✔ {rel}.png"); return True
            log(f"  ✗ {rel}: no image")
        except Exception as e:
            log(f"  ! {rel} {a+1}: {e}"); time.sleep(4)
    return False

if __name__ == "__main__":
    log("=== extras: ch10 fix + cover art ===")
    for rel, sc in JOBS: gen(rel, sc)
    log("=== extras done ===")
