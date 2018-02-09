angular
    .module('controllers')
    .controller('binanceController', BinanceController);

BinanceController.$inject = ['$scope', '$interval', 'binanceService'];

function BinanceController($scope, $interval, binanceService) {

    $scope.CONFIG = {
        BASE: {
            SYMBOL: 'BTC',
            SYMBOLS: ['BTC', 'ETH', 'BNB', 'USDT']
        },
        INVESTMENT: {
            MIN: 0,
            MAX: 0.30,
            STEP: 0.0001,
            STEP_DEFAULT: {
                'BTC': 0.0001,
                'ETH': 0.001,
                'BNB': 0.1,
                'USDT': 1
            }
        },
        VOLUME: {
            MAX: 1.00
        },
        PROFIT: {
            MIN: 0.15
        },
        CYCLE: {
            INTERVAL: 30,
            LAST_CALL_TIME: 0,
            DELAY: 0,
            HANDLE: null
        },
        TABLE: {
            SORT: '-calculated.percent'
        },
        RATE_LIMIT: {
            TYPE: binanceService.QUERIES
        }
    };

    $scope.trades = [];
    $scope.history = [];

    $scope.LOADING = {
        API: binanceService.LOADING,
        OPTIMIZATION: false
    };

    $scope.percentRequestWeightRemaining = 100;
    $scope.currentTrade = null;
    var tickCycle = null;
    var searchCycle = null;

    function init() {
        trackRequests();
        trackSearchCycle();
    }

    $scope.findArbitrage = function() {
        if (binanceService.getSymbols().length === 0) return;
        $scope.CONFIG.CYCLE.LAST_CALL_TIME = new Date().getTime();

        return analyzeSymbolsForArbitrage($scope.CONFIG.BASE.SYMBOL)
            .then(function(foundTrades) {
                $scope.trades = foundTrades.filter(function(t) {
                    return t.calculated && t.calculated.percent > $scope.CONFIG.PROFIT.MIN;
                });
                console.log('Found ' + $scope.trades.length + '/' + foundTrades.length + ' trades with profit > ' + $scope.CONFIG.PROFIT.MIN + '%');
                $scope.history = $scope.history.concat($scope.trades);
                return foundTrades;
            })
            .catch(console.error);
    };

    function analyzeSymbolsForArbitrage(baseSymbol) {
        $scope.LOADING.OPTIMIZATION = true;
        console.log('\nOptimizing...');
        var before = new Date().getTime();

        return binanceService.analyze($scope.CONFIG.INVESTMENT.MIN, $scope.CONFIG.INVESTMENT.MAX, $scope.CONFIG.INVESTMENT.STEP, baseSymbol)
            .then(function(trades) {
                var calculationCount = Math.ceil(($scope.CONFIG.INVESTMENT.MAX - $scope.CONFIG.INVESTMENT.MIN) / $scope.CONFIG.INVESTMENT.STEP) * trades.length;
                var optimizationSeconds = (new Date().getTime() - before) / 1000;
                console.log('Total Seconds:      ' + optimizationSeconds.toString());
                console.log('Calculations/Sec:   ' + (calculationCount / optimizationSeconds).toFixed(0));
                console.log('Average ms:         ' + (optimizationSeconds / calculationCount * 1000).toFixed(5));
                return trades;
            })
            .catch(console.error)
            .finally(function() {
                $scope.LOADING.OPTIMIZATION = false;
            });
    }

    $scope.setCurrentTrade = function(trade) {
        $scope.currentTrade = trade;
    };

    $scope.removeTrade = function(trade) {
        if ($scope.CONFIG.CYCLE.HANDLE) $scope.history.splice($scope.history.indexOf(trade), 1);
        else $scope.trades.splice($scope.trades.indexOf(trade), 1);
    };

    $scope.updateStepSize = function(newSymbol) {
        if ($scope.CONFIG.BASE.SYMBOL === newSymbol) return;
        $scope.CONFIG.BASE.SYMBOL = newSymbol;
        $scope.CONFIG.INVESTMENT.STEP = $scope.CONFIG.INVESTMENT.STEP_DEFAULT[newSymbol] || 0.05;

    };

    function trackRequests() {
        var tick = function() {
            $scope.percentRequestWeightRemaining = $scope.CONFIG.RATE_LIMIT.TYPE.REQUEST.REMAINING() / $scope.CONFIG.RATE_LIMIT.TYPE.REQUEST.MINUTE_LIMIT * 100;
        };
        tickCycle = $interval(tick, 500);
    }

    function trackSearchCycle() {
        var tick = function() {
            $scope.CONFIG.CYCLE.DELAY = $scope.CONFIG.CYCLE.INTERVAL - Math.floor(((new Date().getTime() - $scope.CONFIG.CYCLE.LAST_CALL_TIME) / 1000));
        };
        searchCycle = $interval(tick, 500);
    }

    $scope.startArbitrageCycle = function() {
        $scope.CONFIG.CYCLE.DELAY = $scope.CONFIG.CYCLE.INTERVAL;
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
        $interval.cancel(searchCycle);
        tickCycle = null;
        searchCycle = null;
    });
    
    init();

}
