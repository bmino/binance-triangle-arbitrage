angular
    .module('services')
    .factory('socket', Socket);

Socket.$inject = ['$rootScope'];

function Socket($rootScope) {

    var socket = io().connect();

    return {
        on: on,
        emit: emit
    };

    function on(eventName, scope, callback) {
        var appliedCallback = function () {
            callback.apply(socket, arguments);
            $rootScope.$evalAsync();
        };
        socket.on(eventName, appliedCallback);

        if (scope) {
            scope.$on('$destroy', function() {
                socket.removeListener(eventName, appliedCallback);
            });
        }
    }

    function emit(eventName, data, callback) {
        socket.emit(eventName, data, function () {
            if (callback) callback.apply(socket, arguments);
            $rootScope.$evalAsync();
        })
    }

}
