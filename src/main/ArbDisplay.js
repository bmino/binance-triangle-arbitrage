const MarketCache = require('./MarketCache');
const config = require('../../config/live.config');

let CLI = require('clui');
let clc = require('cli-color');


let ArbDisplay = {

    displayArbs(arbs) {
        console.clear();
        let now = new Date();

        let outputBuffer = new CLI.LineBuffer({
            x: 0,
            y: 0,
            width: 'console',
            height: 'console'
        });

        new CLI.Line(outputBuffer)
            .column(`Current time: ${now.toLocaleString('en-US')}`, 40, [clc.white])
            .fill()
            .store();

        let threshold = Math.ceil(config.DEPTH_SIZE / 2);
        new CLI.Line(outputBuffer)
            .column(`${MarketCache.getDepthsBelowThreshold(threshold).length}/${Object.keys(MarketCache.depths).length} depth caches below a threshold of ${threshold}`, 55, [clc.white])
            .fill()
            .store();

        new CLI.Line(outputBuffer).fill().store();

        // Header
        new CLI.Line(outputBuffer)
            .column('Trade', 17, [clc.cyan])
            .column('Profit', 11, [clc.cyan])
            .column('AB Time', 15, [clc.cyan])
            .column('BC Time', 15, [clc.cyan])
            .column('CA Time', 15, [clc.cyan])
            .column('Age', 7, [clc.cyan])
            .fill()
            .store();

        // Data
        arbs.forEach(arb => {
            new CLI.Line(outputBuffer)
                // ID
                .column(`${arb.trade.symbol.a}-${arb.trade.symbol.b}-${arb.trade.symbol.c}`, 17)

                // Profit
                .column(`${arb.percent.toFixed(4)}%`, 11)

                // Time of Last Tick
                .column(`${new Date(arb.times.ab).toLocaleTimeString('en-US')}`, 15)
                .column(`${new Date(arb.times.bc).toLocaleTimeString('en-US')}`, 15)
                .column(`${new Date(arb.times.ca).toLocaleTimeString('en-US')}`, 15)

                // Age
                .column(`${((now - arb.time)/1000).toFixed(2)}`, 7)

                .fill()
                .store();
        });

        outputBuffer.output();
    }

};

module.exports = ArbDisplay;
