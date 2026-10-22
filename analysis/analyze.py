#!/usr/bin/env python3
"""
ClearVoice AI — Pronunciation Analysis Engine (Python)
======================================================
Receives a JSON payload on stdin describing a single practice attempt:

{
  "expected":   "The quick brown fox jumps over the lazy dog",
  "heard":     "The quick brown fox jump over the lazy dog",
  "duration_ms": 5200,
  "pauses":    [{"start_ms": 1200, "end_ms": 1750}, ...],   # detected silent gaps
  "alt_heard": ["alt transcript 1", ...]                     # optional SR alternatives
}

Pipeline:
  1. Normalisation & tokenisation
  2. Word-level alignment (Levenshtein, full backtrace)
  3. Per-word phonetic similarity scoring (grapheme skeleton + vowel-class model)
  4. Fluency model (WPM band, pause frequency, longest pause)
  5. Clarity model (aggregate confidence)
  6. Coaching-tip generation from detected error classes

Emits a single JSON object on stdout. Pure stdlib — no dependencies.
"""

import json
import re
import sys
import math

# ---------------------------------------------------------------- utilities

WORD_RE = re.compile(r"[a-zA-Z']+")

def tokenize(text: str):
    return WORD_RE.findall(text.lower().replace("’", "'"))

def strip_possessive(tok: str) -> str:
    return re.sub(r"'s$|s'$", "", tok)

# Rough but linguistically-grounded phonetic skeleton: collapse English spelling
# to its dominant sound classes so "through"/"threw"/"throo" score as near-identical.
GRAPHEME_RULES = [
    (r"ough|augh", "o"), (r"tion|sion", "shn"), (r"eigh", "a"), (r"igh", "i"),
    (r"ee|ea|ie", "i"), (r"oo|ew|ue|ui", "u"), (r"ay|ai|ey|ei", "a"), (r"ow|oa|oe", "o"),
    (r"ou|au", "o"), (r"ph", "f"), (r"ck", "k"), (r"qu", "kw"), (r"x", "ks"),
    (r"th", "th"), (r"ch", "ch"), (r"sh", "sh"), (r"wh", "w"), (r"wr", "r"),
    (r"kn|gn", "n"), (r"mb", "m"), (r"^h|\sh", "h"), (r"wh", "w"),
    (r"c(?=[eiy])", "s"), (r"g(?=[eiy])", "j"), (r"y", "i"), (r"w", "u"),
]
VOWELS = "aeiou"

def skeleton(word: str) -> str:
    w = strip_possessive(word.lower())
    for pat, rep in GRAPHEME_RULES:
        w = re.sub(pat, rep, w)
    # collapse doubles, drop silent trailing e
    w = re.sub(r"(.)\1+", r"\1", w)
    w = re.sub(r"e$", "", w)
    return w

def vowel_pattern(word: str) -> str:
    return "".join(c for c in skeleton(word) if c in VOWELS)

def cons_pattern(word: str) -> str:
    return "".join(c for c in skeleton(word) if c not in VOWELS)

def lev(a: str, b: str) -> int:
    if a == b:
        return 0
    la, lb = len(a), len(b)
    if not la: return lb
    if not lb: return la
    prev = list(range(lb + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(cur[-1] + 1, prev[j] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[lb]

def phonetic_similarity(exp: str, got: str) -> float:
    """0..1 similarity between two spoken tokens."""
    if exp == got:
        return 1.0
    se, sg = skeleton(exp), skeleton(got)
    if se == sg:
        return 0.96  # homophone-class match
    maxlen = max(len(se), len(sg), 1)
    skel = 1.0 - lev(se, sg) / maxlen
    ve, vg = vowel_pattern(exp), vowel_pattern(got)
    vmax = max(len(ve), len(vg), 1)
    vow = 1.0 - lev(ve, vg) / vmax
    ce, cg = cons_pattern(exp), cons_pattern(got)
    cmax = max(len(ce), len(cg), 1)
    con = 1.0 - lev(ce, cg) / cmax
    # vowels carry English intelligibility; consonants carry articulation detail
    score = 0.40 * skel + 0.35 * vow + 0.25 * con
    return round(max(0.0, min(1.0, score)), 3)

# ------------------------------------------------------------- alignment

def align(exp_words, got_words):
    """Levenshtein alignment returning list of (i_or_None, j_or_None) pairs."""
    n, m = len(exp_words), len(got_words)
    d = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1): d[i][0] = i
    for j in range(1, m + 1): d[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = 0 if exp_words[i - 1] == got_words[j - 1] else 1
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
    pairs = []
    i, j = n, m
    while i > 0 or j > 0:
        if i > 0 and j > 0:
            cost = 0 if exp_words[i - 1] == got_words[j - 1] else 1
            if d[i][j] == d[i - 1][j - 1] + cost:
                pairs.append((i - 1, j - 1)); i -= 1; j -= 1; continue
        if i > 0 and d[i][j] == d[i - 1][j] + 1:
            pairs.append((i - 1, None)); i -= 1; continue
        pairs.append((None, j - 1)); j -= 1
    pairs.reverse()
    return pairs

# --------------------------------------------------------------- metrics

def wpm(word_count: int, duration_ms: int) -> float:
    minutes = max(duration_ms / 60000.0, 1e-6)
    return round(word_count / minutes, 1)

def fluency_score(wpm_val: float, pause_count: int, longest_pause_ms: int, word_count: int) -> float:
    # Comfortable intermediate band: 118–165 WPM scores full marks
    if 118 <= wpm_val <= 165:
        pace = 100.0
    elif wpm_val < 118:
        pace = max(35.0, 100.0 - (118 - wpm_val) * 1.15)
    else:
        pace = max(35.0, 100.0 - (wpm_val - 165) * 1.25)
    minutes = max(word_count / max(wpm_val, 1), 0.05)
    pauses_per_min = pause_count / minutes
    pause_pen = min(38.0, pauses_per_min * 4.6)
    longest_pen = max(0.0, (longest_pause_ms - 650) / 90.0) if longest_pause_ms > 650 else 0.0
    longest_pen = min(22.0, longest_pen)
    return round(max(20.0, min(100.0, pace - pause_pen - longest_pen)), 1)

def clarity_score(word_scores) -> float:
    if not word_scores:
        return 0.0
    # harmonised mean pulls down weak links without punishing one outlier excessively
    eps = 1e-6
    inv = sum(1.0 / max(s, eps) for s in word_scores) / len(word_scores)
    hm = 1.0 / inv
    return round(hm * 100, 1)

def classify(score: float) -> str:
    if score >= 0.93: return "perfect"
    if score >= 0.74: return "good"
    if score >= 0.45: return "shaky"
    return "missed"

# syllable-ish weight for timing estimates (also used for pause attribution)
def syllables(word: str) -> int:
    w = re.sub(r"e$", "", word.lower())
    groups = re.findall(r"[aeiouy]+", w)
    return max(1, len(groups))

# classify likely error classes for coaching tips
def error_class(expected: str, heard: str):
    e, h = expected.lower(), heard.lower()
    if e.endswith(("s", "z", "sh", "ch", "t", "d", "k", "p", "g", "b")) and not h.endswith(e[-1]):
        return "final-consonant"
    if ("th" in e) != ("th" in h):
        return "th-sound"
    if abs(len(e) - len(h)) >= 3 or e[0] != h[0]:
        return "word-shape"
    if vowel_pattern(e) != vowel_pattern(h):
        return "vowel-quality"
    return "stress-rhythm"

TIP_LIBRARY = {
    "final-consonant": "Release final consonants fully — let /t/, /d/, /s/ and /k/ land with a light, audible tap. Trailing sounds are the #1 clarity leak for intermediate speakers.",
    "th-sound": "For /θ/ and /ð/, place the tongue tip lightly between the teeth and let air flow over it — not behind the teeth like /s/ or /f/. Feel the difference on ‘think’ vs ‘sink’.",
    "word-shape": "This word’s outline changed shape — exaggerated articulation helps. Slow it down 50%, hit every vowel, then rebuild speed while keeping the skeleton intact.",
    "vowel-quality": "English vowels reduce under stress — aim for a relaxed schwa /ə/ in weak syllables and a full, long vowel on the stressed beat. Contrast the two deliberately.",
    "stress-rhythm": "Unstressed syllables flatten into schwas. Tap the stressed beat with your finger while speaking to lock in English’s stress-timed rhythm.",
    "pace": "Aim for the 120–160 WPM band — quick enough to flow, slow enough for consonants to land. Use a breath, not a stumble, between thought groups.",
    "pauses": "Cluster pauses at thought boundaries only. Hesitations mid-phrase fracture the rhythmic line — mark the commas in the sentence and breathe exactly there.",
}

def build_tips(word_results, flu: float, wpm_val: float, pause_count: int, word_count: int):
    tips = []
    classes = {}
    for wr in word_results:
        if wr["status"] in ("shaky", "missed"):
            cls = error_class(wr["expected"], wr.get("heard") or "")
            classes[cls] = classes.get(cls, 0) + 1
    for cls, _ in sorted(classes.items(), key=lambda kv: -kv[1]):
        tips.append(TIP_LIBRARY[cls])
        if len(tips) == 2:
            break
    if wpm_val > 165 or wpm_val < 118:
        tips.append(TIP_LIBRARY["pace"])
    if word_count > 0:
        ppm = pause_count / max(word_count / max(wpm_val, 1), 0.05)
        if ppm > 4:
            tips.append(TIP_LIBRARY["pauses"])
    if not tips:
        tips.append("Excellent control — this attempt is studio grade. Raise the difficulty: longer sentences, faster delivery, or whispered reading for articulation precision.")
    return tips[:4]

# ------------------------------------------------------------------- main

def analyze(payload: dict) -> dict:
    expected_raw = payload.get("expected", "")
    heard_raw = payload.get("heard", "")
    duration_ms = int(payload.get("duration_ms", 0)) or 4000
    pauses = payload.get("pauses", []) or []

    exp_words = tokenize(expected_raw)
    got_raw_tokens = tokenize(heard_raw)

    # keep only plausible tokens (SR can echo disfluencies)
    got_words = [w for w in got_raw_tokens if len(w) > 0]

    pairs = align(exp_words, got_words)

    word_results = []
    scores = []
    consumed_j = set()
    for ei, gi in pairs:
        if ei is None:
            # inserted word the user said that isn't in the script — note it but don't tank the score
            word_results.append({
                "expected": None, "heard": got_words[gi], "status": "extra",
                "score": 0.5, "issue": "word-shape",
            })
            consumed_j.add(gi)
            continue
        e = exp_words[ei]
        if gi is None:
            word_results.append({
                "expected": e, "heard": None, "status": "missed",
                "score": 0.0, "issue": "word-shape",
            })
            scores.append(0.0)
            continue
        h = got_words[gi]
        consumed_j.add(gi)
        sim = phonetic_similarity(e, h)
        scores.append(sim)
        issue = None if sim >= 0.74 else error_class(e, h)
        word_results.append({
            "expected": e, "heard": h, "status": classify(sim),
            "score": sim, "issue": issue,
        })

    if not exp_words:
        accuracy, clarity = 0.0, 0.0
    else:
        accuracy = round(sum(scores) / len(exp_words) * 100, 1) if scores else 0.0
        clarity = clarity_score(scores if scores else [0.0])

    pause_count = len(pauses)
    longest_pause = int(max((p.get("end_ms", 0) - p.get("start_ms", 0) for p in pauses), default=0))
    wpm_val = wpm(len(got_words) or len(exp_words), duration_ms)
    fluency = fluency_score(wpm_val, pause_count, longest_pause, len(exp_words))

    # pauses positioned inside words vs between words: flag mid-word breaks
    word_pauses = [p for p in pauses if 200 <= (p.get("end_ms", 0) - p.get("start_ms", 0)) <= 650]

    # syllable-weighted timing grid for word-level replay (estimated)
    total_syl = sum(syllables(w) for w in exp_words) or 1
    timings = []
    cursor = 0.0
    usable = float(duration_ms)
    for w in exp_words:
        span = (syllables(w) / total_syl) * usable
        timings.append({"word": w, "start_ms": int(cursor), "end_ms": int(cursor + span)})
        cursor += span

    tips = build_tips(word_results, fluency, wpm_val, pause_count, len(exp_words))

    graded = [w for w in word_results if w["expected"]]
    strong = sum(1 for w in graded if w["status"] in ("perfect", "good"))
    weak_words = [w["expected"] for w in graded if w["status"] in ("shaky", "missed")]

    overall = round(accuracy * 0.45 + fluency * 0.25 + clarity * 0.30, 1)

    return {
        "overall": overall,
        "accuracy": accuracy,
        "clarity": clarity,
        "fluency": fluency,
        "wpm": wpm_val,
        "word_count": len(exp_words),
        "duration_ms": duration_ms,
        "pause_count": pause_count,
        "longest_pause_ms": longest_pause,
        "thought_boundary_pauses": len(word_pauses),
        "strong_words": strong,
        "weak_words": weak_words,
        "substitutions": sum(1 for w in graded if w["status"] == "shaky"),
        "deletions": sum(1 for w in graded if w["status"] == "missed"),
        "word_results": word_results,
        "timings": timings,
        "tips": tips,
        "engine": "clearvoice-python/1.4.2",
    }

if __name__ == "__main__":
    try:
        payload = json.load(sys.stdin)
        result = analyze(payload)
        json.dump(result, sys.stdout)
        sys.exit(0)
    except Exception as exc:  # never crash the Node pipeline
        json.dump({"error": str(exc)}, sys.stdout)
        sys.exit(1)
