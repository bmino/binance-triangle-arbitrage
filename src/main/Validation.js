const logger = require('./Loggers');

const Validation = {

    configuration(CONFIG) {
        console.log(`Checking configuration ...`);

        // KEYS
        if (CONFIG.KEYS.API === '' && CONFIG.EXECUTION.ENABLED) {
            const msg = `Trade executions will fail without an api key (KEY.API)`;
            logger.execution.warn(msg);
        }
        if (CONFIG.KEYS.SECRET === '' && CONFIG.EXECUTION.ENABLED) {
            const msg = `Trade executions will fail without an api secret (KEY.SECRET)`;
            logger.execution.warn(msg);
        }

        // INVESTMENT
        if (isNaN(CONFIG.INVESTMENT.MIN) || CONFIG.INVESTMENT.MIN <= 0) {
            const msg = `Minimum investment quantity (INVESTMENT.MIN) must be a positive number`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (isNaN(CONFIG.INVESTMENT.MAX) || CONFIG.INVESTMENT.MAX <= 0) {
            const msg = `Maximum investment quantity (INVESTMENT.MAX) must be a positive number`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (isNaN(CONFIG.INVESTMENT.STEP) || CONFIG.INVESTMENT.STEP <= 0) {
            const msg = `Investment step size (INVESTMENT.STEP) must be a positive number`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (CONFIG.INVESTMENT.MIN > CONFIG.INVESTMENT.MAX) {
            const msg = `Minimum investment quantity (INVESTMENT.MIN) cannot be greater than maximum investment quantity (INVESTMENT.MAX)`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (CONFIG.INVESTMENT.MIN !== CONFIG.INVESTMENT.MAX && (CONFIG.INVESTMENT.MIN + CONFIG.INVESTMENT.STEP) > CONFIG.INVESTMENT.MAX) {
            const msg = `Step size (INVESTMENT.STEP) is too large for calculation optimization`;
            logger.execution.warn(msg);
        }

        // SCANNING
        if (!Number.isInteger(CONFIG.SCANNING.DEPTH) || CONFIG.SCANNING.DEPTH <= 0) {
            const msg = `Depth size (SCANNING.DEPTH) must be a positive integer`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (CONFIG.SCANNING.DEPTH > 5000) {
            const msg = `Depth size (SCANNING.DEPTH) cannot be greater than 5000`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (CONFIG.SCANNING.DEPTH > 100 && CONFIG.SCANNING.WHITELIST.length === 0) {
            const msg = `Using a depth size (SCANNING.DEPTH) higher than 100 requires defining a whitelist (SCANNING.WHITELIST)`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (!Array.isArray(CONFIG.SCANNING.WHITELIST)) {
            const msg = `Whitelist (SCANNING.WHITELIST) must be an array`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (CONFIG.SCANNING.WHITELIST.some(sym => typeof sym !== 'string')) {
            const msg = `Whitelist symbols must all be strings`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (CONFIG.SCANNING.WHITELIST.some(sym => sym !== sym.toUpperCase())) {
            const msg = `Whitelist symbols must all be uppercase`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (CONFIG.SCANNING.WHITELIST.length > 0 && !CONFIG.SCANNING.WHITELIST.includes(CONFIG.INVESTMENT.BASE)) {
            const msg = `Whitelist (SCANNING.WHITELIST) must include the base symbol of ${CONFIG.INVESTMENT.BASE}`;
            logger.execution.debug(`Whitelist: [${CONFIG.SCANNING.WHITELIST}]`);
            logger.execution.error(msg);
            throw new Error(msg);
        }

        // EXECUTION
        if (typeof CONFIG.EXECUTION.ENABLED !== 'boolean') {
            const msg = `Execution toggle (EXECUTION.ENABLED) must be a boolean`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (!Number.isInteger(CONFIG.EXECUTION.CAP) || CONFIG.EXECUTION.CAP < 0) {
            const msg = `Execution cap (EXECUTION.CAP) must be a positive integer`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (!['linear', 'parallel'].includes(CONFIG.EXECUTION.STRATEGY)) {
            const msg = `Execution strategy (EXECUTION.STRATEGY) must be one of the following values: linear, parallel]`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (CONFIG.EXECUTION.STRATEGY === 'parallel' && CONFIG.SCANNING.WHITELIST.length === 0) {
            const msg = `Parallel execution requires defining a whitelist (SCANNING.WHITELIST)`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (!CONFIG.EXECUTION.TEMPLATE.every(template => ['BUY', 'SELL', '*'].includes(template))) {
            const msg = `Execution template (EXECUTION.TEMPLATE) can only contain the following values: BUY, SELL, *`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (isNaN(CONFIG.EXECUTION.FEE) || CONFIG.EXECUTION.FEE < 0) {
            const msg = `Execution fee (EXECUTION.FEE) must be a positive number`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (CONFIG.EXECUTION.FEE === 0) {
            const msg = `Execution fee (EXECUTION.FEE) of zero is likely incorrect`;
            logger.execution.warn(msg);
        }
        if (isNaN(CONFIG.EXECUTION.THRESHOLD.PROFIT)) {
            const msg = `Profit threshold (EXECUTION.THRESHOLD.PROFIT) must be a number`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (!Number.isInteger(CONFIG.EXECUTION.THRESHOLD.AGE) || CONFIG.EXECUTION.THRESHOLD.AGE <= 0) {
            const msg = `Age threshold (EXECUTION.THRESHOLD.AGE) must be a positive number`;
            logger.execution.error(msg);
            throw new Error(msg);
        }

        // HUD
        if (typeof CONFIG.HUD.ENABLED !== 'boolean') {
            const msg = `HUD toggle (HUD.ENABLED) must be a boolean`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (!Number.isInteger(CONFIG.HUD.ROWS) || CONFIG.HUD.ROWS <= 0) {
            const msg = `HUD row count (HUD.ROWS) must be a positive integer`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (!Number.isInteger(CONFIG.HUD.REFRESH_RATE) || CONFIG.HUD.REFRESH_RATE <= 0) {
            const msg = `HUD refresh rate (HUD.REFRESH_RATE) must be a positive integer`;
            logger.execution.error(msg);
            throw new Error(msg);
        }

        // LOG
        if (typeof CONFIG.LOG.PRETTY_PRINT !== 'boolean') {
            const msg = `Logging pretty print toggle (LOG.PRETTY_PRINT) must be a boolean`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (isNaN(CONFIG.LOG.STATUS_UPDATE_INTERVAL) || CONFIG.LOG.STATUS_UPDATE_INTERVAL < 0) {
            const msg = `Status update interval (LOG.STATUS_UPDATE_INTERVAL) must be a positive number`;
            logger.execution.error(msg);
            throw new Error(msg);
        }

        // WEBSOCKET
        if (!Number.isInteger(CONFIG.WEBSOCKET.BUNDLE_SIZE) || CONFIG.WEBSOCKET.BUNDLE_SIZE <= 0) {
            const msg = `Websocket bundle size (WEBSOCKET.BUNDLE_SIZE) must be a positive integer`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (CONFIG.WEBSOCKET.BUNDLE_SIZE > 1024) {
            const msg = `Websocket bundle size (WEBSOCKET.BUNDLE_SIZE) cannot be greater than 1024`;
            logger.execution.error(msg);
            throw new Error(msg);
        }
        if (!Number.isInteger(CONFIG.WEBSOCKET.INITIALIZATION_INTERVAL) || CONFIG.WEBSOCKET.INITIALIZATION_INTERVAL < 0) {
            const msg = `Websocket initialization interval (WEBSOCKET.INITIALIZATION_INTERVAL) must be a positive integer`;
            logger.execution.error(msg);
            throw new Error(msg);
        }

        return true;
    }

};

module.exports = Validation;