let binance = require('node-binance-api');

if (process.env.BINANCE_API_KEY && process.env.BINANCE_API_SECRET) {
    binance.options({
        APIKEY: process.env.BINANCE_API_KEY,
        APISECRET: process.env.BINANCE_API_SECRET,
        useServerTime: true,
        test: true
    });
}

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

    mockExchangeInfo(tickers) {
        let symbolObjects = tickers.map((ticker) => {return {'symbol': ticker}});
        return Promise.resolve({symbols: symbolObjects});
    },

    marketBuy(ticker, quantity) {
        return new Promise((resolve, reject) => {
            binance.marketBuy(ticker, quantity, (error, response) => {
                if (error) return reject(error);
                return resolve(response);
            })
        })
    },

    marketSell(ticker, quantity) {
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

    listenForDepthCache(tickers, callback, limit=100, CHUNK_SIZE=100, OFFSET=5000) {
        let chain, chunks=[];
        tickers = Array.isArray(tickers) ? tickers : [tickers];
        for (let i=0,len=tickers.length; i<len; i+=CHUNK_SIZE) {
            chunks.push(tickers.slice(i, i+CHUNK_SIZE));
        }
        chunks.forEach(chunk => {
            let promise = () => {return BinanceApi.openDepthCache.apply(this, [chunk, callback, limit, OFFSET])};
            chain = chain ? chain.then(promise) : promise();
        });
        return chain;
    },

    openDepthCache(tickers, callback, limit, delay=0) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                console.log(`Opening ${tickers.length} depth websockets for ${tickers}`);
                tickers.forEach(ticker => {
                    binance.websockets.depthCache(ticker, (symbol, depth) => {
                        depth.bids = binance.sortBids(depth.bids);
                        depth.asks = binance.sortAsks(depth.asks);
                        depth.time = new Date().getTime();
                        callback(symbol, depth);
                    }, limit);
                });
                resolve();
            }, delay);
        });
    }
};

module.exports = BinanceApi;
