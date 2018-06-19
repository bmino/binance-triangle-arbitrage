const MarketCache = require('./MarketCache');
const config = require('../../config/live.config');
const blessed = require('blessed');


let ArbDisplay = {

    screen: null,
    table: null,
    tableHeaders: ['Trade', 'Profit', 'AB Time', 'BC Time', 'CA Time', 'Age'],

    setupTable() {
        ArbDisplay.screen = blessed.screen({
            smartCSR: true
        });

        ArbDisplay.table = blessed.table({
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

        ArbDisplay.screen.append(ArbDisplay.table);
    },

    displayArbs(arbs) {
        if (!ArbDisplay.table) ArbDisplay.setupTable();

        let now = new Date().getTime();

        let tableData = [ArbDisplay.tableHeaders];
        arbs.forEach(arb => {
            tableData.push([
                `${arb.trade.symbol.a}-${arb.trade.symbol.b}-${arb.trade.symbol.c}`,
                `${arb.percent.toFixed(4)}%`,
                `${new Date(arb.times.ab).toLocaleTimeString('en-US')}`,
                `${new Date(arb.times.bc).toLocaleTimeString('en-US')}`,
                `${new Date(arb.times.ca).toLocaleTimeString('en-US')}`,
                `${((now - arb.time)/1000).toFixed(2)}`
            ]);
        });

        ArbDisplay.table.setData(tableData);
        ArbDisplay.screen.render();
    }

};

module.exports = ArbDisplay;
