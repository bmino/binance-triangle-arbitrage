const blessed = require('blessed');

const HUD = {

    screen: null,
    objects: {
        arbTable: null
    },
    headers: {
        arb: ['Trade', 'Net Profit', 'Trade Cost', 'AB Age', 'BC Age', 'CA Age', 'Trade Age']
    },

    initScreen() {
        if (HUD.screen) return;
        HUD.screen = blessed.screen({
            smartCSR: true
        });
    },

    displayArbs(arbs) {
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

        const now = new Date().getTime();

        let tableData = [HUD.headers.arb];
        arbs.forEach(arb => {
            tableData.push([
                `${arb.trade.symbol.a}-${arb.trade.symbol.b}-${arb.trade.symbol.c}`, // The trade
                `${arb.percent.toFixed(4)}%`, // The profit %
                `${arb.totalFee}`, // The total fee we would pay
                `${((now - arb.depth.ab.eventTime)/1000).toFixed(2)}`, // AB Age
                `${((now - arb.depth.bc.eventTime)/1000).toFixed(2)}`, // BC Age
                `${((now - arb.depth.ca.eventTime)/1000).toFixed(2)}`, // CA Age
                `${((now - Math.min(arb.depth.ab.eventTime, arb.depth.bc.eventTime, arb.depth.ca.eventTime))/1000).toFixed(2)}` // Trade age
            ]);
        });

        HUD.objects.arbTable.setData(tableData);
        HUD.screen.render();
    }

};

module.exports = HUD;
