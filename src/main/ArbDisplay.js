const MarketCache = require('./MarketCache');

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

        new CLI.Line(outputBuffer).fill().store();

        // Header
        new CLI.Line(outputBuffer)
            .column('Trade', 17, [clc.cyan])
            .column('Profit', 10, [clc.cyan])
            //.column('Time (Local)', 15, [clc.cyan])
            .column('AB Time', 15, [clc.cyan])
            .column(`AB Ticks`, 10, [clc.cyan])
            .column('BC Time', 15, [clc.cyan])
            .column(`BC Ticks`, 10, [clc.cyan])
            .column('CA Time', 15, [clc.cyan])
            .column(`CA Ticks`, 10, [clc.cyan])
            .column('Age', 7, [clc.cyan])
            .fill()
            .store();

        // Data
        arbs.forEach(arb => {
            let abTicker = arb.trade.ab.ticker;
            let bcTicker = arb.trade.bc.ticker;
            let caTicker = arb.trade.ca.ticker;
            new CLI.Line(outputBuffer)
                .column(`${arb.trade.symbol.a}-${arb.trade.symbol.b}-${arb.trade.symbol.c}`, 17)
                .column(`${arb.percent.toFixed(5)}%`, 10)
                //.column(`${new Date(arb.time).toLocaleTimeString('en-US')}`, 15)

                //AB
                .column(`${new Date(arb.times.ab).toLocaleTimeString('en-US')}`, 15)
                .column(`${MarketCache.ticks[abTicker]}`, 10)

                //BC
                .column(`${new Date(arb.times.bc).toLocaleTimeString('en-US')}`, 15)
                .column(`${MarketCache.ticks[bcTicker]}`, 10)

                //CA
                .column(`${new Date(arb.times.ca).toLocaleTimeString('en-US')}`, 15)
                .column(`${MarketCache.ticks[caTicker]}`, 10)

                .column(`${(now - arb.time)/1000}`, 7)
                .fill()
                .store();
        });

        outputBuffer.output();
    }
};

module.exports = ArbDisplay;
