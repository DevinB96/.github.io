#!/usr/bin/env python3
"""
candlebot - a small, readable candlestick trading bot (backtest + paper trading).

Rules distilled from classic trading literature (see README for sources):
  * Nison      - candle patterns only matter in context; wait for confirmation.
  * Elder/Weinstein/Minervini - trade only with the trend (price > 50-day average).
  * Tharp/Turtles/Douglas     - risk a small fixed % per trade, fixed stop, no leverage,
                                cut losers, never average down, stop trading in a deep drawdown.
  * Schwager's Market Wizards - consistent theme: risk management beats prediction.

Usage:
  python candlebot.py backtest --tickers AAPL MSFT SPY       # needs: pip install yfinance
  python candlebot.py backtest --csv prices.csv              # CSV: date,open,high,low,close
  python candlebot.py backtest --synthetic                   # offline smoke test
  python candlebot.py paper --tickers AAPL MSFT SPY          # run daily after market close
"""
import argparse, json, os, sys
from dataclasses import dataclass, asdict
import numpy as np
import pandas as pd

# ----------------------------------------------------------------- config
@dataclass
class Config:
    start_cash: float = 20.0      # GBP
    risk_pct: float = 0.02        # risk 2% of equity per trade (Tharp: 1-2%)
    max_positions: int = 3
    trend_sma: int = 50           # long only while close > SMA(50)
    atr_len: int = 14
    stop_atr: float = 0.5         # stop = pattern low - 0.5*ATR
    target_r: float = 2.0         # take profit at 2R
    max_hold: int = 10            # time stop (bars)
    cost_pct: float = 0.002       # 0.2% per side: spread + fees + slippage (be pessimistic)
    halt_drawdown: float = 0.30   # stop opening trades if equity falls 30% from peak

# ------------------------------------------------------- candle patterns
def add_patterns(df: pd.DataFrame, cfg: Config) -> pd.DataFrame:
    d = df.copy()
    o, h, l, c = d.open, d.high, d.low, d.close
    body = (c - o).abs()
    rng = (h - l).replace(0, np.nan)
    lower = np.minimum(o, c) - l
    upper = h - np.maximum(o, c)
    red, green = c < o, c > o
    long_body = body > 0.6 * rng
    small_body = body < 0.3 * rng

    d["sma"] = c.rolling(cfg.trend_sma).mean()
    tr = pd.concat([h - l, (h - c.shift()).abs(), (l - c.shift()).abs()], axis=1).max(axis=1)
    d["atr"] = tr.rolling(cfg.atr_len).mean()
    pullback = c.shift(3) > c            # short-term dip into the pattern

    hammer = (lower >= 2 * body) & (upper <= 0.3 * body.clip(lower=1e-9)) & (body > 0) & pullback
    engulf = red.shift() & green & (o <= c.shift()) & (c >= o.shift()) & pullback
    piercing = (red.shift() & (body.shift() > 0.5 * rng.shift()) & green &
                (o < l.shift()) & (c > (o.shift() + c.shift()) / 2) & (c < o.shift()))
    morning = (red.shift(2) & (body.shift(2) > 0.5 * rng.shift(2)) & (small_body.shift()) &
               green & (c > (o.shift(2) + c.shift(2)) / 2))

    d["bull"] = hammer | engulf | piercing | morning
    d["bull_name"] = np.select([morning, engulf, piercing, hammer],
                               ["morning_star", "bull_engulfing", "piercing", "hammer"], "")
    # bearish patterns = exit signals for open longs
    shooting = (upper >= 2 * body) & (lower <= 0.3 * body.clip(lower=1e-9)) & (body > 0)
    bear_engulf = green.shift() & red & (o >= c.shift()) & (c <= o.shift())
    evening = (green.shift(2) & (body.shift(2) > 0.5 * rng.shift(2)) & small_body.shift() &
               red & (c < (o.shift(2) + c.shift(2)) / 2))
    d["bear"] = (shooting | bear_engulf | evening) & (c.shift(3) < c)  # only after a rise
    return d

# --------------------------------------------------------------- backtest
def backtest(data: dict, cfg: Config):
    """Daily bars. Signal bar i-1 -> confirmation bar i closes above signal high
    -> enter at open of bar i+1. Stop below signal low. Exits: stop, 2R target,
    bearish pattern, time stop. Fills are pessimistic (stop first if both hit)."""
    pdata = {t: add_patterns(df, cfg) for t, df in data.items()}
    dates = sorted(set().union(*[set(d.index) for d in pdata.values()]))
    cash, peak, pos, trades, curve = cfg.start_cash, cfg.start_cash, {}, [], []
    for dt in dates:
        # 1) manage open positions on this bar
        for t in list(pos):
            d = pdata[t]
            if dt not in d.index: continue
            r = d.loc[dt]; p = pos[t]; p["age"] += 1
            exit_px = None
            if r.open <= p["stop"]: exit_px = r.open            # gap through stop
            elif r.low <= p["stop"]: exit_px = p["stop"]
            elif r.open >= p["target"]: exit_px = r.open
            elif r.high >= p["target"]: exit_px = p["target"]
            if exit_px is None and p["exit_next"]: exit_px = r.open   # bearish signal yesterday
            if exit_px is None and p["age"] >= cfg.max_hold: exit_px = r.close
            if exit_px is None and r.bear: p["exit_next"] = True
            if exit_px is not None:
                proceeds = p["qty"] * exit_px * (1 - cfg.cost_pct)
                cash += proceeds
                trades.append(dict(ticker=t, entry=p["entry"], exit=exit_px, pattern=p["pattern"],
                                   pnl=proceeds - p["cost_basis"], r=(exit_px - p["entry"]) / p["risk_ps"],
                                   opened=p["opened"], closed=dt))
                del pos[t]
        # 2) equity mark-to-market
        eq = cash + sum(p["qty"] * pdata[t].close.asof(dt) for t, p in pos.items())
        peak = max(peak, eq); curve.append((dt, eq))
        halted = eq < peak * (1 - cfg.halt_drawdown)
        # 3) look for entries: pattern on bar i-1 confirmed by bar i, enter next open (done at i+1 below)
        if halted: continue
        for t, d in pdata.items():
            if t in pos or len(pos) >= cfg.max_positions or dt not in d.index: continue
            i = d.index.get_loc(dt)
            if i < cfg.trend_sma + 3 or i + 1 >= len(d): continue
            sig, now, nxt = d.iloc[i - 1], d.iloc[i], d.iloc[i + 1]
            if not (sig.bull and now.close > sig.high and now.close > now.sma and not np.isnan(sig.atr)): continue
            entry = nxt.open * (1 + cfg.cost_pct)
            stop = sig.low - cfg.stop_atr * sig.atr
            risk_ps = entry - stop
            if risk_ps <= 0 or risk_ps / entry > 0.15: continue          # skip silly-wide stops
            qty = min(eq * cfg.risk_pct / risk_ps, cash / entry)          # fractional shares, no leverage
            if qty * entry < 1.0: continue                                # ignore dust positions
            cash -= qty * entry
            pos[t] = dict(qty=qty, entry=entry, stop=stop, target=entry + cfg.target_r * risk_ps,
                          risk_ps=risk_ps, age=-1, exit_next=False, cost_basis=qty * entry,
                          pattern=sig.bull_name, opened=d.index[i + 1])
    # close leftovers at last price
    for t, p in pos.items():
        px = pdata[t].close.iloc[-1]; cash += p["qty"] * px * (1 - cfg.cost_pct)
    return pd.DataFrame(trades), pd.Series(dict(curve), name="equity")

def report(trades, curve, cfg):
    if trades.empty:
        print("No trades."); return
    ret = curve.iloc[-1] / cfg.start_cash - 1
    dd = (curve / curve.cummax() - 1).min()
    win = (trades.pnl > 0).mean()
    print(f"Trades {len(trades)} | win rate {win:.0%} | avg R {trades.r.mean():.2f} | "
          f"final £{curve.iloc[-1]:.2f} ({ret:+.1%}) | max drawdown {dd:.1%}")
    print(trades.groupby("pattern").agg(n=("r", "size"), avg_R=("r", "mean")).round(2).to_string())
    # What would a random 63-bar (~90 calendar day) window have looked like starting with GBP 20?
    w = 63
    if len(curve) > w + 10:
        rolling = (curve.shift(-w) / curve).dropna() * cfg.start_cash
        q = rolling.quantile([.05, .25, .5, .75, .95])
        print(f"\nRolling {w}-trading-day outcomes from £{cfg.start_cash:.0f} (all start dates in history):")
        print("  5th £%.2f | 25th £%.2f | median £%.2f | 75th £%.2f | 95th £%.2f" % tuple(q.values))
        print(f"  windows ending below start: {(rolling < cfg.start_cash).mean():.0%}")

# ------------------------------------------------------------------- data
def load_yf(tickers, years=10):
    try:
        import yfinance as yf
    except ImportError:
        sys.exit("pip install yfinance  (or use --csv / --synthetic)")
    out = {}
    for t in tickers:
        df = yf.download(t, period=f"{years}y", interval="1d", auto_adjust=True, progress=False)
        if df.empty: continue
        df.columns = [str(c[0] if isinstance(c, tuple) else c).lower() for c in df.columns]
        out[t] = df[["open", "high", "low", "close"]].dropna()
    return out

def load_csv(path):
    df = pd.read_csv(path, parse_dates=[0], index_col=0)
    df.columns = [c.lower() for c in df.columns]
    return {os.path.basename(path): df[["open", "high", "low", "close"]].dropna()}

def synthetic(n=4, days=1500, seed=1):
    rng = np.random.default_rng(seed); out = {}
    idx = pd.bdate_range("2019-01-01", periods=days)
    for k in range(n):
        ret = rng.normal(0.0003, 0.015, days)
        close = 100 * np.exp(np.cumsum(ret)); op = np.r_[100, close[:-1]] * (1 + rng.normal(0, .003, days))
        hi = np.maximum(op, close) * (1 + abs(rng.normal(0, .006, days)))
        lo = np.minimum(op, close) * (1 - abs(rng.normal(0, .006, days)))
        out[f"SYN{k}"] = pd.DataFrame(dict(open=op, high=hi, low=lo, close=close), index=idx)
    return out

# ------------------------------------------------------------ paper trade
STATE = "paper_state.json"

def paper(data, cfg):
    """Run once per day after the close. Keeps state in paper_state.json.
    Prints the orders you'd place manually tomorrow - it never touches a real broker."""
    st = json.load(open(STATE)) if os.path.exists(STATE) else dict(cash=cfg.start_cash, pos={}, peak=cfg.start_cash, log=[])
    pdata = {t: add_patterns(df, cfg) for t, df in data.items()}
    orders = []
    for t, p in list(st["pos"].items()):
        r = pdata[t].iloc[-1]
        if r.low <= p["stop"] or r.high >= p["target"] or r.bear:
            orders.append(f"SELL {t} all ({p['qty']:.4f}) at next open  [stop {p['stop']:.2f} / target {p['target']:.2f}]")
        else:
            orders.append(f"HOLD {t}  stop {p['stop']:.2f}  target {p['target']:.2f}")
    eq = st["cash"] + sum(p["qty"] * pdata[t].close.iloc[-1] for t, p in st["pos"].items())
    st["peak"] = max(st["peak"], eq)
    if eq >= st["peak"] * (1 - cfg.halt_drawdown):
        for t, d in pdata.items():
            if t in st["pos"] or len(st["pos"]) >= cfg.max_positions or len(d) < cfg.trend_sma + 3: continue
            sig, now = d.iloc[-2], d.iloc[-1]
            if sig.bull and now.close > sig.high and now.close > now.sma:
                stop = sig.low - cfg.stop_atr * sig.atr; entry = now.close
                risk_ps = entry - stop
                if risk_ps <= 0 or risk_ps / entry > 0.15: continue
                qty = min(eq * cfg.risk_pct / risk_ps, st["cash"] / entry)
                if qty * entry < 1.0: continue
                orders.append(f"BUY  {t} {qty:.4f} (~£{qty*entry:.2f}) at next open | stop {stop:.2f} | target {entry + cfg.target_r*risk_ps:.2f} | {sig.bull_name}")
                st["pos"][t] = dict(qty=qty, entry=entry, stop=stop, target=entry + cfg.target_r * risk_ps)
                st["cash"] -= qty * entry
    else:
        orders.append("HALTED: drawdown limit hit - no new trades. Review before continuing.")
    json.dump(st, open(STATE, "w"), indent=1)
    print(f"Paper equity ~£{eq:.2f}"); print("\n".join(orders) or "No action.")

# ------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("mode", choices=["backtest", "paper"])
    ap.add_argument("--tickers", nargs="+", default=["SPY", "QQQ", "AAPL", "MSFT", "NVDA"])
    ap.add_argument("--csv"); ap.add_argument("--synthetic", action="store_true")
    ap.add_argument("--cash", type=float, default=20.0); ap.add_argument("--risk", type=float, default=0.02)
    a = ap.parse_args()
    cfg = Config(start_cash=a.cash, risk_pct=a.risk)
    data = synthetic() if a.synthetic else load_csv(a.csv) if a.csv else load_yf(a.tickers)
    if a.mode == "backtest": report(*backtest(data, cfg), cfg)
    else: paper(data, cfg)

if __name__ == "__main__":
    main()
