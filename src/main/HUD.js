const MarketCache = require('./MarketCache');
const blessed = require('blessed');

module.exports = {

    screen: null,
    objects: {
        arbTable: null,
        depthTable: null
    },
    headers: {
        arb: ['Trade', 'Profit', 'AB Age', 'BC Age', 'CA Age', 'Age'],
        depth: ['Ticker', 'Bids', 'Asks']
    },

    initScreen() {
        if (this.screen) return;
        this.screen = blessed.screen({
            smartCSR: true
        });
    },

    displayArbs(arbs) {
        this.initScreen();
        if (!this.objects.arbTable) {
            this.objects.arbTable = blessed.table({
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

            this.screen.append(this.objects.arbTable);
        }

        const now = new Date().getTime();

        let tableData = [this.headers.arb];
        arbs.forEach(arb => {
            tableData.push([
                `${arb.id}`,
                `${arb.percent.toFixed(4)}%`,
                `${((now - arb.times.ab)/1000).toFixed(2)}`,
                `${((now - arb.times.bc)/1000).toFixed(2)}`,
                `${((now - arb.times.ca)/1000).toFixed(2)}`,
                `${((now - Math.min(arb.times.ab, arb.times.bc, arb.times.ca))/1000).toFixed(2)}`
            ]);
        });

        this.objects.arbTable.setData(tableData);
        this.screen.render();
    },

    displayDepths() {
        this.initScreen();
        if (!this.objects.depthTable) {
            this.objects.depthTable = blessed.table({
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

            this.screen.append(this.objects.depthTable);
        }

        let tableData = [this.headers.depth];
        MarketCache.getDepthCache().forEach(depth => {
            tableData.push([
                `${depth.ticker}`,
                `${Object.keys(depth.bids).length}`,
                `${Object.keys(depth.asks).length}`
            ]);
        });

        this.objects.depthTable.setData(tableData);
        this.screen.render();
    }

};
