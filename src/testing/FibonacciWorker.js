module.exports = function(input, done, progress) {
    let before = new Date().getTime();
    const result = fib(input);
    let after = new Date().getTime();

    progress(after - before);
    done(result);
};

function fib(num) {
    if (num < 2) return num;
    return fib(num-1) + fib(num-2);
}
