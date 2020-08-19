const logger = require('./Loggers');
const BinanceApi = require('./BinanceApi');

const SpeedTest = {

    ping() {
        logger.performance.debug(`Pinging the Binance API ...`);
        const before = Date.now();
        return BinanceApi.time()
            .then(() => Date.now() - before);
    },

    multiPing(pingCount=5) {
        let pings = [];
        let promiseChain = Promise.resolve();

        for (let i=0; i<pingCount; i++) {
            promiseChain = promiseChain.then(SpeedTest.ping).then((ping) => pings.push(ping));
        }

        return promiseChain.then(() => pings);
    }

};

module.exports = SpeedTest;
