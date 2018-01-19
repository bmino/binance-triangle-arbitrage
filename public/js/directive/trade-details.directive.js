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
            maxInvestment: '=',
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
            scope.optimizeAndSet(scope.trade)
                .then(function(metrics) {
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
                        });
                })
                .then(binanceService.accountInformation)
                .then(updateBalancesAndCalculateDifference)
                .then(function(differences) {
                    return calculateGain(scope.trade.symbol.a, differences);
                })
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
                var convertRate = binanceService.convertRate(balance.asset, 'USDT');
                // Assume we had none before
                var newBalance = parseFloat(balance.free) + parseFloat(balance.locked);
                var difference = {
                    asset: balance.asset,
                    change: newBalance,
                    changeUSD: convertRate * newBalance,
                    percentChange: 100.000
                };
                // Check if we did have some of this asset before
                scope.balances.forEach(function(previousBalance) {
                    var oldBalance = parseFloat(previousBalance.free) + parseFloat(previousBalance.locked);
                    if (previousBalance.asset === balance.asset) {
                        difference.change = newBalance - oldBalance;
                        difference.changeUSD = convertRate * (newBalance - oldBalance);
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

        function calculateGain(symbol, differences) {
            var totalChange = 0;
            differences.forEach(function(difference) {
                totalChange += binanceService.convertRate(difference.asset, symbol) * difference.change;
            });
            console.log('Calculated total change of ' + totalChange + ' ' + symbol);
            console.log('Calculated total change of ' + binanceService.convertRate(symbol, 'USDT') * totalChange + ' (USD)');
            return totalChange;
        }

        scope.generateLink = function(a, b) {
            return binanceService.generateLink(a, b);
        };

        scope.apiKeyPresent = function() {
            return binanceService.API.KEY && binanceService.API.SECRET;
        };

        scope.optimizeAndSet = function(trade) {
            scope.REFRESHING = true;
            return Promise.all([
                binanceService.refreshOrderBook(trade.ab.ticker),
                binanceService.refreshOrderBook(trade.bc.ticker),
                binanceService.refreshOrderBook(trade.ca.ticker)
            ])
                .then(function(orderBooks) {
                    var calculated = binanceService.optimizeAndCalculate(trade, scope.maxInvestment);
                    scope.investment = calculated.start.initialUSDT;
                    scope.calculated = calculated;
                    return calculated;
                })
                .catch(console.error)
                .finally(function() {
                    scope.REFRESHING = false;
                });
        };

        scope.calculate = function(investmentUSDT, trade) {
            return binanceService.calculate(investmentUSDT, trade);
        };

        init();

    }

    return directive;

}
