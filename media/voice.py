"""Ajusta la narración de cada vídeo a sus escenas.

La voz se genera en ElevenLabs con una pausa entre escena y escena. Este script busca esas pausas
(las más largas del audio), recorta cada frase, las vuelve a unir con una pausa corta y fija, y
escribe cuánto debe durar cada escena para que imagen y voz vayan a la vez.

Uso: python3 media/voice.py   (lee media/voice/raw-*.mp3, escribe media/voice/*.mp3 y timings.json)
"""
import json, re, subprocess, pathlib

HERE = pathlib.Path(__file__).parent / "voice"
SCENES = {"reel1": 6, "reel2": 7, "tour": 8, "guia": 7}
LEAD, GAP, TAIL = 0.35, 0.5, 1.1  # silencio antes, entre escenas y al final, en segundos


def run(*args):
    return subprocess.run(args, capture_output=True, text=True, check=False)


def silences(path):
    out = run("ffmpeg", "-hide_banner", "-i", str(path), "-af", "silencedetect=noise=-38dB:d=0.4", "-f", "null", "-").stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([0-9.]+)", out)]
    ends = [float(x) for x in re.findall(r"silence_end: ([0-9.]+)", out)]
    return list(zip(starts, ends))


def duration(path):
    return float(run("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)).stdout)


timings = {}
for name, n in SCENES.items():
    raw = HERE / f"raw-{name}.mp3"
    total = duration(raw)
    sil = [s for s in silences(raw) if s[0] > 0.3 and s[1] < total - 0.3]
    cuts = sorted(sorted(sil, key=lambda s: s[1] - s[0], reverse=True)[: n - 1])
    assert len(cuts) == n - 1, f"{name}: se esperaban {n - 1} pausas y hay {len(cuts)}"
    bounds = [0.0] + [x for c in cuts for x in c] + [total]
    segs = [(max(0, bounds[2 * i] - 0.04), bounds[2 * i + 1] + 0.1) for i in range(n)]
    # un filtro que recorta cada frase y las concatena con silencios fijos
    parts, labels = [], []
    for i, (a, b) in enumerate(segs):
        pad = LEAD if i == 0 else GAP
        parts.append(f"[0:a]atrim={a:.3f}:{b:.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.03,afade=t=out:st={b - a - 0.05:.3f}:d=0.05,adelay={int(pad * 1000)}:all=1[s{i}]")
        labels.append(f"[s{i}]")
    graph = ";".join(parts) + ";" + "".join(labels) + f"concat=n={n}:v=0:a=1,apad=pad_dur={TAIL},loudnorm=I=-16:TP=-1.5:LRA=11[out]"
    out = HERE / f"{name}.mp3"
    r = run("ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-filter_complex", graph, "-map", "[out]", "-ar", "44100", "-b:a", "160k", str(out))
    assert r.returncode == 0, r.stderr
    lens = [b - a for a, b in segs]
    durs = [round((LEAD if i == 0 else GAP) + l + (TAIL if i == n - 1 else 0), 2) for i, l in enumerate(lens)]
    timings[name] = durs
    print(f"{name}: {total:.1f} s → {duration(out):.1f} s · escenas {durs}")

(HERE / "timings.json").write_text(json.dumps(timings, indent=1))
