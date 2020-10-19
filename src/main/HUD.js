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

        HUD.objects.calculationTable.setData(tableData);
        HUD.screen.render();
    }

};

module.exports = HUD;
