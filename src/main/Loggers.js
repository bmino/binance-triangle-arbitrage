const simpleNodeLogger = require('simple-node-logger');
const fs = require('fs');
const logs = `${__dirname}/../../logs`;

// Ensure Log Directory Exists
if (!fs.existsSync(logs)){
    fs.mkdirSync(logs);
}

module.exports = {
    research: simpleNodeLogger.createSimpleFileLogger(`${logs}/research.log`),
    performance: simpleNodeLogger.createSimpleFileLogger(`${logs}/performance.log`)
};
