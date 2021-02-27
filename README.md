# Binance Triangle Arbitrage

<div style="text-align: center;">
    <img src="https://github.com/bmino/binance-triangle-arbitrage/blob/master/src/resources/mainDisplay.png" alt="Main HUD display">
</div>

This app monitors the [Binance](https://www.binance.com) cryptocurrency exchange in search of triangle arbitrage opportunities.

## The HUD
The HUD is the chart displayed above. It is repainted after each calculation cycle to show snapshots of currently detected
arbitrage opportunities. To disable the HUD, set `HUD.ENABLED` to false.


### Reading the HUD
* **Trade** - Three symbols related by exchange rates that are involved in the triangle arbitrage.
* **Profit** - Percent profit or loss from executing the triangle arbitrage. This includes trading fees specified via `EXECUTION.FEE` config.
* **AB Age** - Time in milliseconds since the most recent update of the market ticker relating the first and second symbols in the arbitrage.
* **BC Age** - Time in milliseconds since the most recent update of the market ticker relating the second and third symbols in the arbitrage.
* **CA Age** - Time in milliseconds since the most recent update of the market ticker relating the third and first symbols in the arbitrage.
* **Age** - Time in milliseconds since the least recently updated market ticker involved in the triangle arbitrage.


## Getting Started
These instructions will get a copy of the project up and running on your local machine for development and testing purposes.


### Install Prerequisites
The following dependencies are recommended to run an instance:

1. **NodeJS** - 14.15.4
2. **Npm** - 6.14.10


### Obtain the Codebase
* Clone from github
    ```
    git clone https://github.com/bmino/binance-triangle-arbitrage.git
    ```
* Download a zip of the [latest release](https://github.com/bmino/binance-triangle-arbitrage/releases/latest)


### Configuration
All configuration is managed inside the `/config` directory.
To setup your configuration for the first time, duplicate the `config.json.example` file and remove the ".example" extension.
This process must be done before deploying the app for the first time and redone after each major version update where the configuration has changed.
Explanations of each value can be found [here](config/README.md).

### Assumptions
1. All fees are [paid via BNB balance](https://binance.zendesk.com/hc/en-us/articles/115000583311)
2. Sufficient quantity of BNB is maintained during the runtime of the bot

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


## Execution Strategies
There are two supported methods of executing an identified triangle arbitrage opportunity.
More details [here](src/resources/docs/strategies.md)

* **Linear** - Execute three trades sequentially with each being initiated after the previous has completed
* **Parallel** - Execute three trades asynchronously with each being initiated at the same time


## Logging
All logs are stored in the `/logs` directory. The log level is set via the `LOG.LEVEL` configuration property.

* **performance.log** - Data about performance and speed
* **execution.log** - Market interactions and profits
* **binance.log** - Binance api logging


## Authors
* **[Brandon Mino](https://github.com/bmino)** - *Project Lead*

See also the list of [contributors](https://github.com/bmino/binance-triangle-arbitrage/contributors) who participated in this project.


## Donations
The developers listed above created and maintain this project for free.
I don't expect any compensation, but if you appreciate my work feel free to donate to the following addresses:

* Ethereum (ERC20): 0xFd7b8597cF8eE5317439B0B5C55a111F6Eec449D

## License
This project is licensed under mit

