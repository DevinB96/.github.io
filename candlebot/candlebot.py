#!/usr/bin/env python3
"""
candlebot (forex edition) - a small candlestick bot for FX majors: backtest + paper trading.

Rules distilled from classic trading literature (see README):
  * Nison      - candle patterns only matter in context; wait for confirmation.
  * Elder/Weinstein - trade with the trend: long above the 50-day average, short below it.
  * Tharp/Turtles/Douglas - risk a small fixed % per trade, fixed stop, capped leverage,
                            cut losers, no averaging down, halt after a deep drawdown.

Usage:
  python candlebot.py backtest                          # needs: pip install yfinance
  python candlebot.py backtest --pairs EURUSD GBPUSD
  python candlebot.py backtest --csv EURUSD.csv         # CSV: date,open,high,low,close
  python candlebot.py backtest --synthetic              # offline smoke test
  python candlebot.py paper                             # run daily after the 22:00 UK close
"""
import argparse, json, os, sys
from dataclasses import dataclass
import numpy as np
import pandas as pd

# typical retail spreads in pips (all-in round trip incl. a little slippage); unknown pairs use DEFAULT
SPREAD_PIPS = {"EURUSD": 1.0, "GBPUSD": 1.4, "USDJPY": 1.2, "AUDUSD": 1.4, "USDCAD": 1.8,
               "USDCHF": 1.8, "NZDUSD": 2.0, "EURGBP": 1.5, "EURJPY": 1.8, "GBPJPY": 2.5}
DEFAULT_SPREAD = 2.5

@dataclass
class Config:
    start_cash: float = 20.0      # GBP
    risk_pct: float = 0.02        # risk 2% of equity per trade (Tharp: 1-2%)
    max_leverage: float = 5.0     # total notional / equity cap. UK retail allows 30:1; 5:1 is far safer
    max_positions: int = 3
    trend_sma: int = 50
    atr_len: int = 14
    stop_atr: float = 0.5         # stop = beyond pattern extreme by 0.5*ATR
    target_r: float = 2.0
    max_hold: int = 10            # time stop (bars)
    swap_pct_day: float = 0.00005 # 0.005%/day of notional paid as overnight financing (conservative)
    halt_drawdown: float = 0.30
    min_notional: float = 5.0     # GBP; ignore dust positions

def pip(pair): return 0.01 if "JPY" in pair else 0.0001
def half_spread(pair, px): return SPREAD_PIPS.get(pair, DEFAULT_SPREAD) * pip(pair) / 2

# ------------------------------------------------------- candle patterns
def add_patterns(df: pd.DataFrame, cfg: Config) -> pd.DataFrame:
    d = df.copy()
    o, h, l, c = d.open, d.high, d.low, d.close
    body = (c - o).abs()
    rng = (h - l).replace(0, np.nan)
    lower = np.minimum(o, c) - l
    upper = h - np.maximum(o, c)
    red, green = c < o, c > o
    small = body < 0.3 * rng
    big = lambda k: body.shift(k) > 0.5 * rng.shift(k)
    mid = lambda k: (o.shift(k) + c.shift(k)) / 2
    eps = body.clip(lower=1e-9)

    d["sma"] = c.rolling(cfg.trend_sma).mean()
    tr = pd.concat([h - l, (h - c.shift()).abs(), (l - c.shift()).abs()], axis=1).max(axis=1)
    d["atr"] = tr.rolling(cfg.atr_len).mean()
    dip, pop = c.shift(3) > c, c.shift(3) < c         # short-term move into the pattern

    # bullish reversals (after a dip)
    hammer = (lower >= 2 * body) & (upper <= 0.3 * eps) & (body > 0) & dip
    b_engulf = red.shift() & green & (o <= c.shift()) & (c >= o.shift()) & dip
    piercing = red.shift() & big(1) & green & (o < l.shift()) & (c > mid(1)) & (c < o.shift())
    morning = red.shift(2) & big(2) & small.shift() & green & (c > mid(2))
    # bearish reversals (after a pop)
    shooting = (upper >= 2 * body) & (lower <= 0.3 * eps) & (body > 0) & pop
    s_engulf = green.shift() & red & (o >= c.shift()) & (c <= o.shift()) & pop
    darkcloud = green.shift() & big(1) & red & (o > h.shift()) & (c < mid(1)) & (c > o.shift())
    evening = green.shift(2) & big(2) & small.shift() & red & (c < mid(2))

    d["bull"] = hammer | b_engulf | piercing | morning
    d["bear"] = shooting | s_engulf | darkcloud | evening
    d["bull_name"] = np.select([morning, b_engulf, piercing, hammer],
                               ["morning_star", "engulfing", "piercing", "hammer"], "")
    d["bear_name"] = np.select([evening, s_engulf, darkcloud, shooting],
                               ["evening_star", "engulfing", "dark_cloud", "shooting_star"], "")
    return d

def entry_signal(d, i, cfg):
    """Pattern on bar i-1, confirmed by bar i's close beyond the pattern, with the trend.
    Returns (direction, stop, pattern) or None."""
    sig, now = d.iloc[i - 1], d.iloc[i]
    if np.isnan(sig.atr) or np.isnan(now.sma): return None
    if sig.bull and now.close > sig.high and now.close > now.sma:
        return 1, sig.low - cfg.stop_atr * sig.atr, sig.bull_name
    if sig.bear and now.close < sig.low and now.close < now.sma:
        return -1, sig.high + cfg.stop_atr * sig.atr, sig.bear_name
    return None

def size(equity, used_notional, entry, stop, cfg):
    """Notional (GBP) so that hitting the stop loses risk_pct of equity, capped by leverage.
    Return on notional is currency-independent, so no FX conversion of the account is needed."""
    stop_frac = abs(entry - stop) / entry
    if stop_frac <= 0 or stop_frac > 0.05: return 0.0
    n = min(equity * cfg.risk_pct / stop_frac, equity * cfg.max_leverage - used_notional)
    return n if n >= cfg.min_notional else 0.0

# --------------------------------------------------------------- backtest
def backtest(data: dict, cfg: Config):
    """Daily bars. Enter at the next open after confirmation. Pessimistic fills: if stop and
    target are both inside one bar, the stop is assumed hit first. Gaps fill at the open."""
    pdata = {t: add_patterns(df, cfg) for t, df in data.items()}
    dates = sorted(set().union(*[set(d.index) for d in pdata.values()]))
    cash = peak = cfg.start_cash; pos, trades, curve = {}, [], []
    mtm = lambda dt: sum(p["n"] * p["dir"] * (pdata[t].close.asof(dt) / p["entry"] - 1) for t, p in pos.items())
    for dt in dates:
        for t in list(pos):
            d = pdata[t]
            if dt not in d.index: continue
            r, p = d.loc[dt], pos[t]; p["age"] += 1; s = p["dir"]
            stop_hit = (r.low <= p["stop"]) if s == 1 else (r.high >= p["stop"])
            tgt_hit = (r.high >= p["target"]) if s == 1 else (r.low <= p["target"])
            gap_stop = (r.open <= p["stop"]) if s == 1 else (r.open >= p["stop"])
            gap_tgt = (r.open >= p["target"]) if s == 1 else (r.open <= p["target"])
            px = None
            if gap_stop: px = r.open
            elif stop_hit: px = p["stop"]
            elif gap_tgt: px = r.open
            elif tgt_hit: px = p["target"]
            elif p["exit_next"]: px = r.open
            elif p["age"] >= cfg.max_hold: px = r.close
            if px is None and ((s == 1 and r.bear) or (s == -1 and r.bull)): p["exit_next"] = True
            if px is not None:
                net = px - s * half_spread(t, px)
                pnl = p["n"] * s * (net / p["entry"] - 1) - p["n"] * cfg.swap_pct_day * max(p["age"], 1)
                cash += pnl
                trades.append(dict(pair=t, side="long" if s == 1 else "short", pattern=p["pattern"],
                                   opened=p["opened"], closed=dt, entry=p["entry"], exit=net,
                                   r=s * (net - p["entry"]) / p["risk_ps"], pnl=pnl))
                del pos[t]
        eq = cash + mtm(dt); peak = max(peak, eq); curve.append((dt, eq))
        if eq < peak * (1 - cfg.halt_drawdown): continue            # circuit breaker
        for t, d in pdata.items():
            if t in pos or len(pos) >= cfg.max_positions or dt not in d.index: continue
            i = d.index.get_loc(dt)
            if i < cfg.trend_sma + 3 or i + 1 >= len(d): continue
            sg = entry_signal(d, i, cfg)
            if not sg: continue
            s, stop, name = sg
            entry = d.iloc[i + 1].open + s * half_spread(t, d.iloc[i + 1].open)
            n = size(eq, sum(p["n"] for p in pos.values()), entry, stop, cfg)
            if n == 0 or (entry - stop) * s <= 0: continue
            risk_ps = abs(entry - stop)
            pos[t] = dict(n=n, dir=s, entry=entry, stop=stop, target=entry + s * cfg.target_r * risk_ps,
                          risk_ps=risk_ps, age=-1, exit_next=False, pattern=name, opened=d.index[i + 1])
    for t, p in pos.items():                                         # close leftovers at last price
        cash += p["n"] * p["dir"] * (pdata[t].close.iloc[-1] / p["entry"] - 1)
    return pd.DataFrame(trades), pd.Series(dict(curve), name="equity")

def report(trades, curve, cfg):
    if trades.empty: print("No trades."); return
    ret = curve.iloc[-1] / cfg.start_cash - 1
    dd = (curve / curve.cummax() - 1).min()
    print(f"Trades {len(trades)} | win rate {(trades.pnl > 0).mean():.0%} | avg R {trades.r.mean():.2f} | "
          f"final £{curve.iloc[-1]:.2f} ({ret:+.1%}) | max drawdown {dd:.1%}")
    print(trades.groupby("side").agg(n=("r", "size"), avg_R=("r", "mean")).round(2).to_string())
    print(trades.groupby("pattern").agg(n=("r", "size"), avg_R=("r", "mean")).round(2).to_string())
    w = 63                                                           # ~90 calendar days
    if len(curve) > w + 10:
        roll = (curve.shift(-w) / curve).dropna() * cfg.start_cash
        q = roll.quantile([.05, .25, .5, .75, .95])
        print(f"\nRolling {w}-trading-day outcomes from £{cfg.start_cash:.0f} (every start date in history):")
        print("  5th £%.2f | 25th £%.2f | median £%.2f | 75th £%.2f | 95th £%.2f" % tuple(q.values))
        print(f"  windows ending below start: {(roll < cfg.start_cash).mean():.0%}")

# ------------------------------------------------------------------- data
def load_yf(pairs, years=10):
    try: import yfinance as yf
    except ImportError: sys.exit("pip install yfinance  (or use --csv / --synthetic)")
    out = {}
    for p in pairs:
        df = yf.download(f"{p}=X", period=f"{years}y", interval="1d", auto_adjust=True, progress=False)
        if df.empty: continue
        df.columns = [str(c[0] if isinstance(c, tuple) else c).lower() for c in df.columns]
        out[p] = df[["open", "high", "low", "close"]].dropna()
    return out

def load_csv(path):
    df = pd.read_csv(path, parse_dates=[0], index_col=0)
    df.columns = [c.lower() for c in df.columns]
    return {os.path.basename(path).split(".")[0].upper(): df[["open", "high", "low", "close"]].dropna()}

def synthetic(days=1500, seed=1):
    rng = np.random.default_rng(seed); out = {}
    idx = pd.bdate_range("2019-01-01", periods=days)
    for name, start in [("EURUSD", 1.10), ("GBPUSD", 1.30), ("USDJPY", 110.0), ("AUDUSD", 0.70)]:
        close = start * np.exp(np.cumsum(rng.normal(0, 0.0055, days)))
        op = np.r_[start, close[:-1]] * (1 + rng.normal(0, 0.0004, days))
        hi = np.maximum(op, close) * (1 + abs(rng.normal(0, 0.0025, days)))
        lo = np.minimum(op, close) * (1 - abs(rng.normal(0, 0.0025, days)))
        out[name] = pd.DataFrame(dict(open=op, high=hi, low=lo, close=close), index=idx)
    return out

# ------------------------------------------------------------ paper trade
STATE = "paper_state.json"

def paper(data, cfg):
    """Run once per day after the close. Prints orders to place manually tomorrow; never trades."""
    st = json.load(open(STATE)) if os.path.exists(STATE) else dict(cash=cfg.start_cash, pos={}, peak=cfg.start_cash)
    pdata = {t: add_patterns(df, cfg) for t, df in data.items()}
    orders = []
    for t, p in list(st["pos"].items()):
        r, s = pdata[t].iloc[-1], p["dir"]
        hit = (r.low <= p["stop"] or r.high >= p["target"]) if s == 1 else (r.high >= p["stop"] or r.low <= p["target"])
        if hit or (s == 1 and r.bear) or (s == -1 and r.bull):
            orders.append(f"CLOSE {t} {'LONG' if s == 1 else 'SHORT'} (£{p['n']:.2f} notional) at next open")
            st["cash"] += p["n"] * s * (r.close / p["entry"] - 1); del st["pos"][t]
        else:
            orders.append(f"HOLD  {t} {'LONG' if s == 1 else 'SHORT'}  stop {p['stop']:.5g}  target {p['target']:.5g}")
    eq = st["cash"] + sum(p["n"] * p["dir"] * (pdata[t].close.iloc[-1] / p["entry"] - 1) for t, p in st["pos"].items())
    st["peak"] = max(st["peak"], eq)
    if eq >= st["peak"] * (1 - cfg.halt_drawdown):
        for t, d in pdata.items():
            if t in st["pos"] or len(st["pos"]) >= cfg.max_positions or len(d) < cfg.trend_sma + 3: continue
            sg = entry_signal(d, len(d) - 1, cfg)
            if not sg: continue
            s, stop, name = sg; entry = d.iloc[-1].close
            n = size(eq, sum(p["n"] for p in st["pos"].values()), entry, stop, cfg)
            if n == 0 or (entry - stop) * s <= 0: continue
            tgt = entry + s * cfg.target_r * abs(entry - stop)
            orders.append(f"OPEN  {t} {'LONG' if s == 1 else 'SHORT'} £{n:.2f} notional (margin ~£{n/cfg.max_leverage:.2f} at "
                          f"{cfg.max_leverage:.0f}:1) | stop {stop:.5g} | target {tgt:.5g} | {name}")
            st["pos"][t] = dict(n=n, dir=s, entry=entry, stop=stop, target=tgt)
    else:
        orders.append("HALTED: drawdown limit hit - no new trades. Review before continuing.")
    json.dump(st, open(STATE, "w"), indent=1)
    print(f"Paper equity ~£{eq:.2f}"); print("\n".join(orders) or "No action.")

# ------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("mode", choices=["backtest", "paper"])
    ap.add_argument("--pairs", nargs="+", default=["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "EURGBP"])
    ap.add_argument("--csv"); ap.add_argument("--synthetic", action="store_true")
    ap.add_argument("--cash", type=float, default=20.0); ap.add_argument("--risk", type=float, default=0.02)
    ap.add_argument("--leverage", type=float, default=5.0)
    a = ap.parse_args()
    cfg = Config(start_cash=a.cash, risk_pct=a.risk, max_leverage=a.leverage)
    data = synthetic() if a.synthetic else load_csv(a.csv) if a.csv else load_yf(a.pairs)
    if a.mode == "backtest": report(*backtest(data, cfg), cfg)
    else: paper(data, cfg)

if __name__ == "__main__":
    main()
