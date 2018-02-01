angular
    .module('directives')
    .directive('tradeDetails', Trade);

Trade.$inject = ['binanceService'];

function Trade(binanceService) {

    var directive = {
        restrict: 'E',
        templateUrl: '/html/trade-details.html',
        scope: {
            trade: '=',
            minInvestment: '=',
            maxInvestment: '=',
            stepSize: '=',
            maxVolume: '=',
            minProfit: '='
        },
        link: link
    };

    function link(scope, element, attrs) {

        scope.calculated = {};
        scope.balances = {};
        scope.REFRESHING = false;

        function init() {
            scope.investment = 100;
            binanceService.accountInformation()
                .then(function(information) {
                    scope.balances = information.balances;
                })
                .catch(console.error);

            scope.$watch('trade.id', function() {
                scope.executionTime = null;
                scope.optimizeAndSet(scope.trade);
            });
        }

        scope.execute = function() {
            var startTime = null;
            scope.executionTime = null;
            var metrics = scope.optimizeAndSet(scope.trade);
            startTime = new Date();
            if (metrics.percent < scope.minProfit) throw 'Percent ' + metrics.percent.toFixed(2) + '% is too low to execute trade.';
            if (metrics.volume > scope.maxVolume) throw 'Volume ' + metrics.volume.toFixed(2) + '% is too high to execute trade.';
            return performTradeAndVerify(scope.trade.ab.method, scope.calculated.ab.market, scope.trade.ab.ticker)
                .then(function(execution) {
                    return performTradeAndVerify(scope.trade.bc.method, scope.calculated.bc.market, scope.trade.bc.ticker);
                })
                .then(function(execution) {
                    return performTradeAndVerify(scope.trade.ca.method, scope.calculated.ca.market, scope.trade.ca.ticker);
                })
                .then(function(execution) {
                    scope.executionTime = new Date() - startTime;
                    console.log('DONE!');
                })
                .then(binanceService.accountInformation)
                .then(updateBalancesAndCalculateDifference)
                .catch(console.error);
        };

        function performTradeAndVerify(method, amount, ticker) {
            return binanceService.performMarketOrder(method, amount, ticker)
                .catch(function(error) {
                    throw error;
                });
        }

        function updateBalancesAndCalculateDifference(accountInformation) {
            var differences = [];
            console.log('Updating balances and calculating differences...');
            accountInformation.balances.forEach(function(balance) {
                // Assume we had none before
                var newBalance = parseFloat(balance.free) + parseFloat(balance.locked);
                var difference = {
                    asset: balance.asset,
                    change: newBalance,
                    percentChange: 100.000
                };
                // Check if we did have some of this asset before
                scope.balances.forEach(function(previousBalance) {
                    var oldBalance = parseFloat(previousBalance.free) + parseFloat(previousBalance.locked);
                    if (previousBalance.asset === balance.asset) {
                        difference.change = newBalance - oldBalance;
                        difference.percentChange = ((newBalance - oldBalance) / oldBalance * 100).toFixed(3);
                    }
                });
                if (difference.change !== 0) differences.push(difference);
            });
            console.log('Differences');
            console.log(differences);
            scope.balances = accountInformation.balances;
            return differences;
        }

        scope.generateLink = function(a, b) {
            return binanceService.generateLink(a, b);
        };

        scope.apiKeyPresent = function() {
            return binanceService.API.KEY && binanceService.API.SECRET;
        };

        scope.optimizeAndSet = function(trade) {
            scope.REFRESHING = true;
            var calculated = binanceService.optimizeAndCalculate(trade, scope.minInvestment, scope.maxInvestment, scope.stepSize);
            if (calculated) {
                scope.investment = calculated.start.market;
                scope.calculated = calculated;
            }

            scope.REFRESHING = false;
            return calculated;
        };

        scope.calculateAndSet = function(investmentA, trade) {
            var orderBookMap = binanceService.getOrderBookMap();
            var tickers = binanceService.getTickers();
            scope.calculated = binanceService.calculate(investmentA, trade, orderBookMap, tickers);
        };

        init();

    }

    return directive;

}
