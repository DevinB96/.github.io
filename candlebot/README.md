# candlebot

A small candlestick trading bot: backtester + paper-trading signal generator. **It never places real orders.**

## Run it
```
pip install pandas numpy yfinance
python candlebot.py backtest                 # 10y daily bars on SPY QQQ AAPL MSFT NVDA, starts with £20
python candlebot.py backtest --tickers VOD.L LLOY.L SHEL.L
python candlebot.py paper                    # run once a day after the close; prints tomorrow's orders
```
`paper` keeps `paper_state.json`, so you can follow it for 60-90 days and compare with the backtest.

## The strategy
1. **Trend filter** - only buy when close > 50-day average (Elder, Weinstein, Minervini).
2. **Pattern** - hammer, bullish engulfing, piercing line or morning star after a short dip (Nison).
3. **Confirmation** - next candle must close above the pattern's high (Nison).
4. **Entry** at the following open. **Stop** below the pattern low minus half an ATR.
5. **Exit** at 2R target, bearish pattern (shooting star / bearish engulfing / evening star), or after 10 bars.
6. **Risk** - 2% of equity per trade, max 3 positions, no leverage, no averaging down (Tharp, Turtles, Douglas).
7. **Circuit breaker** - no new trades after a 30% drawdown from peak.
8. **Costs** - 0.2% per side is charged, because costs kill small accounts.

## Honest notes
- I can't read books in full; this encodes the widely documented rules from Nison's *Japanese Candlestick Charting
  Techniques*, Elder, Tharp, Douglas, the Turtle rules and Schwager's *Market Wizards*.
- Candlestick patterns have modest, inconsistent edge in academic tests, and the edge often disappears after costs.
  Backtest on real data before you believe anything. On random synthetic data this bot loses slightly, as it should.
- £20 is a learning budget. At 2% risk you risk about 40p per trade, so expect single-digit pounds of movement
  in 90 days. Doubling it would mean a lucky streak, not a plan. Don't expect to, and never add money to "catch up".
- Real-money notes (UK): you need a broker with fractional shares and no minimum fee (e.g. Trading 212, Freetrade).
  Avoid leverage/CFDs at this size. Tax and fees aren't modelled. This is not financial advice.
