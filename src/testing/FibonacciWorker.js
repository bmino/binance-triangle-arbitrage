module.exports = function(input, done, progress) {
    let before = new Date().getTime();
    const result = fib(input);

    done(new Date().getTime() - before);
};

function fib(num) {
    if (num < 2) return num;
    return fib(num-1) + fib(num-2);
}
