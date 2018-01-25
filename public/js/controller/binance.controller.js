angular
    .module('controllers')
    .controller('binanceController', BinanceController);

BinanceController.$inject = ['$scope', '$interval', 'binanceService'];

function BinanceController($scope, $interval, binanceService) {

    $scope.CONFIG = {
        BASE_SYMBOL: '',
        INVESTMENT: {
            MIN: 50,
            MAX: 500
        },
        VOLUME: {
            MAX: 1.00
        },
        PROFIT: {
            MIN: 0.15
        },
        CYCLE: {
            INTERVAL: 30,
            HANDLE: null
        },
        TABLE: {
            SORT: '-calculated.percent'
        },
        showTable: true
    };

    $scope.HISTORY = [];

    $scope.LOADING = {
        API: binanceService.LOADING,
        ARBITRAGE: false
    };
    $scope.RATE_LIMIT = {
        TYPE: binanceService.QUERIES
    };

    $scope.percentRequestWeightRemaining = 100;
    $scope.currentTrade = null;
    var tickCycle = null;

    function init() {
        trackRequests();
    }

    $scope.findArbitrage = function() {
        if (binanceService.getSymbols().length === 0) return;
        $scope.LOADING.ARBITRAGE = true;

        binanceService.refreshAllOrderBooks()
            .then(function() {
                var symbols = binanceService.getSymbols();
                return analyzeSymbolsForArbitrage(symbols, $scope.CONFIG.BASE_SYMBOL);
            })
            .then(function(trades) {
                var profitFilteredTrades = trades.filter(function(t) {
                    return t.calculated.percent > $scope.CONFIG.PROFIT.MIN;
                });
                console.log('Found ' + profitFilteredTrades.length + '/' + trades.length + ' trades with profit > ' + $scope.CONFIG.PROFIT.MIN + '%');
                $scope.HISTORY = $scope.HISTORY.concat(profitFilteredTrades);
                return trades;
            })
            .catch(console.error)
            .finally(function() {
                $scope.LOADING.ARBITRAGE = false;
            });
    };

    function analyzeSymbolsForArbitrage(symbols, baseSymbols) {
        console.log('Optimizing...');
        var before = new Date().getTime();

        if (typeof baseSymbols === 'string') baseSymbols = [baseSymbols];
        baseSymbols = baseSymbols.filter(function(s) {return s && s.length;});
        if (baseSymbols.length === 0) baseSymbols = symbols;

        var relationships = [];
        baseSymbols.forEach(function(symbol1) {
            symbols.forEach(function(symbol2) {
                symbols.forEach(function(symbol3) {
                    var relationship = binanceService.relationships(symbol1, symbol2, symbol3);
                    if (relationship) {
                        relationship.calculated = binanceService.optimizeAndCalculate(relationship, $scope.CONFIG.INVESTMENT.MAX, $scope.CONFIG.INVESTMENT.MAX);
                        relationships.push(relationship);
                    }
                });
            });
        });
        console.log('Optimized in ' + ((new Date().getTime() - before) / 1000).toString() + ' seconds');
        return relationships;
    }

    $scope.setCurrentTrade = function(trade) {
        $scope.currentTrade = trade;
    };

    $scope.removeTrade = function(trade) {
        $scope.HISTORY.splice($scope.HISTORY.indexOf(trade), 1);
    };

    function trackRequests() {
        var tick = function() {
            $scope.percentRequestWeightRemaining = $scope.RATE_LIMIT.TYPE.REQUEST.REMAINING() / $scope.RATE_LIMIT.TYPE.REQUEST.MINUTE_LIMIT * 100;
        };
        tickCycle = $interval(tick, 500);
    }

    $scope.startArbitrageCycle = function() {
        $scope.CONFIG.CYCLE.HANDLE = $interval($scope.findArbitrage, 1000 * $scope.CONFIG.CYCLE.INTERVAL);
        $scope.findArbitrage();
    };

    $scope.stopArbitrageCycle = function() {
        $interval.cancel($scope.CONFIG.CYCLE.HANDLE);
        $scope.CONFIG.CYCLE.HANDLE = null;
    };

    $scope.$on('$destroy', function() {
        $scope.stopArbitrageCycle();
        $interval.cancel(tickCycle);
        tickCycle = null;
    });
    
    init();

}
