const BinanceApi = require('./BinanceApi');
const Util = require('./Util');

const SpeedTest = {

    ping() {
        const before = Date.now();
        return BinanceApi.time()
            .then(() => Util.millisecondsSince(before));
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
