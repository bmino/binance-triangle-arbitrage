let MarketCache = require('./MarketCache');
let BinanceApi = require('./BinanceApi');
let MarketCalculation = require('./MarketCalculation');


const CONFIG = {
    INVESTMENT: {
        MIN: 0.0,
        MAX: 0.2,
        STEP: 0.001
    },
    BASE_SYMBOL: 'BTC',
    SCAN_INTERVAL: 30000
};

// Set up symbols and tickers
BinanceApi.exchangeInfo().then((data) => {

    let symbols = new Set();
    let tickers = [];

    // Extract Symbols and Tickers
    data.symbols.forEach(function(symbolObj) {
        if (symbolObj.status !== 'TRADING') return;
        symbols.add(symbolObj.baseAsset);
        symbolObj.dustQty = parseFloat(symbolObj.filters[1].minQty);
        tickers[symbolObj.symbol] = symbolObj;
    });

    // Initialize market cache
    MarketCache.symbols = symbols;
    MarketCache.tickers = tickers;


    // Shrink tickers for testing
    // let tickerSubset = {};
    // Object.keys(tickers).slice(0, 150).forEach((ticker) => {
    //     tickerSubset[ticker] = tickers[ticker];
    // });
    // MarketCache.tickers = tickerSubset;

    // Listen for depth updates
    BinanceApi.listenForDepthCache(MarketCache.getTickerArray(), (ticker, depth) => {
        MarketCache.depths[ticker] = depth;
    });

    let intervalHandle = setInterval(calculateArbitrage, CONFIG.SCAN_INTERVAL);
})
    .catch((error) => {
        console.error(error);
        console.log(error.message);
    });


function calculateArbitrage() {
    let startTime = new Date();
    console.log(`\nScanning for arbitrage opportunities`);
    let relationships = [];
    MarketCache.symbols.forEach(function(symbol2) {
        MarketCache.symbols.forEach(function(symbol3) {
            let relationship = MarketCalculation.relationships(CONFIG.BASE_SYMBOL, symbol2, symbol3);
            if (relationship) {
                relationship.calculated = MarketCalculation.optimizeAndCalculate(relationship, CONFIG.INVESTMENT.MIN, CONFIG.INVESTMENT.MAX, CONFIG.INVESTMENT.STEP);
                if (relationship.calculated) {
                    relationships.push(relationship);
                    console.log(`Profit of ${relationship.calculated.percent} on ${relationship.id}`);
                }
            }
        });
    });
    console.log(`Took ${(new Date() - startTime)/1000} seconds`);
}
