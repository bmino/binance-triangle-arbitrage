const threads = require('threads');
threads.config.set({
    basepath: {
        node: __dirname
    }
});


const inputs = [];
const smallestInput = 20;
const inputCount = 20;
const inputStep = 1;
const DATA_SIZE = 20;

for (let i=smallestInput; i<smallestInput+inputCount; i += inputStep) {
    inputs.push(i);
}


let TRIES = [0, 0, 0, 0, 0];
let TIMINGS = [[], [], [], [], []];
let CALCULATIONS = [[], [], [], [], []];
let WORKERS = 1;

function loop() {
    const before = new Date().getTime();
    let timings = [];

    console.log(`\nOpening thread pool with ${WORKERS} workers`);
    const pool = new threads.Pool(WORKERS);
    const job = pool.run('FibonacciWorker.js');

    inputs.forEach(input => {
        job.send(input)
            .on('progress', timing => {
                timings.push(timing);
            })
            .on('done', () => {
                TIMINGS[WORKERS] = TIMINGS[WORKERS].concat(timings);
            });
    });

    pool.on('finished', () => {
        pool.killAll();

        CALCULATIONS[WORKERS].push(new Date().getTime() - before);

        if (++TRIES[WORKERS] === DATA_SIZE) WORKERS++;
        if (WORKERS === 5) {
            for (let w=1; w<TIMINGS.length; w++) {
                let timings = TIMINGS[w];
                let calculations = CALCULATIONS[w];
                console.log(`\nMetrics for ${w} workers`);
                console.log(`Total calculation average: ${ (calculations.reduce((a,b) => a+b, 0) / calculations.length).toFixed(2) }`);
                console.log(`Average calculation: ${ (timings.reduce((a,b) => a+b, 0) / timings.length).toFixed(2) }`);
                console.log(`Range of calculations: ${timings.reduce((a,b) => Math.min(a,b), Infinity)} - ${timings.reduce((a,b) => Math.max(a,b), 0)}`);
            }
        } else {
            setTimeout(loop, 100);
        }
    });

}


// Begin Loop
loop();
