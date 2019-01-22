# Binance Triangle Arbitrage

<p align="center">
    <img src="https://github.com/bmino/binance-triangle-arbitrage/blob/master/src/resources/mainDisplay.png">
</p>

This app monitors the [Binance](https://www.binance.com) cryptocurrency exchange in search of triangle arbitrage opportunities.

## The HUD
The HUD is the chart displayed above. It can be painted at a configurable interval to show snapshots of currently detected
arbitrage opportunities. To disable the HUD, set `HUD_REFRESH_INTERVAL` to 0.

### Reading the HUD
* **Trade** - Symbols involved in the triangle arbitrage. The first must be converted into the second, which must be converted into the third, and then back to the first.
* **Profit** - Percent profit or loss from executing the triangle arbitrage. This does not include trading fees.
* **AB Time** - Timestamp of the most recent market update for the ticker relating the first and second symbols in the arbitrage.
* **BC Time** - Timestamp of the most recent market update for the ticker relating the second and third symbols in the arbitrage.
* **CA Time** - Timestamp of the most recent market update for the ticker relating the third and first symbols in the arbitrage.
* **Age** - Time in seconds since the least recently updated market ticker involved in the triangle arbitrage.


## Getting Started

These instructions will get a copy of the project up and running on your local machine for development and testing purposes.

### Install Prerequisites

The following dependencies are recommended to run an instance:

1. **NodeJS** - 9.11.2
2. **Npm** - 6.6.0

### Obtain the Codebase

* Clone from github
    ```
    git clone https://github.com/bmino/binance-triangle-arbitrage.git
    ```
* Download a zip of the [latest release](https://github.com/bmino/binance-triangle-arbitrage/releases/latest)

### Configuration

All configuration is done inside the `/config` directory.
To setup your configuration for the first time, duplicate the `config.js.example` file and remove the ".example" extension.
This process will need to be redone after each major version update where the configuration has changed.

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


## Logging
All logs are stored in the `/logs` directory.
* **performance.log** - Data about performance and speed.
* **execution.log** - Market interactions and profits.


## Authors

* **[Brandon Mino](https://github.com/bmino)** - *Project Lead*

See also the list of [contributors](https://github.com/bmino/binance-triangle-arbitrage/contributors) who participated in this project.


## License

This project is licensed under mit

