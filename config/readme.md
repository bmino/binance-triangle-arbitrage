# Configuration

## Updating Configuration

The configuration file used by this application should be called `/config/config.json` and NOT `/config/config.json.example`.
Upon each version update you should copy the new syntax from `config.json.example` into `config.json`.


---


### `KEYS`

#### `KEYS.API` (String)
* Default: `""`
* Description: Binance api key

#### `KEYS.SECRET` (String)
* Default: `""`
* Description: Binance api secret


---


### `INVESTMENT`

#### `INVESTMENT.BASE` (String)
* Default: `"BTC"`
* Description: Symbol which all triangle trades must start and end with
    
#### `INVESTMENT.MIN` (Number)
* Default: `0.015`
* Description: Minimum investment amount of the base currency to consider
    
#### `INVESTMENT.MAX` (Number)
* Default: `0.030`
* Description: Maximum investment amount of the base currency to consider

#### `INVESTMENT.STEP` (Number)
* Default: `0.005`
* Description: Increments at which investment amounts are considered between the min and max


---


### `TRADING`

#### `TRADING.ENABLED` (Boolean)
* Default: `false`
* Description: Execute identified arbitrage positions when found

#### `TRADING.EXECUTION_STRATEGY` (String)
* Default: `"linear"`
* Description: Execution strategy to use
* [Extended Documentation](../src/resources/docs/strategies.md)
* Values:
    * `"linear"` - each trade of the triangle arbitrage is executed sequentially
    * `"parallel"` - all three trades of the triangle arbitrage are executed at the same time

#### `TRADING.EXECUTION_TEMPLATE` (Array | String)
* Default: `["BUY", "SELL", "SELL"]`
* Description: Restricts the order type of each leg in the position
* Special Values:
    * `null` - No restriction on order type

#### `TRADING.EXECUTION_CAP` (Number)
* Default: `1`
* Description: Maximum number of executions to attempt before shutting down
* Special Values:
    * `0` - No limit on executions

#### `TRADING.TAKER_FEE` (Number)
* Default: `0.10`
* Description: Market taker fee (percent)
* Example: 0.015% would be entered as 0.015

#### `TRADING.PROFIT_THRESHOLD` (Number)
* Default: `0.00`
* Description: Minimum profit (percent) required to consider executing a position
* Example: 0.50% would be entered as 0.50

#### `TRADING.AGE_THRESHOLD` (Number)
* Default: `100`
* Description: Maximum time (ms) since the oldest depth tick involved in the position required to consider executing a position

#### `TRADING.WHITELIST` (Array | String)
* Default: `[]`
* Description: Symbols to include when searching for triangle arbitrage


---


### `HUD`

#### `HUD.ENABLED` (Boolean)
* Default: `true`
* Description: Display and refresh the heads up display

#### `HUD.ARB_COUNT` (Number)
* Default: `10`
* Description: Number of triangular arbitrage positions shown on the HUD


---


### `LOG`

#### `LOG.LEVEL` (String)
* Default: `"debug"`
* Description: Log level to configure how verbose logging messages are. Output can be found in the /log directory
* Values:
    * `"fatal"`
    * `"error"`
    * `"warn"`
    * `"info"`
    * `"debug"`
    * `"trace"`
    * `"silent"`

#### `LOG.PRETTY_PRINT` (Boolean)
* Default: `true`
* Description: Format the logs with pino-pretty. Read the logs via a terminal for best results


---


### `DEPTH`

#### `DEPTH.SIZE` (Number)
* Default: `50`
* Description: Order book depth to maintain locally on each ticker
* [Extended Documentation](../src/resources/docs/depths.md)
* Values:
    * `5`
    * `10`
    * `20`
    * `50`
    * `100`
    * `500`

#### `DEPTH.PRUNE` (Boolean)
* Default: `true`
* Description: Remove depth cache entries with a depth greater than `DEPTH.SIZE` before each calculation cycle

#### `DEPTH.INITIALIZATION_INTERVAL` (Number)
* Default: `75`
* Description: Delay (ms) between the initialization of each depth websocket


---


### `TIMING`

#### `TIMING.RECEIVE_WINDOW` (Number)
* Default: `5000`
* Description: Time (ms) after a given timestamp until a request is no longer considered valid

#### `TIMING.USE_SERVER_TIME` (Boolean)
* Default: `false`
* Description: Synchronize with the Binance API server time and modify request timestamps

#### `TIMING.CALCULATION_COOLDOWN` (Number)
* Default: `250`
* Description: Delay (ms) between completing calculations and starting another cycle
