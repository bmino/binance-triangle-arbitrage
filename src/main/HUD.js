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
                `${arb.trade.symbol.a}-${arb.trade.symbol.b}-${arb.trade.symbol.c}`,
                `${arb.percent.toFixed(4)}%`,
                `${((now - arb.times.ab)/1000).toFixed(2)}`,
                `${((now - arb.times.bc)/1000).toFixed(2)}`,
                `${((now - arb.times.ca)/1000).toFixed(2)}`,
                `${((now - Math.min(arb.times.ab, arb.times.bc, arb.times.ca))/1000).toFixed(2)}`
            ]);
        });

        HUD.objects.arbTable.setData(tableData);
        HUD.screen.render();
    }

};

module.exports = HUD;
