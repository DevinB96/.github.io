# candlebot (forex edition)

A small candlestick bot for FX majors: backtester + paper-trading signal generator. **It never places real orders.**

## Run it
```
pip install pandas numpy yfinance
python candlebot.py backtest                       # 10y daily bars: EURUSD GBPUSD USDJPY AUDUSD USDCAD EURGBP
python candlebot.py backtest --pairs EURUSD GBPJPY --leverage 3
python candlebot.py paper                          # run once a day after the close; prints tomorrow's orders

# hourly candles (Yahoo only provides ~2 years of hourly history)
python candlebot.py backtest --tf 1h
python candlebot.py paper --tf 1h                  # run every hour just after the hour (cron: 1 * * * 1-5)
python plot_trade.py --tf 1h --pairs EURUSD --trade 3 --out trade.png
```
`paper` keeps `paper_state.json`, so you can follow it for 60-90 days and compare with the backtest.

## Strategy (trades both directions)
1. **Trend filter** - long only above the 50-day average, short only below it (Elder, Weinstein).
2. **Pattern** - long: hammer, bullish engulfing, piercing line, morning star. Short: shooting star, bearish engulfing, dark-cloud cover, evening star (Nison).
3. **Confirmation** - next candle must close beyond the pattern's high (long) or low (short).
4. **Entry** at the next open. **Stop** beyond the pattern extreme by half an ATR. **Target** 2R.
5. **Exit** also on an opposite-direction pattern, or after 10 bars.
6. **Risk** - 2% of equity per trade, max 3 positions, leverage capped at 5:1 (Tharp, Turtles, Douglas).
7. **Circuit breaker** - no new trades after a 30% drawdown from peak.
8. **Costs** - per-pair spreads in pips (EURUSD 1.0, GBPJPY 2.5, ...) plus 0.005%/day overnight financing.

## Hourly mode (`--tf 1h`)
Same rules, retuned: 200-bar trend average (about 8 days), exit after 48 bars, no new entries 21:00-23:59
(spreads widen around the rollover), swap charged per day held. It trades about 5x more often than daily
(roughly 30 trades per 90 days across 6 pairs vs ~6), which gives you more data in 60-90 days, but
spreads and swap take a bigger share of each small move. On random synthetic data hourly loses more than
daily (about -27% vs -9% over the test), which is that cost drag. Only real-data backtests can show whether
the patterns beat it. Also: with tight hourly stops the 5:1 leverage cap, not the 2% rule, limits position
size, so a 2R win pays well under 4% of the account.

## Honest notes
- Position size is "notional in GBP"; return on notional is currency-independent, so the account is kept in GBP
  without converting each pair. It ignores interest-rate differentials (real swap can help or hurt) and weekend gaps beyond the open.
- Candlestick patterns have modest, inconsistent edge in academic tests; forex spreads can erase it. On random
  synthetic data this bot loses slightly, as it should. Backtest on real data first.
- Leverage is the danger. 30:1 lets a £20 account hold £600 of currency; a 3% move against you wipes it out.
  Keep it at 5:1 or less.
- At £20 and 5:1 you can hold roughly £100 notional. You need a broker allowing tiny sizes (e.g. Oanda trades in single units).
  Many UK brokers have minimum lot sizes that make 2% risk impossible at this balance. Check before depositing.
- Retail FX CFD/spread-bet accounts: most retail clients lose money. This is a learning exercise, not financial advice.
