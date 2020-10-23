# Scanning Methods
The two methods of scanning are referred to as "callback scanning" and "scheduled scanning."
Prior to v6.0.0 all scanning used the scheduled scanning method.
The `SCANNING.TIMEOUT` configuration value determines which method is used.
A value of `0` will utilize callback scanning and other values will utilize the legacy scheduled scanning.


### Callback Scanning

Triggers calculation cycles for all related positions each time an order book update is received

##### Pros

* Rapid identification of arbitrage opportunities
* Efficiently perform analysis cycle when new data is available

##### Cons

* More demanding cpu requirements


### Scheduled Scanning

Triggers calculation cycles for all tickers with a delay between each time this is scheduled

##### Pros

* Can throttle analysis cycles when using a weaker cpu
* Cannot be overwhelmed by concurrent analysis cycles

##### Cons

* Slower to identify arbitrage opportunities
* Inefficient analysis cycles on the same data


---


The two scanning methods represent a series of tradeoffs:

|     | Callback Scanning | Scheduled Scanning |
|----:|:-----------------:|:------------------:|
| Quickly identify opportunities       | X |   |
| Efficient analysis cycles            | X |   |
| Low CPU requirements                 |   | X |
| Can be throttled                     |   | X |