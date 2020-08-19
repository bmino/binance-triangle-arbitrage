const Util = {
    sum: (array) => {
        return array.reduce((sum, val) => sum + val, 0);
    },

    average: (array) => {
        return Util.sum(array) / array.length
    },

    prune: (object, threshold) => {
        return Object.keys(object)
            .slice(0, threshold)
            .reduce((prunedObject, key) => {
                prunedObject[key] = object[key];
                return prunedObject;
            }, {});
    },
};

module.exports = Util;