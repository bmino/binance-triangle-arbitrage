# Configuration

## Updating Configuration

The configuration file used by this application should be called `/config/config.json` and NOT `/config/config.json.example`.
Upon each version update you should copy the new syntax from `config.json.example` into `config.json`.


---


### `KEYS`

#### `KEYS.API` (String)
* Default: `""`
* Description: Binance api key for a demo environment (read-only is preferred)

#### `KEYS.SECRET` (String)
* Default: `""`
* Description: Binance api secret for a demo environment (read-only is preferred)

#### `KEYS.APIPROD` (String)
* Default: `""`
* Description: Binance api key for production

#### `KEYS.SECRETPROD` (String)
* Default: `""`
* Description: Binance api secret for production


---


### `INVESTMENT`

#### `INVESTMENT.BASE` (String)
* Default: `"BTC"`
* Description: Symbol which all triangle trades must start and end with
    
#### `INVESTMENT.MIN` (Number)
* Default: `0.015`
* Description: Minimum investment amount of the base currency to consider
    
#### `INVESTMENT.MAX` (Number)
* Default: `0.035`
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

#### `EXECUTION_TEMPLATE` (Array | String)
* Default: `["BUY", "SELL", "SELL"]`
* Description: Restricts the order type of each leg in the position
* Special Values:
    * `null` - No restriction on order type

#### `TRADING.EXECUTION_CAP` (Number)
* Default: `1`
* Description: Maximum number of executions to attempt before shutting down
* Special Values:
    * `0` - No limit on executions

#### `TAKER_FEE` (Number)
* Default: `0.00`
* Description: Market taker fee (percent)

#### `TRADING.PROFIT_THRESHOLD` (Number)
* Default: `0.30`
* Description: Minimum profit (percent) required to consider executing a position

#### `TRADING.AGE_THRESHOLD` (Number)
* Default: `300`
* Description: Maximum time (ms) since the oldest depth tick involved in the position

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
* Description: Number of arbs shown on the HUD


---


### `LOG`

#### `LOG.LEVEL` (String)
* Default: `"info"`
* Description: Log level to configure how verbose logging messages are
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
* Description: Format the logs with pino-pretty


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
    * `1000`

#### `DEPTH.INITIALIZATION_INTERVAL` (Number)
* Default: `50`
* Description: Delay (ms) between the initialization of each depth websocket


---


#### `CALCULATION_DELAY` (Number)
* Default: `100`
* Description: Delay (ms) after calculations are performed before starting another cycle


---


#### `DEMO` (Boolean)
* Default: `false`
* Description: Enable demo mode (will not trade, uses a read-only key, and ignores the balance warnings)