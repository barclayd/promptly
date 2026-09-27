"""Low-level DSP primitives: oscillators, envelopes, filters, noise, reverb, delay, limiter.

Everything works in float64, mono or stereo (shape (n,) or (n,2)). Rendered to
int16 only at the very end by compose.py.
"""
from __future__ import annotations

import numpy as np
from scipy.signal import butter, lfilter, lfilter_zi, fftconvolve

SR = 48000

# ---------------------------------------------------------------- utilities

def db_to_amp(db: float) -> float:
    return 10.0 ** (db / 20.0)


def amp_to_db(a: float) -> float:
    return 20.0 * np.log10(max(a, 1e-12))


def n_samples(seconds: float) -> int:
    return int(round(seconds * SR))


def t_axis(seconds: float) -> np.ndarray:
    return np.arange(n_samples(seconds)) / SR


def to_stereo(x: np.ndarray) -> np.ndarray:
    """Mono (n,) -> stereo (n,2). Stereo passes through untouched."""
    if x.ndim == 1:
        return np.stack([x, x], axis=1)
    return x


def pan(x: np.ndarray, pos: float) -> np.ndarray:
    """Equal-power pan a mono signal. pos in [-1, 1]."""
    theta = (pos + 1.0) * np.pi / 4.0
    left = x * np.cos(theta)
    right = x * np.sin(theta)
    return np.stack([left, right], axis=1)


def fade_edges(x: np.ndarray, fade_samples: int = 32) -> np.ndarray:
    """Short raised-cosine in/out fade to avoid clicks at boundaries."""
    n = x.shape[0]
    f = min(fade_samples, n // 2) if n > 1 else 0
    if f <= 0:
        return x
    win = np.ones(n)
    ramp = 0.5 * (1 - np.cos(np.linspace(0, np.pi, f)))
    win[:f] *= ramp
    win[-f:] *= ramp[::-1]
    if x.ndim == 2:
        win = win[:, None]
    return x * win


def mix_at(master: np.ndarray, event: np.ndarray, start_sample: int) -> None:
    """Add `event` (mono or stereo) into `master` (stereo) in place, clipped to bounds."""
    event = to_stereo(event)
    n = event.shape[0]
    end = start_sample + n
    m_start = max(start_sample, 0)
    m_end = min(end, master.shape[0])
    if m_end <= m_start:
        return
    e_start = m_start - start_sample
    e_end = e_start + (m_end - m_start)
    master[m_start:m_end] += event[e_start:e_end]


# ---------------------------------------------------------------- envelopes

def adsr(seconds: float, a: float, d: float, s: float, r: float, curve: float = 2.0) -> np.ndarray:
    """ADSR envelope, `seconds` total length. s = sustain level (0-1)."""
    n = n_samples(seconds)
    env = np.zeros(n)
    na = n_samples(a)
    nd = n_samples(d)
    nr = n_samples(r)
    na = min(na, n)
    nd = min(nd, max(n - na, 0))
    nr = min(nr, n)
    sustain_end = max(n - nr, na + nd)
    if na > 0:
        env[:na] = np.linspace(0, 1, na) ** (1.0 / curve)
    if nd > 0:
        env[na:na + nd] = np.linspace(1, s, nd)
    if sustain_end > na + nd:
        env[na + nd:sustain_end] = s
    if nr > 0 and sustain_end < n:
        start_level = env[sustain_end - 1] if sustain_end > 0 else s
        env[sustain_end:] = np.linspace(start_level, 0, n - sustain_end)
    return env


def exp_decay(seconds: float, tau: float, start: float = 1.0) -> np.ndarray:
    t = t_axis(seconds)
    return start * np.exp(-t / tau)


def perc_env(seconds: float, attack: float, decay_tau: float) -> np.ndarray:
    """Fast-attack, exponential-decay percussion envelope."""
    n = n_samples(seconds)
    na = max(1, n_samples(attack))
    env = np.zeros(n)
    na = min(na, n)
    env[:na] = np.linspace(0, 1, na) ** 0.5
    if n > na:
        t = np.arange(n - na) / SR
        env[na:] = np.exp(-t / decay_tau)
    return env


def linramp(seconds: float, start: float, end: float) -> np.ndarray:
    return np.linspace(start, end, n_samples(seconds))


def expramp(seconds: float, start: float, end: float) -> np.ndarray:
    n = n_samples(seconds)
    start = max(start, 1e-6)
    end = max(end, 1e-6)
    return start * (end / start) ** np.linspace(0, 1, n)


# ---------------------------------------------------------------- oscillators (band-limited additive)

def note_to_freq(note: str) -> float:
    """e.g. 'F3', 'Db2', 'C#4' -> Hz (A4 = 440)."""
    names = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
    i = 0
    letter = note[i]; i += 1
    semis = names[letter]
    while i < len(note) and note[i] in "#b":
        semis += 1 if note[i] == "#" else -1
        i += 1
    octave = int(note[i:])
    midi = (octave + 1) * 12 + semis
    return 440.0 * 2.0 ** ((midi - 69) / 12.0)


def additive_saw(freq: float, seconds: float, phase: float = 0.0, nyq_guard: float = 0.9) -> np.ndarray:
    """Band-limited sawtooth via additive synthesis (sum of harmonics, 1/k amplitude)."""
    t = t_axis(seconds)
    max_h = int((SR * nyq_guard / 2.0) / max(freq, 1.0))
    max_h = max(1, min(max_h, 60))
    out = np.zeros_like(t)
    for k in range(1, max_h + 1):
        out += ((-1) ** (k + 1)) * np.sin(2 * np.pi * freq * k * t + phase) / k
    return out * (2.0 / np.pi)


def additive_square(freq: float, seconds: float, phase: float = 0.0, nyq_guard: float = 0.9) -> np.ndarray:
    t = t_axis(seconds)
    max_h = int((SR * nyq_guard / 2.0) / max(freq, 1.0))
    max_h = max(1, min(max_h, 60))
    out = np.zeros_like(t)
    for k in range(1, max_h + 1, 2):
        out += np.sin(2 * np.pi * freq * k * t + phase) / k
    return out * (4.0 / np.pi)


def sine(freq_or_array, seconds: float | None = None, phase: float = 0.0) -> np.ndarray:
    """Sine wave. Either sine(freq, seconds) for constant freq, or sine(freq_array)
    for a time-varying instantaneous frequency (integrates the array)."""
    if np.isscalar(freq_or_array):
        t = t_axis(seconds)
        return np.sin(2 * np.pi * freq_or_array * t + phase)
    freq_array = np.asarray(freq_or_array)
    ph = 2 * np.pi * np.cumsum(freq_array) / SR + phase
    return np.sin(ph)


def supersaw(freq: float, seconds: float, voices: int = 7, detune_cents: float = 18.0,
             spread: float = 0.9) -> np.ndarray:
    """7-voice detuned supersaw, returned as stereo (n,2), unity-ish peak."""
    n = n_samples(seconds)
    out = np.zeros((n, 2))
    half = (voices - 1) / 2.0
    rng = np.random.default_rng(int(freq * 1000) % (2 ** 31))
    for v in range(voices):
        offset = (v - half) / max(half, 1) if voices > 1 else 0.0
        cents = offset * detune_cents
        f = freq * (2.0 ** (cents / 1200.0))
        phase = rng.uniform(0, 2 * np.pi)
        voice = additive_saw(f, seconds, phase=phase)
        pos = offset * spread
        out += pan(voice, pos) / voices
    return out


# ---------------------------------------------------------------- noise

def white_noise(seconds: float, seed: int = 0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    return rng.uniform(-1.0, 1.0, n_samples(seconds))


def stereo_noise(seconds: float, seed: int = 0) -> np.ndarray:
    l = white_noise(seconds, seed=seed * 2 + 1)
    r = white_noise(seconds, seed=seed * 2 + 2)
    return np.stack([l, r], axis=1)


# ---------------------------------------------------------------- filters

def butter_filter(x: np.ndarray, cutoff: float, kind: str = "low", order: int = 2, q: float | None = None) -> np.ndarray:
    """Static-coefficient Butterworth filter, vectorised (fast path)."""
    nyq = SR / 2.0
    wn = min(max(cutoff / nyq, 1e-4), 0.999)
    b, a = butter(order, wn, btype=kind)
    if x.ndim == 2:
        return np.stack([lfilter(b, a, x[:, ch]) for ch in range(x.shape[1])], axis=1)
    return lfilter(b, a, x)


def time_varying_lowpass(x: np.ndarray, cutoff_hz: np.ndarray, order: int = 2, block: int = 64) -> np.ndarray:
    """Chunked time-varying Butterworth lowpass: recompute coeffs every `block`
    samples from the cutoff envelope, carrying filter state (zi) across chunks."""
    return _time_varying(x, cutoff_hz, "low", order, block)


def time_varying_highpass(x: np.ndarray, cutoff_hz: np.ndarray, order: int = 2, block: int = 64) -> np.ndarray:
    return _time_varying(x, cutoff_hz, "high", order, block)


def _time_varying(x: np.ndarray, cutoff_hz: np.ndarray, kind: str, order: int, block: int) -> np.ndarray:
    n = x.shape[0]
    is_stereo = x.ndim == 2
    ch = x.shape[1] if is_stereo else 1
    xin = x if is_stereo else x[:, None]
    out = np.zeros_like(xin)
    nyq = SR / 2.0
    zi = [None] * ch
    for start in range(0, n, block):
        end = min(start + block, n)
        cutoff = float(np.clip(np.mean(cutoff_hz[start:end]), 20.0, nyq * 0.99))
        wn = cutoff / nyq
        b, a = butter(order, wn, btype=kind)
        for c in range(ch):
            if zi[c] is None:
                zi[c] = lfilter_zi(b, a) * xin[start, c]
            seg, zi[c] = lfilter(b, a, xin[start:end, c], zi=zi[c])
            out[start:end, c] = seg
    return out if is_stereo else out[:, 0]


def bandpass_noise(seconds: float, low: float, high: float, seed: int = 0, order: int = 2) -> np.ndarray:
    x = stereo_noise(seconds, seed=seed)
    x = butter_filter(x, high, "low", order=order)
    x = butter_filter(x, low, "high", order=order)
    return x


# ---------------------------------------------------------------- reverb & delay

def synth_ir(seconds: float, tau: float, seed: int = 1, hf_damp: float = 6000.0) -> np.ndarray:
    """Synthetic exponentially-decaying stereo noise impulse response."""
    n = stereo_noise(seconds, seed=seed)
    env = np.exp(-t_axis(seconds) / tau)[:, None]
    ir = n * env
    ir = butter_filter(ir, hf_damp, "low", order=1)
    ir[0] = [1.0, 1.0]  # dry spike so convolution preserves the direct sound's transient timing
    return ir


def convolve_reverb(x: np.ndarray, ir: np.ndarray, mix: float = 0.3) -> np.ndarray:
    x = to_stereo(x)
    wet = np.stack([
        fftconvolve(x[:, 0], ir[:, 0], mode="full"),
        fftconvolve(x[:, 1], ir[:, 1], mode="full"),
    ], axis=1)
    n = x.shape[0]
    dry_padded = np.zeros_like(wet)
    dry_padded[:n] = x
    peak = np.max(np.abs(wet)) or 1.0
    wet = wet / peak * np.max(np.abs(x) + 1e-9)
    return dry_padded * (1 - mix) + wet * mix


def tempo_delay(x: np.ndarray, delay_seconds: float, feedback: float = 0.35, mix: float = 0.28,
                 ping_pong: bool = True, taps: int = 4) -> np.ndarray:
    x = to_stereo(x)
    n = x.shape[0]
    d = n_samples(delay_seconds)
    out = np.zeros((n + d * taps, 2))
    out[:n] = x
    gain = feedback
    for i in range(1, taps + 1):
        offset = d * i
        end = min(n + offset, out.shape[0])
        seg = x[:max(0, end - offset)] * (gain ** i)
        if ping_pong and i % 2 == 1:
            seg = seg[:, ::-1]
        out[offset:offset + seg.shape[0]] += seg
    dry = np.zeros_like(out)
    dry[:n] = x
    return dry * (1 - mix) + out * mix


# ---------------------------------------------------------------- dynamics

def soft_clip(x: np.ndarray, drive: float = 1.0) -> np.ndarray:
    return np.tanh(x * drive) / np.tanh(drive) if drive > 0 else x


def sidechain_env(n_total: int, kick_times: list[float], duck_amount: float = 0.75,
                   attack: float = 0.003, release: float = 0.16) -> np.ndarray:
    """Full-length gain envelope (1.0 = no duck) that dips at each kick time."""
    env = np.ones(n_total)
    na = max(1, n_samples(attack))
    nr = max(1, n_samples(release))
    dip = np.concatenate([
        np.linspace(1.0, 1.0 - duck_amount, na),
        np.linspace(1.0 - duck_amount, 1.0, nr) ** 0.7,
    ])
    dn = dip.shape[0]
    for kt in kick_times:
        s = n_samples(kt)
        e = min(s + dn, n_total)
        if s >= n_total:
            continue
        seg = dip[: e - s]
        env[s:e] = np.minimum(env[s:e], seg)
    return env


def limiter(x: np.ndarray, ceiling_db: float = -1.0, lookahead: int = 96) -> np.ndarray:
    """Simple look-ahead peak limiter."""
    ceiling = db_to_amp(ceiling_db)
    n = x.shape[0]
    peak = np.max(np.abs(x), axis=1) if x.ndim == 2 else np.abs(x)
    # look-ahead: gain at sample i limited by the max peak in [i, i+lookahead]
    kernel_max = np.zeros(n)
    from scipy.ndimage import maximum_filter1d
    kernel_max = maximum_filter1d(peak, size=lookahead, mode="nearest", origin=-(lookahead // 2))
    gain = np.minimum(1.0, ceiling / np.maximum(kernel_max, 1e-9))
    # smooth the gain curve to avoid pumping artifacts
    gain = butter_filter(gain, 40.0, "low", order=1)
    gain = np.minimum(gain, 1.0)
    if x.ndim == 2:
        gain = gain[:, None]
    return x * gain


def remove_dc(x: np.ndarray) -> np.ndarray:
    return x - np.mean(x, axis=0, keepdims=True)
