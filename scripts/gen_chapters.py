#!/usr/bin/env python3
# 全12章の挿絵を、キャラシート(art/character-sheet_1.png)を参照画像として渡して一貫生成。
# 出力 = viewer/public/illustrations/<file>.png（build.mjs の ILLUS と一致）。
import os, json, base64, urllib.request, time, datetime

KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
assert KEY, "GEMINI_API_KEY required (source /Users/yuki/.env)"
MODEL = "gemini-3-pro-image-preview"
URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={KEY}"
ROOT = "/Users/yuki/workspace/the-board-of-one-and-a-devil"
OUT = f"{ROOT}/viewer/public/illustrations"
REF = f"{ROOT}/art/character-sheet_1.png"
LOG = open(f"{ROOT}/art/gen.log", "a")
REF_B64 = base64.b64encode(open(REF, "rb").read()).decode()

def log(m):
    line = f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {m}"
    print(line); LOG.write(line + "\n"); LOG.flush()

STYLE = (
  "Warm hand-drawn editorial line illustration with soft watercolor fill, muted pastel palette "
  "(sage green, beige, cream, soft warm grey), confident thin clean outlines, warm negative space, "
  "gentle 'storybook for grown-ups' tone with dry wit. ONE red accent (#c0392b) used ONLY for the devil "
  "(its horns, tail, apple). Warm office/dining setting with a window and soft evening light. "
  "NO text, NO letters, NO captions, NO labels anywhere. Wide 16:9 composition."
)
CAST = (
  "Use the EXACT same seven character designs as the attached reference sheet, identical clothing and props: "
  "THE CHAIR (grey sweatshirt, can of coffee), CEO (grey turtleneck, round glasses), CMO (beige jacket, notebook+pen), "
  "CTO (black hoodie, black mug), COO (white shirt rolled sleeves, laptop), CFO (navy blazer, calculator), "
  "and THE DEVIL (small black imp, red horns/tail, sitting backwards on a chair biting a red apple). "
  "A round meeting table, the chair's seat is largest, the devil's chair is turned backwards and set slightly apart."
)

SCENES = [
 ("ch00-prologue", "Sunday 4pm: THE CHAIR enters and finds the six executives already seated around the round table, and a 7th chair turned backwards where the small red-horned DEVIL sits biting an apple. Quiet surprised reveal, warm light."),
 ("ch01-yaranai",  "THE CHAIR at a whiteboard with a two-column list (just marks/lines, NO text), deciding what NOT to do; CEO points calmly, COO takes notes, the DEVIL watches over the shoulder biting an apple. relief on the chair's shoulders."),
 ("ch02-thinking", "THE CHAIR about to email a rough handwritten notebook page while a thick neat stack of printed documents is pushed aside on the table; CMO smiles encouragingly, CTO sips his black mug, the DEVIL peeks from behind the chair-back."),
 ("ch03-jigoku",   "late-night debugging: CTO and THE CHAIR hunched over a laptop in a dim room, a tiny bright light just appearing on screen (the fix), COO noting steps, the DEVIL sprawled bored upside-down on his backward chair. quiet tension."),
 ("ch04-devil",    "THE CHAIR proposes adding an AI reviewer; the DEVIL sulks jealously on his backward chair, arms crossed over the chair-back, apple untouched; CTO and COO discuss. one extra empty small chair hinted."),
 ("ch05-secret",   "night, THE CHAIR alone at a keyboard, cold dread on his face, a faint red warning glow from the screen (the leaked key); later CTO and CFO lean in seriously, the DEVIL unusually quiet, low red light. tense, intimate."),
 ("ch06-omakase",  "a warm handshake/partnership moment between THE CHAIR and his work; CMO watches warmly, CTO nods, the DEVIL bites his apple approvingly for once. 'delegate and trust' mood, forward and light."),
 ("ch07-houses",   "COO presents a tidy phased plan; a visual metaphor of many small identical houses being arranged neatly onto one shelf/grid; CTO inspects, THE CHAIR relieved, the DEVIL twirls his apple. orderly, satisfying."),
 ("ch08-structure","rainy window; THE CHAIR with CEO, CMO and CFO around two plans pinned on the board (blank papers, NO text) — same size but different structure; CFO holds calculator, the DEVIL nods rarely. thoughtful, slightly heavy mood."),
 ("ch09-words",    "CMO and THE CHAIR crossing out one phrase on a draft with a single red-free pencil line and rewriting (blank lines only, NO letters); CEO approves quietly; the DEVIL gives a rare small smile of approval. light, fresh, green outside."),
 ("ch10-finale",   "half-year review: all seven around the table, a stack of bound meeting minutes and an apple core on the table; everyone a little warmer and closer; the DEVIL relaxed on his backward chair. white bright light, quietly emotional."),
 ("ch99-epilogue", "a hand on the door switch leaving the room at night; the round table and seven chairs in soft shadow, the DEVIL's small silhouette still faintly on the backward chair with an apple. tender, closing, moonlight."),
]

def gen(name, scene):
    body = json.dumps({
      "contents": [{"parts": [
        {"inlineData": {"mimeType": "image/png", "data": REF_B64}},
        {"text": STYLE + "\n\n" + CAST + "\n\nSCENE: " + scene}
      ]}],
      "generationConfig": {"responseModalities": ["IMAGE", "TEXT"]}
    }).encode()
    req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json"})
    for attempt in range(3):
        try:
            log(f"→ {name} (attempt {attempt+1})")
            with urllib.request.urlopen(req, timeout=180) as resp:
                data = json.load(resp)
            for part in data["candidates"][0]["content"]["parts"]:
                if "inlineData" in part:
                    img = base64.b64decode(part["inlineData"]["data"])
                    open(f"{OUT}/{name}.png", "wb").write(img)
                    log(f"  ✔ {name}.png ({len(img)//1024} KB)")
                    return True
            log(f"  ✗ {name}: no image. head: {json.dumps(data)[:200]}")
        except Exception as e:
            log(f"  ! {name} attempt {attempt+1}: {e}")
            time.sleep(4)
    return False

if __name__ == "__main__":
    log("=== chapter illustrations (12) regen start, ref=character-sheet_1 ===")
    ok = 0
    for name, scene in SCENES:
        if gen(name, scene):
            ok += 1
    log(f"=== done: {ok}/{len(SCENES)} ===")
