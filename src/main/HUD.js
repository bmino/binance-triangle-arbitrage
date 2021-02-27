const blessed = require('blessed');

const HUD = {

    screen: null,
    objects: {
        calculationTable: null
    },

    initScreen() {
        if (HUD.screen) return;
        HUD.screen = blessed.screen({
            smartCSR: true
        });
    },

    displayTopCalculations(calculations, rowCount=10) {
        HUD.initScreen();
        if (!HUD.objects.calculationTable) {
            HUD.objects.calculationTable = blessed.table({
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

            HUD.screen.append(HUD.objects.calculationTable);
        }

        const now = Date.now();

        let tableData = [['Trade', 'Profit', 'AB Age', 'BC Age', 'CA Age', 'Age']];

        Object.values(calculations)
            .filter(({depth: {ab, bc, ca}}) => ab.eventTime && bc.eventTime && ca.eventTime)
            .sort((a, b) => a.percent > b.percent ? -1 : 1)
            .slice(0, rowCount)
            .forEach(({ trade, percent, depth }) => {
                tableData.push([
                    `${trade.symbol.a}-${trade.symbol.b}-${trade.symbol.c}`,
                    `${percent.toFixed(4)}%`,
                    `${now - depth.ab.eventTime}`,
                    `${now - depth.bc.eventTime}`,
                    `${now - depth.ca.eventTime}`,
                    `${now - Math.min(depth.ab.eventTime, depth.bc.eventTime, depth.ca.eventTime)}`
                ]);
            });

        HUD.objects.calculationTable.setData(tableData);
        HUD.screen.render();
    }

};

module.exports = HUD;
