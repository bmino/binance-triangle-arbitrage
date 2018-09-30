const CONFIG = require('../../config/live.config');
const logger = require('./Loggers');
const BinanceApi = require('./BinanceApi');

let ArbitrageExecution = {

    executeCalculatedPosition(calculated) {
        const oldestUpdateTime = Math.min(calculated.times.ab, calculated.times.bc, calculated.times.ca);

        if (calculated.percent < CONFIG.TRADING.PROFIT_THRESHOLD) return false;
        if (oldestUpdateTime > CONFIG.TRADING.AGE_THRESHOLD) return false;

        if (!CONFIG.TRADING.ENABLED) {
            // Would trade if switch was enabled
            logger.research.info(`${calculated.id}: ${calculated.percent.toFixed(3)}% - aged ${((new Date().getTime() - oldestUpdateTime)/1000).toFixed(2)} seconds`);
            return false;
        }

        return Promise.all([
            marketBuyOrSell(calculated.trade.ab.method)(calculated.trade.ab.ticker, calculated.ab.market),
            marketBuyOrSell(calculated.trade.bc.method)(calculated.trade.bc.ticker, calculated.bc.market),
            marketBuyOrSell(calculated.trade.ca.method)(calculated.trade.ca.ticker, calculated.ca.market)
        ])
            .then(results => {
                // TODO: Calculate profit
                // TODO: Log results
            })
            .catch(console.error);
    }

};

function marketBuyOrSell(method) {
    return method === 'Buy' ? BinanceApi.marketBuy : BinanceApi.marketSell;
}

module.exports = ArbitrageExecution;
