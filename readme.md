# Binance Triangle Arbitrage

<p align="center">
    <img src="https://github.com/bmino/binance-triangle-arbitrage/blob/master/src/resources/mainDisplay.png">
</p>

This app monitors the [Binance](https://www.binance.com) cryptocurrency exchange in search of triangle arbitrage opportunities.

## The HUD
The HUD is the chart displayed above. It is repainted after each calculation cycle to show snapshots of currently detected
arbitrage opportunities. To disable the HUD, set `HUD.ENABLED` to false.


### Reading the HUD
* **Trade** - Symbols involved in the triangle arbitrage. The first must be converted into the second, which must be converted into the third, and then back to the first.
* **Profit** - Percent profit or loss from executing the triangle arbitrage. This does not include trading fees.
* **AB Age** - Time in seconds since the most recent update of the market ticker relating the first and second symbols in the arbitrage.
* **BC Age** - Time in seconds since the most recent update of the market ticker relating the second and third symbols in the arbitrage.
* **CA Age** - Time in seconds since the most recent update of the market ticker relating the third and first symbols in the arbitrage.
* **Age** - Time in seconds since the least recently updated market ticker involved in the triangle arbitrage.


## Getting Started
These instructions will get a copy of the project up and running on your local machine for development and testing purposes.


### Install Prerequisites
The following dependencies are recommended to run an instance:

1. **NodeJS** - 11.8.0
2. **Npm** - 6.7.0


### Obtain the Codebase
* Clone from github
    ```
    git clone https://github.com/bmino/binance-triangle-arbitrage.git
    ```
* Download a zip of the [latest release](https://github.com/bmino/binance-triangle-arbitrage/releases/latest)


### Configuration
All configuration is done inside the `/config` directory.
To setup your configuration for the first time, duplicate the `config.json.example` file and remove the ".example" extension.
This process must be done before deploying the app for the first time and redone after each major version update where the configuration has changed.


### Deployment

1. Install project dependencies
    ```
    cd binance-triangle-arbitrage
    npm install
    ```

2. Start the application
    ```
    npm start
    ```


## Execution strategies
There are two different methods of executing an identified triangle arbitrage opportunity.

* **Linear** - Three trades are executed sequentially with each being initiated after the first has completed.
    
    This is easiest to implement and has no special requirements.
    
* **Parallel** - Three trades are executed in tandem with each being initiated at the same time

    This requires `TRADING.WHITELIST` to contain symbols that will be considered for the three symbols.
    Because all trades are executed synchronously, you must hold a balance of every symbol in the whitelist.
    The balance of each symbol should be equivalent or greater than `INVESTMENT.MAX` in terms of the base symbol.


## Logging
All logs are stored in the `/logs` directory. The log level is set via the `LOG.LEVEL` configuration property.

* **performance.log** - Data about performance and speed.
* **execution.log** - Market interactions and profits.


## Authors
* **[Brandon Mino](https://github.com/bmino)** - *Project Lead*

See also the list of [contributors](https://github.com/bmino/binance-triangle-arbitrage/contributors) who participated in this project.


## Donations
The developers listed above created and currently maintain this project for free.
We don't expect any compensation nor donations, but if you appreciate our work feel free to donate to the following addresses:

* Bitcoin (BTC): 1KLBb9qzFN19RxaQwD35CQmnYZvW1819XZ
* Binance Coin (BNB): 0xb046b6991eb1bdc838cae567cff838b542e9f19d


## License
This project is licensed under mit

