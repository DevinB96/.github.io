#!/usr/bin/env python3
"""Draw one backtested trade as a candlestick chart.
  python plot_trade.py --synthetic --trade 0 --out trade.png
  python plot_trade.py --pairs EURUSD --trade 5 --out trade.png"""
import argparse
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
import candlebot as cb

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pairs", nargs="+", default=["EURUSD", "GBPUSD", "USDJPY", "AUDUSD"])
    ap.add_argument("--csv"); ap.add_argument("--synthetic", action="store_true")
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--trade", type=int, default=0, help="index into the trade list")
    ap.add_argument("--out", default="trade.png")
    a = ap.parse_args()
    cfg = cb.Config()
    data = cb.synthetic(seed=a.seed) if a.synthetic else cb.load_csv(a.csv) if a.csv else cb.load_yf(a.pairs)
    trades, _ = cb.backtest(data, cfg)
    t = trades.iloc[a.trade]
    d = cb.add_patterns(data[t.pair], cfg)
    i0, i1 = d.index.get_loc(t.opened), d.index.get_loc(t.closed)
    w = d.iloc[max(i0 - 12, 0): i1 + 5]
    s = 1 if t.side == "long" else -1
    # recompute stop/target the way the backtest did
    sig = d.iloc[i0 - 2]
    stop = sig.low - cfg.stop_atr * sig.atr if s == 1 else sig.high + cfg.stop_atr * sig.atr
    target = t.entry + s * cfg.target_r * abs(t.entry - stop)

    up, dn, ink, mut = "#1a9850", "#d73027", "#222", "#888"
    fig, ax = plt.subplots(figsize=(10, 5.5))
    for x, (dt, r) in enumerate(w.iterrows()):
        col = up if r.close >= r.open else dn
        ax.plot([x, x], [r.low, r.high], color=col, lw=1)
        ax.add_patch(plt.Rectangle((x - .3, min(r.open, r.close)), .6, abs(r.close - r.open) or 1e-9, color=col))
    xs = {dt: x for x, dt in enumerate(w.index)}
    ax.axhline(stop, color=dn, ls="--", lw=1); ax.text(0, stop, " stop", color=dn, va="bottom", fontsize=9)
    ax.axhline(target, color=up, ls="--", lw=1); ax.text(0, target, " target (2R)", color=up, va="bottom", fontsize=9)
    sx = xs[d.index[i0 - 2]]
    ax.annotate(d.iloc[i0 - 2][f"{'bull' if s == 1 else 'bear'}_name"].replace("_", " ") + " pattern",
                (sx, d.iloc[i0 - 2].low if s == 1 else d.iloc[i0 - 2].high), xytext=(sx - 1, (stop + t.entry) / 2),
                arrowprops=dict(arrowstyle="->", color=mut), fontsize=9, color=ink)
    ax.plot(xs[t.opened], t.entry, "^" if s == 1 else "v", color=ink, ms=10, label=f"entry {t.entry:.5g}")
    ax.plot(xs[t.closed], t.exit, "x", color=ink, ms=10, mew=2, label=f"exit {t.exit:.5g}")
    ax.set_xticks(range(0, len(w), 3)); ax.set_xticklabels([x.strftime("%d %b") for x in w.index[::3]], fontsize=8)
    ax.set_title(f"{t.pair} {t.side.upper()}  |  result {t.r:+.2f}R  (£{t.pnl:+.2f} on a £20 account)", loc="left")
    ax.legend(frameon=False, loc="best"); ax.spines[["top", "right"]].set_visible(False)
    fig.tight_layout(); fig.savefig(a.out, dpi=130)
    print(f"saved {a.out}: {t.pair} {t.side} {t.pattern}, {t.r:+.2f}R")

if __name__ == "__main__":
    main()
