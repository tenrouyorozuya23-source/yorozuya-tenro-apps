import json
from faster_whisper import WhisperModel

model = WhisperModel("small", device="cpu", compute_type="int8")
segments, info = model.transcribe(
    "/tmp/claude-0/-home-user-yorozuya-tenro-apps/479c9c35-7524-5be0-9909-9a5f23203d37/scratchpad/audio16k.wav",
    language="ja",
    word_timestamps=True,
    vad_filter=False,
    condition_on_previous_text=False,
    beam_size=5,
)
out = []
for seg in segments:
    words = [{"w": w.word, "s": round(w.start, 2), "e": round(w.end, 2)} for w in (seg.words or [])]
    out.append({"s": round(seg.start, 2), "e": round(seg.end, 2), "text": seg.text, "words": words})
    print(f"[{seg.start:7.2f} - {seg.end:7.2f}] {seg.text}", flush=True)

with open("/tmp/claude-0/-home-user-yorozuya-tenro-apps/479c9c35-7524-5be0-9909-9a5f23203d37/scratchpad/transcript.json", "w") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
print("DONE")
