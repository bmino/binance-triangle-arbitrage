# Investment Bases

Every trade has one base asset and is commonly referred to as the `A` in the `A-B-C` simplification.
You must specify at least one base to start the application, and must hold a balance of all base assets.


### Configuring Base Assets

Base assets, and their associated configuration, are defined under the `INVESTMENT` configuration object.
Each json key is the trading symbol of the base asset, and the value is a json object containing the associated options.
Here is an example of configuring one base asset (BTC):

```json
// config.json
{
  ...
  
  "INVESTMENT": {
    "BTC": { // Base asset
      "MIN": 0.010,
      "MAX": 0.015,
      "STEP": 0.005
    }
  }
  
  ...
}
```

To declare multiple base assets, you simply add another key/value json entry to the `INVESTMENT` object.
Here is an example of two base assets (BTC and USDT) being configured:

```json
// config.json
{
  ...
  
  "INVESTMENT": {
    "BTC": {
      "MIN": 0.010, // only applies to BTC
      "MAX": 0.015,
      "STEP": 0.005
    },
    "USDT": {
      "MIN": 250, // only applies to USDT
      "MAX": 500,
      "STEP": 10
    }
  },
  
  ...
}
```