const binance = require('node-binance-api')();

let BinanceApi = {
    exchangeInfo() {
        console.log('Querying exchangeInfo');
        return new Promise((resolve, reject) => {
            binance.exchangeInfo((error, data) => {
                if (error) return reject(error);
                return resolve(data);
            });
        });
    },

    marketBuy(ticker, quantity) {
        console.log(`Buying ${quantity} ${ticker} @ market price`);
        return new Promise((resolve, reject) => {
            binance.marketBuy(ticker, quantity, (error, response) => {
                if (error) return reject(error);
                return resolve(response);
            })
        })
    },

    marketSell(ticker, quantity) {
        console.log(`Selling ${quantity} ${ticker} @ market price`);
        return new Promise((resolve, reject) => {
            binance.marketSell(ticker, quantity, (error, response) => {
                if (error) return reject(error);
                return resolve(response);
            });
        });
    },

    listenForUserData(balanceCallback, executionCallback) {
        return binance.websockets.userData(balanceCallback, executionCallback);
    },

    depthCache(tickers, limit=100, delay=200) {
        let chain;

        console.log(`Expect ${(tickers.length * delay / 1000).toFixed(0)} seconds to open ${tickers.length} depth websockets.`);

        tickers.forEach(ticker => {
            let promise = () => {
                return new Promise((resolve, reject) => {
                    binance.websockets.depthCache(ticker, processDepth, limit);
                    setTimeout(resolve, delay);
                });
            };
            chain = chain ? chain.then(promise) : promise();
        });
        return chain;
    }

};

function processDepth(symbol, depth) {
    depth.bids = binance.sortBids(depth.bids);
    depth.asks = binance.sortAsks(depth.asks);
    depth.time = new Date().getTime();
}

module.exports = BinanceApi;
