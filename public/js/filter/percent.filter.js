angular
    .module('filters')
    .filter('percentFilter', PercentFilter);

PercentFilter.$inject = [];

function PercentFilter() {
    return function(items, minProfit) {

        return items.filter(function(item) {
            if (minProfit === null || minProfit === undefined) return true;
            return item.calculated.percent >= minProfit;
        });

    }

}