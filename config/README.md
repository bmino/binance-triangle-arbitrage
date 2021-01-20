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
* Default: `0.075`
* Description: Minimum investment amount of the base currency to consider
    
#### `INVESTMENT.MAX` (Number)
* Default: `0.015`
* Description: Maximum investment amount of the base currency to consider

#### `INVESTMENT.STEP` (Number)
* Default: `0.005`
* Description: Increments at which investment amounts are considered between the min and max


---


### `SCANNING`

#### `SCANNING.DEPTH` (Number)
* Default: `50`
* Description: Order book depth to maintain locally on each ticker
* [Extended Documentation](../src/resources/docs/depths.md)

#### `SCANNING.WHITELIST` (Array | String)
* Default: `[]`
* Description: Symbols to include when searching for triangle arbitrage


---


### `EXECUTION`

#### `EXECUTION.ENABLED` (Boolean)
* Default: `false`
* Description: Execute identified arbitrage positions when found

#### `EXECUTION.CAP` (Number)
* Default: `1`
* Description: Maximum number of executions to attempt before shutting down
* Special Values:
    * `0` - No limit on executions

#### `EXECUTION.STRATEGY` (String)
* Default: `"linear"`
* Description: Execution strategy to use
* [Extended Documentation](../src/resources/docs/strategies.md)
* Values:
    * `"linear"` - each trade of the triangle arbitrage is executed sequentially
    * `"parallel"` - all three trades of the triangle arbitrage are executed at the same time

#### `EXECUTION.TEMPLATE` (Array | String)
* Default: `["BUY", "SELL", "SELL"]`
* Description: Restricts the order type of each leg in the position
* Values:
    * `"BUY"` - Only allow BUY order type
    * `"SELL"` - Only allow SELL order type
    * `"*"` - No restriction on order type

#### `EXECUTION.FEE` (Number)
* Default: `0.10`
* Description: Market taker fee (percent)
* Example: 0.015% would be entered as 0.015

#### `EXECUTION.THRESHOLD.PROFIT` (Number)
* Default: `0.00`
* Description: Minimum profit (percent) required to consider executing a position
* Example: 0.50% would be entered as 0.50

#### `EXECUTION.THRESHOLD.AGE` (Number)
* Default: `25`
* Description: Maximum time (ms) since the oldest depth tick involved in the position required to consider executing a position


---


### `HUD`

#### `HUD.ENABLED` (Boolean)
* Default: `true`
* Description: Display the heads up display

#### `HUD.ROWS` (Number)
* Default: `10`
* Description: Number of triangular arbitrage positions shown on the HUD sorted by profit

#### `HUD.REFRESH_RATE` (Number)
* Default: `500`
* Description: Delay (ms) between each refresh and re-draw of the HUD


---


### `LOG`

#### `LOG.LEVEL` (String)
* Default: `"debug"`
* Description: Log level to configure how verbose logging messages are. Output can be found in the /log directory
* Values:
    * `"silent"`
    * `"fatal"`
    * `"error"`
    * `"warn"`
    * `"info"`
    * `"debug"`
    * `"trace"`

#### `LOG.PRETTY_PRINT` (Boolean)
* Default: `true`
* Description: Format the logs with pino-pretty. Read the logs via a terminal for best results

#### `LOG.STATUS_UPDATE_INTERVAL` (Number)
* Default: `2`
* Description: Interval (minute) between each status update
* Special Values:
    * `0` - Status updates will NOT be logged


---


### `WEBSOCKET`

#### `WEBSOCKET.BUNDLE_SIZE` (Number)
* Default: `1`
* Description: Number of tickers combined/included in each websocket

#### `WEBSOCKET.INITIALIZATION_INTERVAL` (Number)
* Default: `200`
* Description: Delay (ms) between the initialization of each websocket


---


### `BINANCE_OPTIONS`
* Default: `{}`
* Description: Optional parameters for [jaggedsoft's binance api library](https://github.com/jaggedsoft/node-binance-api)
* Example:
    ```json
    "BINANCE_OPTIONS": {
      "useServerTime": true
    }
    ```