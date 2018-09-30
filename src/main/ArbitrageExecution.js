const CONFIG = require('../../config/live.config');
const logger = require('./Loggers');

let ArbitrageExecution = {

    executeCalculatedPosition(calculated) {
        if (calculated.percent < CONFIG.TRADING.PROFIT_THRESHOLD) return;

        if (!CONFIG.TRADING.ENABLED) {
            const oldestUpdateTime = Math.min(calculated.times.ab, calculated.times.bc, calculated.times.ca);
            return logger.research.info(`${calculated.id}: ${calculated.percent.toFixed(3)}% - aged ${((new Date().getTime() - oldestUpdateTime)/1000).toFixed(2)} seconds`);
        }

        // TODO: Check execution conditions
        // TODO: Execute arbitrage position
        // TODO: Calculate profit
        // TODO: Log results

    }

};

module.exports = ArbitrageExecution;
