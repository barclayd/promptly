"""Generates the 60s Promptly showreel score + SFX one-shots.

Run with:
    uv run --with numpy --with scipy python compose.py

Writes:
    ../public/audio/music.wav
    ../public/audio/sfx/*.wav
    ../public/audio/manifest.json
"""
from __future__ import annotations

import json
import subprocess
import wave
from pathlib import Path

import numpy as np
import dsp
import instruments as inst
from dsp import SR, n_samples

HERE = Path(__file__).resolve().parent
AUDIO_DIR = HERE.parent / "public" / "audio"
SFX_DIR = AUDIO_DIR / "sfx"
SFX_DIR.mkdir(parents=True, exist_ok=True)

BPM = 120
BEAT = 0.5
BAR = 2.0
N_BARS = 30
TOTAL_SECONDS = 60.0
N_TOTAL = n_samples(TOTAL_SECONDS)
assert N_TOTAL == 2_880_000

# ---------------------------------------------------------------- grid helpers

def bar_time(bar: int) -> float:
    return (bar - 1) * BAR


PROGRESSION = [
    {"bass": "F2", "notes": ["F3", "Ab3", "C4", "G4"]},   # i   Fm add9
    {"bass": "Db2", "notes": ["Db3", "F3", "Ab3", "Eb4"]},  # VI  Dbmaj add9
    {"bass": "Ab2", "notes": ["Ab3", "C4", "Eb4", "Bb4"]},  # III Abmaj add9
    {"bass": "Eb2", "notes": ["Eb3", "G3", "Bb3", "F4"]},   # VII Ebmaj add9
]


def chord_for_bar(bar: int) -> dict:
    return PROGRESSION[(bar - 1) % 4]


def chord_freqs(chord: dict) -> list[float]:
    return [dsp.note_to_freq(n) for n in chord["notes"]]


def bass_freq(chord: dict) -> float:
    return dsp.note_to_freq(chord["bass"])


master = np.zeros((N_TOTAL, 2))


def mix(event: np.ndarray, t: float, duck_env: np.ndarray | None = None) -> None:
    s = n_samples(t)
    if duck_env is not None:
        e = min(s + event.shape[0], N_TOTAL)
        if e > s:
            g = duck_env[s:e]
            event = event.copy()
            event[: e - s] *= g[:, None]
    dsp.mix_at(master, event, s)


def sweep_value(t: float, t0: float, t1: float, v0: float, v1: float) -> float:
    frac = min(max((t - t0) / (t1 - t0), 0.0), 1.0)
    return v0 * (v1 / v0) ** frac


# ---------------------------------------------------------------- pattern generation

def groove_pattern(bar_start: int, bar_end: int, skip_last_16th_bar: int | None = None):
    kicks, claps, hats_c, hats_o = [], [], [], []
    for bar in range(bar_start, bar_end + 1):
        bs = bar_time(bar)
        for beat in range(4):
            kicks.append(bs + beat * BEAT)
        claps.append(bs + BEAT)
        claps.append(bs + 3 * BEAT)
        for slot in range(16):
            if skip_last_16th_bar == bar and slot == 15:
                continue
            t = bs + slot * 0.125
            if slot % 4 == 2:
                hats_o.append(t)
            else:
                hats_c.append(t)
    return kicks, claps, hats_c, hats_o


def render_groove_drums(kicks, claps, hats_c, hats_o, kick_amp=1.0, clap_amp=0.85,
                          hat_c_amp=0.32, hat_o_amp=0.4):
    for i, t in enumerate(kicks):
        vel = 1.0 if (i % 1 == 0) else 0.9
        mix(inst.kick(0.35, amp=kick_amp * vel), t)
    for t in claps:
        mix(inst.clap(0.22, amp=clap_amp), t)
    rng = np.random.default_rng(42)
    for t in hats_c:
        vel = 0.85 + 0.3 * rng.random()
        mix(inst.hat(0.045, open_=False, amp=hat_c_amp * vel), t)
    for t in hats_o:
        vel = 0.85 + 0.3 * rng.random()
        mix(inst.hat(0.16, open_=True, amp=hat_o_amp * vel), t)


def render_pumping_bass(bar_start: int, bar_end: int, duck_env, amp=0.85, cutoff=280.0,
                          progressive_hp_from=None, progressive_hp_to=None,
                          hp_start_t=None, hp_end_t=None):
    for bar in range(bar_start, bar_end + 1):
        bs = bar_time(bar)
        chord = chord_for_bar(bar)
        f = bass_freq(chord)
        for beat in range(4):
            t = bs + beat * BEAT
            note = inst.bass_note(f, 0.46, cutoff=cutoff, amp=amp)
            if progressive_hp_from is not None:
                cutoff_hp = sweep_value(t, hp_start_t, hp_end_t, progressive_hp_from, progressive_hp_to)
                note = dsp.butter_filter(note, cutoff_hp, "high", order=2)
            mix(note, t, duck_env)


def render_chord_stabs_downbeat(bar_start: int, bar_end: int, duck_env, amp=0.55, cutoff=3200.0,
                                  dur=1.9):
    for bar in range(bar_start, bar_end + 1):
        bs = bar_time(bar)
        chord = chord_for_bar(bar)
        note = inst.chord_hit(chord_freqs(chord), dur, cutoff=cutoff, amp=amp, attack=0.01, release=0.5)
        mix(note, bs, duck_env)


def render_chord_stabs_offbeat(bar_start: int, bar_end: int, duck_env, amp=0.45, cutoff=2200.0,
                                 progressive_hp_from=None, progressive_hp_to=None,
                                 hp_start_t=None, hp_end_t=None):
    for bar in range(bar_start, bar_end + 1):
        bs = bar_time(bar)
        chord = chord_for_bar(bar)
        for off in (0.75, 1.75):
            t = bs + off
            note = inst.chord_hit(chord_freqs(chord), 0.35, cutoff=cutoff, amp=amp, attack=0.005, release=0.15)
            if progressive_hp_from is not None:
                cutoff_hp = sweep_value(t, hp_start_t, hp_end_t, progressive_hp_from, progressive_hp_to)
                note = dsp.butter_filter(note, cutoff_hp, "high", order=2)
            mix(note, t, duck_env)


HOOK_DEGREES = [0, 1, 2, 1, 3, 2, 1, 0]


def render_hook_lead(bar_start: int, bar_end: int, duck_env, amp=0.5):
    for bar in range(bar_start, bar_end + 1):
        bs = bar_time(bar)
        chord = chord_for_bar(bar)
        freqs = chord_freqs(chord)
        for i, deg in enumerate(HOOK_DEGREES):
            t = bs + i * 0.25
            f = freqs[deg % len(freqs)] * 2  # up an octave for lead presence
            note = inst.pluck(f, 0.22, cutoff_start=4500, cutoff_end=1200, amp=amp)
            mix(note, t, duck_env)


def render_arp_lead(bar_start: int, bar_end: int, duck_env, amp=0.42, cutoff=3600.0,
                      progressive_hp_from=None, progressive_hp_to=None,
                      hp_start_t=None, hp_end_t=None):
    for bar in range(bar_start, bar_end + 1):
        bs = bar_time(bar)
        chord = chord_for_bar(bar)
        freqs = chord_freqs(chord)
        pattern = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3]
        for slot, deg in enumerate(pattern):
            t = bs + slot * 0.125
            f = freqs[deg % len(freqs)] * 2
            note = inst.arp_pluck(f, 0.11, cutoff=cutoff, amp=amp, pos=(-0.3 if slot % 2 else 0.3))
            if progressive_hp_from is not None:
                cutoff_hp = sweep_value(t, hp_start_t, hp_end_t, progressive_hp_from, progressive_hp_to)
                note = dsp.butter_filter(note, cutoff_hp, "high", order=2)
            mix(note, t, duck_env)


def render_shaker(bar_start: int, bar_end: int, amp=0.28):
    for bar in range(bar_start, bar_end + 1):
        bs = bar_time(bar)
        for slot in range(0, 16, 2):
            t = bs + slot * 0.125
            mix(inst.hat(0.03, open_=False, amp=amp), t)


# ============================================================ 1. determine all kick times (for sidechain)

intro_kick_times = []
for bar in (3, 4):
    bs = bar_time(bar)
    for beat in range(4):
        intro_kick_times.append(bs + beat * BEAT)

dropA_kicks, dropA_claps, dropA_hc, dropA_ho = groove_pattern(5, 10)
montage_kicks, montage_claps, montage_hc, montage_ho = groove_pattern(11, 22)
build_kicks, build_claps, build_hc, build_ho = groove_pattern(23, 24, skip_last_16th_bar=24)
dropB_kicks, dropB_claps, dropB_hc, dropB_ho = groove_pattern(25, 27)

all_kick_times = (intro_kick_times + dropA_kicks + montage_kicks + build_kicks + dropB_kicks)

duck_env = dsp.sidechain_env(N_TOTAL, all_kick_times, duck_amount=0.72, attack=0.004, release=0.17)

# ============================================================ 2. INTRO (0.0 - 8.0)

mix(inst.sub_boom(1.5, amp=0.95), 0.0)
mix(inst.shimmer(2.2, amp=0.55), 0.0)

for bar in (1, 2, 3, 4):
    bs = bar_time(bar)
    chord = chord_for_bar(bar)
    attack = 2.5 if bar == 1 else 0.06
    pad = inst.chord_hit(chord_freqs(chord), 2.3, cutoff=1100, amp=0.42, attack=attack, release=0.6)
    mix(pad, bs, duck_env)

for t in (0.0, 2.0, 4.0, 6.0):
    tom = inst.kick(0.3, f_start=170, f_end=95, click_amt=0.15, amp=0.55)
    tom = dsp.butter_filter(tom, 900, "low", order=2)
    mix(tom, t)

# 16th arp, filter opens 400 -> 4000 Hz over 0-8s
for slot in range(64):
    t = slot * 0.125
    bar = int(t // BAR) + 1
    chord = chord_for_bar(bar)
    freqs = chord_freqs(chord)
    deg = [0, 1, 2, 3][slot % 4]
    f = freqs[deg]
    cutoff = sweep_value(t + 1e-3, 0.0 + 1e-3, 8.0, 400.0, 4000.0)
    note = inst.arp_pluck(f, 0.11, cutoff=cutoff, amp=0.4, pos=(-0.25 if slot % 2 else 0.25))
    mix(note, t, duck_env)

# low-passed four-on-the-floor kick, bars 3-4
for t in intro_kick_times:
    k = inst.kick(0.35, amp=0.85)
    k = dsp.butter_filter(k, 550, "low", order=2)
    mix(k, t)

mix(inst.riser(3.75, f_start=150, f_end=3500, amp=0.9), 4.0)
mix(inst.snare_roll(1.75, amp=0.9), 6.0)
mix(inst.reverse_cymbal(0.25, amp=0.75), 7.75)

# ============================================================ 3. DROP A (8.0 - 20.0)

mix(inst.impact(2.0, big=True, amp=1.0), 8.0)
render_groove_drums(dropA_kicks, dropA_claps, dropA_hc, dropA_ho)
render_pumping_bass(5, 10, duck_env, amp=0.9, cutoff=300)
render_chord_stabs_downbeat(5, 10, duck_env, amp=0.55, cutoff=3200)
render_hook_lead(5, 10, duck_env, amp=0.5)
mix(inst.crash(0.9, amp=0.65), 12.0)
mix(inst.crash(0.9, amp=0.65), 16.0)
mix(inst.drum_fill(0.5, amp=0.8), 19.5)

# ============================================================ 4. MONTAGE (20.0 - 44.0 main groove)

mix(inst.crash(1.3, amp=0.85), 20.0)
mix(inst.impact(1.0, big=False, amp=0.8), 20.0)
render_groove_drums(montage_kicks, montage_claps, montage_hc, montage_ho, kick_amp=0.95)
render_pumping_bass(11, 22, duck_env, amp=0.85, cutoff=280)
render_chord_stabs_offbeat(11, 22, duck_env, amp=0.42, cutoff=2200)
render_arp_lead(11, 22, duck_env, amp=0.4)
mix(inst.crash(1.2, amp=0.8), 28.0)
mix(inst.drum_fill(0.5, amp=0.8), 35.5)
mix(inst.crash(1.2, amp=0.8), 36.0)

# ---- BUILD (44.0 - 48.0), bars 23-24
render_groove_drums(build_kicks, build_claps, build_hc, build_ho, kick_amp=0.95)
render_pumping_bass(23, 24, duck_env, amp=0.85, cutoff=280,
                     progressive_hp_from=20.0, progressive_hp_to=1800.0, hp_start_t=44.0, hp_end_t=47.75)
render_chord_stabs_offbeat(23, 24, duck_env, amp=0.42, cutoff=2200,
                           progressive_hp_from=20.0, progressive_hp_to=1800.0, hp_start_t=44.0, hp_end_t=47.75)
render_arp_lead(23, 24, duck_env, amp=0.4,
                progressive_hp_from=20.0, progressive_hp_to=1800.0, hp_start_t=44.0, hp_end_t=47.75)
mix(inst.riser(3.75, f_start=150, f_end=3500, amp=0.9), 44.0)
mix(inst.snare_roll(1.75, amp=0.9), 46.0)
mix(inst.reverse_cymbal(0.25, amp=0.75), 47.75)
# hard-enforce the near-silence gap: zero the master's last 60ms before 48.0
gap_s = n_samples(47.94)
gap_e = n_samples(48.0)
master[gap_s:gap_e] *= np.linspace(1, 0, gap_e - gap_s)[:, None] ** 2

# ============================================================ 5. DROP B (48.0 - 54.0)

mix(inst.impact(2.0, big=True, amp=1.05), 48.0)
render_groove_drums(dropB_kicks, dropB_claps, dropB_hc, dropB_ho, kick_amp=1.05, clap_amp=0.95)
render_pumping_bass(25, 27, duck_env, amp=0.95, cutoff=320)
render_chord_stabs_downbeat(25, 27, duck_env, amp=0.62, cutoff=3800, dur=1.9)
render_hook_lead(25, 27, duck_env, amp=0.55)
render_shaker(25, 27, amp=0.28)

# ============================================================ 6. OUTRO (54.0 - 60.0)

outro_chord = PROGRESSION[0]  # resolve home to Fm(add9)
final_pad = inst.chord_hit(chord_freqs(outro_chord), 5.6, cutoff=1600, amp=0.65, attack=0.02, release=4.5)
ir = dsp.synth_ir(2.5, tau=0.9, seed=777)
final_pad = dsp.convolve_reverb(final_pad, ir, mix=0.4)
mix(final_pad, 54.0)
mix(inst.impact(2.0, big=True, amp=0.95), 54.0)
mix(inst.crash(1.6, amp=0.85), 54.0)
mix(inst.sparkle(2.0, amp=0.6), 56.0)

# explicit fade-out to digital silence by 59.9s
fade_start_t = 56.5
fs = n_samples(fade_start_t)
fe = n_samples(59.9)
fade_curve = np.ones(N_TOTAL)
fade_curve[fs:fe] = np.linspace(1.0, 0.0, fe - fs) ** 1.5
fade_curve[fe:] = 0.0
master *= fade_curve[:, None]

# ============================================================ 7. bus processing

master = dsp.remove_dc(master)
master = dsp.soft_clip(master, drive=1.15)
master = dsp.limiter(master, ceiling_db=-1.2)


def measure_loudness(x: np.ndarray) -> tuple[float, float]:
    tmp = HERE / "_measure_tmp.wav"
    write_wav(tmp, x)
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(tmp), "-af", "ebur128=peak=true", "-f", "null", "-"],
        capture_output=True, text=True,
    )
    err = proc.stderr
    lufs, tp = None, None
    for line in err.splitlines():
        line = line.strip()
        if line.startswith("I:") and "LUFS" in line:
            lufs = float(line.split()[1])
        if line.startswith("Peak:"):
            pass
        if "Peak:" in line and tp is None and line.strip().startswith("Peak"):
            try:
                tp = float(line.split()[1])
            except (ValueError, IndexError):
                pass
    tmp.unlink(missing_ok=True)
    return lufs, tp


def write_wav(path: Path, x: np.ndarray) -> None:
    x = np.clip(x, -1.0, 1.0)
    ints = (x * 32767.0).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(ints.tobytes())


TARGET_LUFS = -14.0
for _ in range(4):
    lufs, _ = measure_loudness(master)
    if lufs is None:
        break
    diff = TARGET_LUFS - lufs
    if abs(diff) < 0.15:
        break
    master = master * dsp.db_to_amp(diff)
    master = dsp.limiter(master, ceiling_db=-1.2)

MUSIC_PATH = AUDIO_DIR / "music.wav"
write_wav(MUSIC_PATH, master)
final_lufs, _ = measure_loudness(master)

# ============================================================ 8. SFX one-shots

SFX_SPECS = []


def make_sfx(name: str, seconds_target: float, gen_fn, **kwargs):
    audio = gen_fn(seconds_target, **kwargs)
    audio = dsp.to_stereo(audio)
    peak = np.max(np.abs(audio)) or 1e-9
    audio = audio * (dsp.db_to_amp(-3.0) / peak)
    peak_idx = int(np.argmax(np.max(np.abs(audio), axis=1)))
    peak_time = peak_idx / SR
    path = SFX_DIR / f"{name}.wav"
    write_wav(path, audio)
    SFX_SPECS.append({
        "name": f"{name}.wav",
        "durationSeconds": round(audio.shape[0] / SR, 4),
        "peakTimeSeconds": round(peak_time, 4),
    })


make_sfx("whoosh_in", 0.6, inst.swoosh, f_start=500, f_end=4500, peak_frac=0.45 / 0.6)
make_sfx("whoosh_out", 0.5, inst.swoosh, f_start=3500, f_end=500, peak_frac=0.06)
make_sfx("swoosh_short", 0.25, inst.swoosh, f_start=1500, f_end=6000, peak_frac=0.4)
make_sfx("impact_big", 2.0, inst.impact, big=True)
make_sfx("impact_small", 1.0, inst.impact, big=False)
make_sfx("pop", 0.15, inst.pop, f_start=500, f_end=1500)
make_sfx("pop2", 0.15, inst.pop, f_start=560, f_end=1650)
make_sfx("pop3", 0.15, inst.pop, f_start=470, f_end=1380)
make_sfx("click", 0.05, inst.click_sound)
make_sfx("tick1", 0.03, inst.tick, freq=2600)
make_sfx("tick2", 0.03, inst.tick, freq=3000)
make_sfx("tick3", 0.03, inst.tick, freq=3400)
make_sfx("tick4", 0.03, inst.tick, freq=3800)
make_sfx("sparkle", 1.2, inst.sparkle)
make_sfx("success", 0.6, inst.success_chime)
make_sfx("glitch", 0.3, inst.glitch)
make_sfx("riser_short", 1.0, inst.riser, f_start=300, f_end=4200)
make_sfx("swipe", 0.35, inst.swoosh, f_start=1000, f_end=5000, peak_frac=0.45)
make_sfx("toggle", 0.12, inst.toggle_sound)
make_sfx("bass_drop", 1.5, inst.bass_drop_sfx)
make_sfx("data_blips", 0.8, inst.data_blips)

# ============================================================ 9. manifest

manifest = {
    "bpm": BPM,
    "bars": N_BARS,
    "sampleRate": SR,
    "totalSeconds": TOTAL_SECONDS,
    "hitPoints": {
        "introStart": 0.0,
        "bar3KickIn": 4.0,
        "riserIntro": [4.0, 7.75],
        "snareRollIntro": [6.0, 7.75],
        "dropGapIntro": [7.75, 8.0],
        "dropA": 8.0,
        "dropAAccents": [10.0, 12.0, 14.0, 16.0, 18.0],
        "dropAFill": [19.5, 20.0],
        "montage": 20.0,
        "montageCrashes": [28.0, 36.0],
        "montageFill": [35.5, 36.0],
        "buildStart": 44.0,
        "riserBuild": [44.0, 47.75],
        "snareRollBuild": [46.0, 47.75],
        "dropGapBuild": [47.75, 48.0],
        "dropB": 48.0,
        "outroStart": 54.0,
        "outroSparkle": 56.0,
        "silenceBy": 59.9,
    },
    "sfx": SFX_SPECS,
}
with open(AUDIO_DIR / "manifest.json", "w") as f:
    json.dump(manifest, f, indent=2)

print(f"music.wav written: {MUSIC_PATH}, samples={master.shape[0]}, measured LUFS={final_lufs}")
print(f"kick events placed: {len(all_kick_times)}")
print("SFX written:", [s['name'] for s in SFX_SPECS])
