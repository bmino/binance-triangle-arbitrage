const threads = require('threads');
threads.config.set({
    basepath: {
        node: __dirname
    }
});

const inputs = [];
for (let i=1; i<432; i++) {
    inputs.push(26);
}

function loop(nums) {
    const before = new Date().getTime();

    const pool = new threads.Pool(1);
    const job = pool.run('FibonacciWorker.js');

    let timings = [];

    nums.forEach(num => {
        job.send(num)
            .on('done', t => timings.push(t));
    });

    pool.on('finished', () => {
        console.log(`\nCompleted calculations in ${new Date().getTime() - before} ms`);
        console.log(`Time calculating: ${timings.reduce((a,b) => a+b, 0)} ms`);
        pool.killAll();
        setTimeout(() => {
            loop(nums);
        }, 100);
    });

}


// Begin Loop
loop(inputs);
