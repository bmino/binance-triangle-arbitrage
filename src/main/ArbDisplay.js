const MarketCache = require('./MarketCache');
const CONFIG = require('../../config/config');
const blessed = require('blessed');


let ArbDisplay = {

    screen: null,
    objects: {
        arbTable: null,
        depthTable: null
    },
    headers: {
        arb: ['Trade', 'Profit', 'AB Time', 'BC Time', 'CA Time', 'Age'],
        depth: ['Ticker', 'Bids', 'Asks']
    },

    initScreen() {
        if (ArbDisplay.screen) return;
        ArbDisplay.screen = blessed.screen({
            smartCSR: true
        });
    },

    displayArbs(arbs) {
        ArbDisplay.initScreen();
        if (!ArbDisplay.objects.arbTable) {
            ArbDisplay.objects.arbTable = blessed.table({
                top: '0',
                left: 'center',
                width: '50%',
                height: '50%',
                border: {
                    type: 'line'
                },
                style: {
                    header: {
                        fg: 'blue',
                        bold: true
                    }
                }
            });

            ArbDisplay.screen.append(ArbDisplay.objects.arbTable);
        }

        const now = new Date().getTime();

        let tableData = [ArbDisplay.headers.arb];
        arbs.forEach(arb => {
            tableData.push([
                `${arb.id}`,
                `${arb.percent.toFixed(4)}%`,
                `${new Date(arb.times.ab).toLocaleTimeString('en-US')}`,
                `${new Date(arb.times.bc).toLocaleTimeString('en-US')}`,
                `${new Date(arb.times.ca).toLocaleTimeString('en-US')}`,
                `${((now - Math.min(arb.times.ab, arb.times.bc, arb.times.ca))/1000).toFixed(2)}`
            ]);
        });

        ArbDisplay.objects.arbTable.setData(tableData);
        ArbDisplay.screen.render();
    },

    displayDepths() {
        ArbDisplay.initScreen();
        if (!ArbDisplay.objects.depthTable) {
            ArbDisplay.objects.depthTable = blessed.table({
                top: '0',
                left: 'center',
                width: '50%',
                height: '50%',
                border: {
                    type: 'line'
                },
                style: {
                    header: {
                        fg: 'blue',
                        bold: true
                    }
                }
            });

            ArbDisplay.screen.append(ArbDisplay.objects.depthTable);
        }

        let tableData = [ArbDisplay.headers.depth];
        MarketCache.getDepthCache().forEach(depth => {
            tableData.push([
                `${depth.ticker}`,
                `${Object.keys(depth.bids).length}`,
                `${Object.keys(depth.asks).length}`
            ]);
        });

        ArbDisplay.objects.depthTable.setData(tableData);
        ArbDisplay.screen.render();
    }

};

module.exports = ArbDisplay;
