"""Instrument / one-shot renderers built from dsp.py primitives.

Every function returns a stereo (n, 2) float array, roughly peak-normalised
to ~1.0 before the caller applies its own gain / envelope / bus processing.
"""
from __future__ import annotations

import numpy as np
import dsp
from dsp import SR, n_samples, t_axis, pan, to_stereo, sine, additive_saw, additive_square

_seed_counter = [1000]


def _next_seed() -> int:
    _seed_counter[0] += 1
    return _seed_counter[0]


# ---------------------------------------------------------------- drums

def kick(seconds: float = 0.4, f_start: float = 150.0, f_end: float = 44.0,
          click_amt: float = 0.35, amp: float = 1.0) -> np.ndarray:
    n = n_samples(seconds)
    pitch_env = dsp.expramp(seconds, f_start, f_end)
    body = sine(pitch_env)
    amp_env = dsp.perc_env(seconds, attack=0.001, decay_tau=0.09)
    body *= amp_env
    # click transient: short burst of highpassed noise at onset
    click_len = 0.006
    click = dsp.white_noise(click_len, seed=_next_seed())
    click = dsp.butter_filter(click, 3000, "high", order=2)
    click *= np.linspace(1, 0, click.shape[0]) ** 0.5
    click_full = np.zeros(n)
    cl = min(click.shape[0], n)
    click_full[:cl] = click[:cl]
    out = body + click_amt * click_full
    out = dsp.soft_clip(out, drive=1.3)
    out = dsp.fade_edges(out, 16)
    return to_stereo(out) * amp


def clap(seconds: float = 0.22, amp: float = 1.0) -> np.ndarray:
    n = n_samples(seconds)
    out = np.zeros((n, 2))
    burst_starts = [0.0, 0.009, 0.018, 0.028]
    for i, bs in enumerate(burst_starts):
        s = n_samples(bs)
        if s >= n:
            continue
        dur = min(0.03, seconds - bs)
        burst = dsp.stereo_noise(dur, seed=_next_seed())
        burst = dsp.butter_filter(burst, 1500, "high", order=2)
        burst = dsp.butter_filter(burst, 5000, "low", order=2)
        env = dsp.perc_env(dur, attack=0.0005, decay_tau=0.012)
        burst *= env[:, None]
        e = min(s + burst.shape[0], n)
        out[s:e] += burst[: e - s] * (0.7 if i < len(burst_starts) - 1 else 1.0)
    # tail
    tail = dsp.stereo_noise(seconds, seed=_next_seed())
    tail = dsp.butter_filter(tail, 1200, "high", order=2)
    tail = dsp.butter_filter(tail, 4000, "low", order=2)
    tail *= dsp.perc_env(seconds, attack=0.015, decay_tau=0.06)[:, None]
    out += tail * 0.6
    out = dsp.fade_edges(out, 16)
    return out * amp


def snare(seconds: float = 0.25, amp: float = 1.0) -> np.ndarray:
    n = n_samples(seconds)
    body = sine(190.0, seconds) * dsp.perc_env(seconds, 0.001, 0.045)
    noise = dsp.stereo_noise(seconds, seed=_next_seed())
    noise = dsp.butter_filter(noise, 2000, "high", order=2)
    noise *= dsp.perc_env(seconds, 0.001, 0.09)[:, None]
    out = to_stereo(body) * 0.5 + noise * 0.9
    out = dsp.fade_edges(out, 16)
    return out * amp


def hat(seconds: float = 0.05, open_: bool = False, amp: float = 1.0) -> np.ndarray:
    n = n_samples(seconds)
    x = dsp.stereo_noise(seconds, seed=_next_seed())
    x = dsp.butter_filter(x, 7500, "high", order=3)
    tau = 0.12 if open_ else 0.02
    x *= dsp.perc_env(seconds, 0.0005, tau)[:, None]
    x = dsp.fade_edges(x, 12)
    return x * amp


def crash(seconds: float = 1.6, amp: float = 1.0, bright: float = 6000.0) -> np.ndarray:
    x = dsp.stereo_noise(seconds, seed=_next_seed())
    x = dsp.butter_filter(x, bright, "high", order=2)
    x *= dsp.perc_env(seconds, 0.002, 0.55)[:, None]
    ir = dsp.synth_ir(1.2, tau=0.35, seed=_next_seed())
    x = dsp.convolve_reverb(x, ir, mix=0.35)[:n_samples(seconds)]
    x = dsp.fade_edges(x, 32)
    return x * amp


def reverse_cymbal(seconds: float = 1.5, amp: float = 1.0) -> np.ndarray:
    """Noise swelling UP in volume, so its peak lands at the end of the buffer."""
    x = dsp.stereo_noise(seconds, seed=_next_seed())
    x = dsp.butter_filter(x, 4000, "high", order=2)
    n = x.shape[0]
    env = np.linspace(0, 1, n) ** 2.2
    x *= env[:, None]
    x = dsp.fade_edges(x, 24)
    return x * amp


def drum_fill(seconds: float = 0.5, n_hits: int = 6, amp: float = 1.0) -> np.ndarray:
    """Quick descending tom/snare fill."""
    n = n_samples(seconds)
    out = np.zeros((n, 2))
    hit_dur = seconds / n_hits
    freqs = np.linspace(280, 140, n_hits)
    for i in range(n_hits):
        s = n_samples(i * hit_dur)
        tom_env = dsp.perc_env(hit_dur * 1.3, 0.001, 0.05)
        tom = sine(freqs[i], hit_dur * 1.3) * tom_env
        noise = dsp.white_noise(hit_dur * 1.3, seed=_next_seed()) * 0.3
        noise = dsp.butter_filter(noise, 2500, "high", order=2) * tom_env
        h = to_stereo(tom * 0.8 + noise)
        e = min(s + h.shape[0], n)
        out[s:e] += h[: e - s]
    return dsp.fade_edges(out, 16) * amp


def snare_roll(total_seconds: float, amp: float = 1.0) -> np.ndarray:
    """Accelerating snare roll: 8ths -> 16ths -> 32nds, rising volume."""
    n = n_samples(total_seconds)
    out = np.zeros((n, 2))
    stages = [
        (0.0, total_seconds * 0.4, 0.25),
        (total_seconds * 0.4, total_seconds * 0.75, 0.125),
        (total_seconds * 0.75, total_seconds, 0.0625),
    ]
    t = 0.0
    idx = 0
    total_hits = 0
    hit_times = []
    for s0, s1, step in stages:
        t = s0
        while t < s1 - 1e-9:
            hit_times.append(t)
            t += step
    n_hits = len(hit_times)
    for i, ht in enumerate(hit_times):
        vel = 0.35 + 0.65 * (i / max(n_hits - 1, 1))
        s = n_samples(ht)
        h = snare(0.09, amp=vel)
        e = min(s + h.shape[0], n)
        out[s:e] += h[: e - s]
    return out * amp


# ---------------------------------------------------------------- bass / chords / leads

def bass_note(freq: float, seconds: float, cutoff: float = 260.0, amp: float = 1.0) -> np.ndarray:
    x = additive_saw(freq, seconds) * 0.6 + additive_saw(freq * 1.005, seconds, phase=0.3) * 0.4
    env = dsp.adsr(seconds, a=0.004, d=0.08, s=0.85, r=0.05)
    x *= env
    x = dsp.butter_filter(x, cutoff, "low", order=2)
    x = dsp.fade_edges(x, 24)
    return to_stereo(x) * amp


def chord_hit(freqs: list[float], seconds: float, cutoff: float = 3500.0, amp: float = 1.0,
              attack: float = 0.01, release: float = 0.25, stereo_spread: float = 0.85) -> np.ndarray:
    n = n_samples(seconds)
    out = np.zeros((n, 2))
    for f in freqs:
        v = dsp.supersaw(f, seconds, voices=7, detune_cents=16.0, spread=stereo_spread)
        out += v / len(freqs)
    env = dsp.adsr(seconds, a=attack, d=0.15, s=0.75, r=release)
    out *= env[:, None]
    out = dsp.butter_filter(out, cutoff, "low", order=2)
    out = dsp.fade_edges(out, 32)
    return out * amp


def pluck(freq: float, seconds: float = 0.3, cutoff_start: float = 3000.0, cutoff_end: float = 400.0,
           amp: float = 1.0, pos: float = 0.0) -> np.ndarray:
    x = additive_saw(freq, seconds) * 0.6 + additive_square(freq * 2, seconds) * 0.15
    env = dsp.perc_env(seconds, attack=0.002, decay_tau=seconds * 0.35)
    x *= env
    cutoff_env = dsp.expramp(seconds, cutoff_start, cutoff_end)
    x = dsp.time_varying_lowpass(x, cutoff_env, order=2, block=48)
    x = dsp.fade_edges(x, 20)
    return pan(x, pos) * amp


def arp_pluck(freq: float, seconds: float, cutoff: float, amp: float = 1.0, pos: float = 0.0) -> np.ndarray:
    """Pluck with a fixed (already-swept, per-note) cutoff -- used inside the opening filter sweep."""
    x = additive_saw(freq, seconds) * 0.7
    env = dsp.perc_env(seconds, attack=0.002, decay_tau=seconds * 0.4)
    x *= env
    x = dsp.butter_filter(x, max(cutoff, 60.0), "low", order=2)
    x = dsp.fade_edges(x, 16)
    return pan(x, pos) * amp


# ---------------------------------------------------------------- fx / impacts

def sub_boom(seconds: float = 1.5, f_start: float = 90.0, f_end: float = 32.0, amp: float = 1.0) -> np.ndarray:
    pitch_env = dsp.expramp(seconds, f_start, f_end)
    x = sine(pitch_env) * dsp.exp_decay(seconds, tau=seconds * 0.45)
    x = dsp.fade_edges(x, 64)
    return to_stereo(x) * amp


def shimmer(seconds: float = 2.0, amp: float = 1.0) -> np.ndarray:
    x = dsp.stereo_noise(seconds, seed=_next_seed())
    x = dsp.butter_filter(x, 9000, "high", order=3)
    env = dsp.adsr(seconds, a=seconds * 0.3, d=0.1, s=0.6, r=seconds * 0.5)
    x *= env[:, None]
    ir = dsp.synth_ir(1.5, tau=0.6, seed=_next_seed())
    x = dsp.convolve_reverb(x, ir, mix=0.4)[:n_samples(seconds)]
    return dsp.fade_edges(x, 64) * amp


def impact(seconds: float = 2.0, big: bool = True, amp: float = 1.0) -> np.ndarray:
    boom = sub_boom(seconds, f_start=110 if big else 90, f_end=30 if big else 40, amp=1.0)
    crack = dsp.stereo_noise(min(0.05, seconds), seed=_next_seed())
    crack = dsp.butter_filter(crack, 800, "high", order=2)
    crack *= dsp.perc_env(min(0.05, seconds), 0.0005, 0.015)[:, None]
    n = n_samples(seconds)
    crack_full = np.zeros((n, 2))
    cl = min(crack.shape[0], n)
    crack_full[:cl] = crack[:cl]
    crash_layer = crash(seconds, amp=1.0 if big else 0.6, bright=4500)
    mid = dsp.stereo_noise(seconds * 0.6, seed=_next_seed())
    mid = dsp.butter_filter(mid, 200, "high", order=2)
    mid = dsp.butter_filter(mid, 1800, "low", order=2)
    mid *= dsp.perc_env(seconds * 0.6, 0.001, 0.12)[:, None]
    mid_full = np.zeros((n, 2))
    ml = min(mid.shape[0], n)
    mid_full[:ml] = mid[:ml]
    out = boom * (1.0 if big else 0.7) + crack_full * 0.8 + crash_layer[:n] * (0.9 if big else 0.5) + mid_full * 0.6
    out = dsp.soft_clip(out, drive=1.1)
    out = dsp.fade_edges(out, 32)
    return out * amp


def riser(seconds: float, f_start: float = 200.0, f_end: float = 3000.0, amp: float = 1.0) -> np.ndarray:
    noise = dsp.stereo_noise(seconds, seed=_next_seed())
    cutoff_env = dsp.expramp(seconds, f_start, f_end)
    noise = dsp.time_varying_highpass(noise, cutoff_env, order=2, block=96)
    pitch = sine(dsp.expramp(seconds, f_start * 0.5, f_end * 0.5))
    amp_env = dsp.linramp(seconds, 0.05, 1.0) ** 1.5
    out = (noise * 0.8 + to_stereo(pitch) * 0.35) * amp_env[:, None]
    out = dsp.fade_edges(out, 32)
    return out * amp


def sparkle(seconds: float = 1.2, root_freqs: list[float] | None = None, amp: float = 1.0) -> np.ndarray:
    if root_freqs is None:
        root_freqs = [dsp.note_to_freq(n) for n in ["F5", "Ab5", "C6", "Eb6", "F6"]]
    n = n_samples(seconds)
    out = np.zeros((n, 2))
    rng = np.random.default_rng(_next_seed())
    n_notes = 9
    for i in range(n_notes):
        f = float(rng.choice(root_freqs)) * float(rng.choice([1.0, 2.0]))
        start = rng.uniform(0, seconds * 0.55)
        dur = seconds - start
        s = n_samples(start)
        tone = sine(f, dur) * 0.5 + sine(f * 2.01, dur) * 0.2
        env = dsp.perc_env(dur, attack=0.005, decay_tau=dur * 0.4)
        tone *= env
        pos = float(rng.uniform(-0.8, 0.8))
        h = pan(tone, pos)
        e = min(s + h.shape[0], n)
        out[s:e] += h[: e - s] / np.sqrt(n_notes)
    ir = dsp.synth_ir(1.0, tau=0.5, seed=_next_seed())
    out = dsp.convolve_reverb(out, ir, mix=0.35)[:n]
    return dsp.fade_edges(out, 32) * amp


def success_chime(seconds: float = 0.6, amp: float = 1.0) -> np.ndarray:
    f1, f2 = dsp.note_to_freq("F5"), dsp.note_to_freq("C6")
    d1 = seconds * 0.42
    d2 = seconds - d1
    n1 = sine(f1, d1) * dsp.perc_env(d1, 0.004, d1 * 0.5)
    n2 = sine(f2, d2) * dsp.perc_env(d2, 0.004, d2 * 0.6)
    out = np.concatenate([n1, n2])
    out = to_stereo(out)
    out = dsp.fade_edges(out, 24)
    return out * amp


def pop(seconds: float = 0.15, f_start: float = 500.0, f_end: float = 1500.0, amp: float = 1.0) -> np.ndarray:
    pitch_env = dsp.expramp(seconds, f_start, f_end)
    x = sine(pitch_env) * dsp.perc_env(seconds, 0.002, seconds * 0.3)
    x = dsp.fade_edges(x, 16)
    return to_stereo(x) * amp


def click_sound(seconds: float = 0.05, amp: float = 1.0) -> np.ndarray:
    x = dsp.white_noise(seconds, seed=_next_seed())
    x = dsp.butter_filter(x, 2500, "high", order=3)
    x *= dsp.perc_env(seconds, 0.0003, seconds * 0.15)
    x = dsp.fade_edges(x, 8)
    return to_stereo(x) * amp


def tick(seconds: float = 0.03, freq: float = 3000.0, amp: float = 1.0) -> np.ndarray:
    x = dsp.white_noise(seconds, seed=_next_seed()) * 0.5
    x = dsp.butter_filter(x, freq, "high", order=3)
    x += sine(freq, seconds) * 0.3
    x *= dsp.perc_env(seconds, 0.0002, seconds * 0.2)
    x = dsp.fade_edges(x, 6)
    return to_stereo(x) * amp


def glitch(seconds: float = 0.3, amp: float = 1.0) -> np.ndarray:
    n = n_samples(seconds)
    rng = np.random.default_rng(_next_seed())
    seg_len = n_samples(0.02)
    out = np.zeros(n)
    pos = 0
    base_freq = 400.0
    while pos < n:
        seg_n = min(seg_len, n - pos)
        f = base_freq * rng.choice([1, 2, 3, 0.5])
        seg = additive_square(f, seg_n / SR)
        # bit-crush: quantize
        levels = 10
        seg = np.round(seg * levels) / levels
        out[pos:pos + seg_n] = seg[:seg_n]
        pos += seg_n
    out *= dsp.perc_env(seconds, 0.001, seconds * 0.5)
    out = dsp.fade_edges(out, 12)
    return to_stereo(out) * amp


def swoosh(seconds: float = 0.25, f_start: float = 800.0, f_end: float = 3500.0, amp: float = 1.0,
            peak_frac: float = 0.5) -> np.ndarray:
    n = n_samples(seconds)
    x = dsp.stereo_noise(seconds, seed=_next_seed())
    cutoff_env = dsp.expramp(seconds, f_start, f_end)
    x = dsp.time_varying_highpass(x, cutoff_env, order=2, block=32)
    peak_n = int(n * peak_frac)
    env = np.concatenate([
        np.linspace(0, 1, max(peak_n, 1)) ** 1.5,
        np.linspace(1, 0, max(n - peak_n, 1)) ** 1.2,
    ])[:n]
    x *= env[:, None]
    x = dsp.fade_edges(x, 16)
    return x * amp


def toggle_sound(seconds: float = 0.12, amp: float = 1.0) -> np.ndarray:
    f_env = np.concatenate([
        dsp.expramp(seconds * 0.4, 600, 1200),
        dsp.expramp(seconds * 0.6, 1200, 900),
    ])
    x = sine(f_env) * dsp.perc_env(seconds, 0.001, seconds * 0.25)
    x = dsp.fade_edges(x, 8)
    return to_stereo(x) * amp


def bass_drop_sfx(seconds: float = 1.5, amp: float = 1.0) -> np.ndarray:
    pitch_env = dsp.expramp(seconds, 220.0, 35.0)
    x = sine(pitch_env) * dsp.exp_decay(seconds, tau=seconds * 0.4)
    x = dsp.soft_clip(x, 1.4)
    x = dsp.fade_edges(x, 48)
    return to_stereo(x) * amp


def data_blips(seconds: float = 0.8, amp: float = 1.0) -> np.ndarray:
    n = n_samples(seconds)
    out = np.zeros(n)
    rng = np.random.default_rng(_next_seed())
    t = 0.0
    while t < seconds - 0.02:
        dur = rng.uniform(0.02, 0.05)
        f = rng.uniform(600, 2600)
        s = n_samples(t)
        blip = sine(f, dur) * dsp.perc_env(dur, 0.001, dur * 0.3)
        e = min(s + blip.shape[0], n)
        out[s:e] += blip[: e - s] * 0.8
        t += dur + rng.uniform(0.005, 0.02)
    out = dsp.fade_edges(out, 16)
    return to_stereo(out) * amp
