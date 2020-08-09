# Execution Strategies


## Linear Execution

The three trades are initiated in sequence with each trade being executed once the previous one completes.

#### Balance Requirements

Because each trade uses the balance acquired from the previous trade, a balance of only one symbol must be held.
For instance, if BTC-XRP-ETH is identified as profitable, only the base symbol of BTC would need to be held.
The balance must be enough to cover trades up to `INVESTMENT.MAX`

Given the following assumptions:

* `INVESTMENT.BASE` is BTC
* `INVESTMENT.MAX` is 0.4

```
Recommended BTC >= 0.4
```


## Parallel Execution

Each of the three trades is initiated at the same time. This reduces total execution time from identification to completion.

#### Balance Requirements

Because each trade is executed at the same time, a balance of all symbols involved must be held.
For instance, if BTC-LTC-ETH is identified as profitable, a balance of BTC, LTC, and ETH would need to be held.
Each balance must be enough to cover the maximum possible quantity that could be exchanged of that symbol.

Given the following assumptions:

* `INVESTMENT.BASE` is BTC
* `INVESTMENT.MAX` is 0.4
* `LTCBTC` is trading at 0.0122
* `ETHBTC` is trading at 0.0332

```
Recommended BTC >= 0.4
Recommended LTC >= (0.4 / 0.0122) = 32.787
Recommended ETH >= (0.4 / 0.0332) = 12.048
```