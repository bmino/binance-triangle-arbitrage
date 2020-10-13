const blessed = require('blessed');

const HUD = {

    screen: null,
    objects: {
        arbTable: null
    },
    headers: {
        arb: ['Trade', 'Profit', 'AB Age', 'BC Age', 'CA Age', 'Age']
    },

    initScreen() {
        if (HUD.screen) return;
        HUD.screen = blessed.screen({
            smartCSR: true
        });
    },

    displayTopCalculations(calculations, displayCount=10) {
        HUD.initScreen();
        if (!HUD.objects.arbTable) {
            HUD.objects.arbTable = blessed.table({
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

            HUD.screen.append(HUD.objects.arbTable);
        }

        const now = Date.now();

        let tableData = [HUD.headers.arb];

        Object.values(calculations)
            .sort((a, b) => a.percent > b.percent ? -1 : 1)
            .slice(0, displayCount)
            .forEach(calculation => {
                tableData.push([
                    `${calculation.trade.symbol.a}-${calculation.trade.symbol.b}-${calculation.trade.symbol.c}`,
                    `${calculation.percent.toFixed(4)}%`,
                    `${((now - calculation.depth.ab.eventTime)/1000).toFixed(2)}`,
                    `${((now - calculation.depth.bc.eventTime)/1000).toFixed(2)}`,
                    `${((now - calculation.depth.ca.eventTime)/1000).toFixed(2)}`,
                    `${((now - Math.min(calculation.depth.ab.eventTime, calculation.depth.bc.eventTime, calculation.depth.ca.eventTime))/1000).toFixed(2)}`
                ]);
            });

        HUD.objects.arbTable.setData(tableData);
        HUD.screen.render();
    }

};

module.exports = HUD;
