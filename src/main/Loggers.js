const pino = require('pino');

const LOG_DIR = `${__dirname}/../../logs`;
const PINO_OPTS = {
    useLevelLabels: true,
    base: null
};

const now = new Date();
const LOG_FILE_APPENDIX = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

module.exports = {
    'performance': pino(PINO_OPTS, pino.destination(`${LOG_DIR}/performance.log`)),
    'execution': pino(PINO_OPTS, pino.destination(`${LOG_DIR}/execution.log`))
};
