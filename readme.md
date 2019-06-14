# Binance Triangle Arbitrage

<p align="center">
    <img src="https://github.com/bmino/binance-triangle-arbitrage/blob/master/src/resources/mainDisplay.png">
</p>

This app monitors the [Binance](https://www.binance.com) cryptocurrency exchange in search of triangle arbitrage opportunities.

## The HUD
The HUD is the chart displayed above. It is repainted after each calculation cycle to show snapshots of currently detected
arbitrage opportunities. To disable the HUD, set `HUD.ENABLED` to false.


### Reading the HUD
* **Trade** - Three symbols related by exchange rates that are involved in the triangle arbitrage.
* **Profit** - Percent profit or loss from executing the triangle arbitrage. This does not include trading fees.
* **AB Age** - Time in seconds since the most recent update of the market ticker relating the first and second symbols in the arbitrage.
* **BC Age** - Time in seconds since the most recent update of the market ticker relating the second and third symbols in the arbitrage.
* **CA Age** - Time in seconds since the most recent update of the market ticker relating the third and first symbols in the arbitrage.
* **Age** - Time in seconds since the least recently updated market ticker involved in the triangle arbitrage.

## The Web Interface
* There is a simple apache based web interface to view logs, view the HUD, start & stop the process (hacked to work on a FreeBSD server)
* To start, run it with Gotty
    ```
    gotty -p 3030 npm start
    ```
* **Note** - This is designed to run on a local server, not the public web.


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
More details can be found [here](config/readme.md).


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
There are two supported methods of executing an identified triangle arbitrage opportunity. More details [here](src/resources/docs/strategies.md)

* **Linear** - Three trades are executed sequentially with each being initiated after the first has completed
* **Parallel** - Three trades are executed asynchronously with each being initiated at the same time


## Logging
All logs are stored in the `/logs` directory. The log level is set via the `LOG.LEVEL` configuration property.

* **performance.log** - Data about performance and speed
* **execution.log** - Market interactions and profits


## Authors
* **[Brandon Mino](https://github.com/bmino)** - *Project Lead*

See also the list of [contributors](https://github.com/bmino/binance-triangle-arbitrage/contributors) who participated in this project.


## Donations
The developers listed above created and currently maintain this project for free.
We don't expect any compensation nor donations, but if you appreciate our work feel free to donate to the following addresses:

* Bitcoin (BTC): 1ARWLRA1UDTPKUYx18CVqRJWiFiR9ap7Eh
* Binance Coin (BNB): 0x9aa8af8495f4ed33d3e9d6413cf01144c75f6d4a
* Ether (ETH): 0x9aa8af8495f4ed33d3e9d6413cf01144c75f6d4a


## License
This project is licensed under mit

