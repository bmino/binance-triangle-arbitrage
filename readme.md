# Binance Triangle Arbitrage

<p align="center">
    <img src="https://github.com/bmino/binance-triangle-arbitrage/blob/master/src/resources/mainDisplay.png">
</p>

This app monitors the [Binance](https://www.binance.com) cryptocurrency exchange in search of triangle arbitrage opportunities.

### The HUD
The HUD is the chart displayed above. It can be painted at a configurable interval to show snapshots of currently detected
arbitrage opportunities.

#### Reading the HUD
* **Trade** - Symbols involved in the triangle arbitrage. The first must be converted into the second, which must be converted into the third, and then back to the first.
* **Profit** - Percent profit or loss from executing the triangle arbitrage. This does not include trading fees.
* **AB Time** - Timestamp of the most recent market update for the ticker relating the first and second symbols in the arbitrage.
* **BC Time** - Timestamp of the most recent market update for the ticker relating the second and third symbols in the arbitrage.
* **CA Time** - Timestamp of the most recent market update for the ticker relating the third and first symbols in the arbitrage.
* **Age** - Time in seconds since the least recently updated market ticker involved in the triangle arbitrage.


## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.


### Installing Prerequisites

The following dependencies are required to run an instance:

1. NodeJS
2. Npm

Install NodeJS and npm

```
brew install node
```


## Deployment

Clone the code from github
```
git clone https://github.com/bmino/binance-triangle-arbitrage.git
```

Build the project from the root directory
```
npm install
```

Start the application
```
npm run live
```


## Configuration

All configuration is done inside the `/config` directory.
To setup your configuration for the first time, duplicate each of the `*.example` files, remove the ".example" extension, and fill in the appropriate information.


## Authors

* **[Brandon Mino](https://github.com/bmino)** - *Project Lead*

See also the list of [contributors](https://github.com/bmino/binance-triangle-arbitrage/contributors) who participated in this project.


## License

This project is licensed under mit
