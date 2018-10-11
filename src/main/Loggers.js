const fs = require('fs');
const logs = `${__dirname}/../../logs`;

// Ensure Log Directory Exists
if (!fs.existsSync(logs)){
    fs.mkdirSync(logs);
}

const options = {flags:'a'};
const stream = {
    'performance': fs.createWriteStream(`${logs}/performance.log`, options),
    'execution': fs.createWriteStream(`${logs}/execution.log`, options)
};

module.exports = {
    'performance': {
        log(data) {
            return doLog(data, stream.performance);
        }
    },
    'execution': {
        log(data) {
            return doLog(data, stream.execution);
        }
    }
};

function doLog(data, stream) {
    let timestamp = `${new Date().toLocaleString()}`;
    if (typeof data === 'object') return stream.write(`${timestamp} | ${JSON.stringify(data)}\n`);
    else return stream.write(`${timestamp} | ${data}\n`);
}