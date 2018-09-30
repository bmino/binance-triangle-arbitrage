const CONFIG = require('../../config/config');
const logger = require('./Loggers');
const BinanceApi = require('./BinanceApi');

let ArbitrageExecution = {
    inProgressIds: new Set(),

    executeCalculatedPosition(calculated) {
        const ageInMilliseconds = new Date().getTime() - Math.min(calculated.times.ab, calculated.times.bc, calculated.times.ca);

        if (calculated.percent < CONFIG.TRADING.PROFIT_THRESHOLD) return false;
        if (ageInMilliseconds > CONFIG.TRADING.AGE_THRESHOLD) return false;
        if (ArbitrageExecution.inProgressIds.has(calculated.id)) {
            console.log(`${calculated.id} already in progress`);
            return false;
        }

        if (!CONFIG.TRADING.ENABLED) {
            // Would trade if switch was enabled
            logger.research.info(`${calculated.id}: ${calculated.percent.toFixed(3)}% - aged ${ageInMilliseconds.toFixed(2)} seconds`);
            return false;
        }

        ArbitrageExecution.inProgressIds.add(calculated.id);

        return Promise.all([
            marketBuyOrSell(calculated.trade.ab.method)(calculated.trade.ab.ticker, calculated.ab.market),
            marketBuyOrSell(calculated.trade.bc.method)(calculated.trade.bc.ticker, calculated.bc.market),
            marketBuyOrSell(calculated.trade.ca.method)(calculated.trade.ca.ticker, calculated.ca.market)
        ])
            .then(results => {
                // TODO: Calculate profit
                // TODO: Log results
            })
            .catch(console.error)
            .then(() => {
                ArbitrageExecution.inProgressIds.delete(calculated.id);
            });
    }

};

function marketBuyOrSell(method) {
    return method === 'Buy' ? BinanceApi.marketBuy : BinanceApi.marketSell;
}

module.exports = ArbitrageExecution;
