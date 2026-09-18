// Beräkningsmodellen för Intervall Optimizer: mallar, W'bal-simulering och solver.
// Ingen DOM-kod här - filen ska gå att köra både i webbläsaren (vanlig <script>)
// och i Node (node --test). Se docs/12-omskrivning-wbal.md.

// Workout templates with structure
const workoutTemplates = [
    // Classic intervals
    { name: "4×4 min", reps: 4, work: 240, rest: 180, restPercent: 0.5, type: "vo2max" },
    { name: "5×5 min", reps: 5, work: 300, rest: 180, restPercent: 0.5, type: "vo2max" },
    { name: "6×3 min", reps: 6, work: 180, rest: 120, restPercent: 0.5, type: "vo2max" },
    { name: "8×2 min", reps: 8, work: 120, rest: 90, restPercent: 0.5, type: "vo2max" },

    // Threshold intervals
    { name: "3×8 min", reps: 3, work: 480, rest: 240, restPercent: 0.6, type: "threshold" },
    { name: "4×6 min", reps: 4, work: 360, rest: 180, restPercent: 0.6, type: "threshold" },
    { name: "2×10 min", reps: 2, work: 600, rest: 300, restPercent: 0.6, type: "threshold" },

    // Shorter VO2max
    { name: "10×90s", reps: 10, work: 90, rest: 60, restPercent: 0.5, type: "vo2max" },
    { name: "12×1 min", reps: 12, work: 60, rest: 60, restPercent: 0.4, type: "vo2max" },
    { name: "15×1 min", reps: 15, work: 60, rest: 45, restPercent: 0.4, type: "vo2max" },

    // Anaerobic capacity
    { name: "20×30s", reps: 20, work: 30, rest: 30, restPercent: 0.4, type: "anaerobic" },
    { name: "12×45s", reps: 12, work: 45, rest: 45, restPercent: 0.4, type: "anaerobic" },
    { name: "10×1 min", reps: 10, work: 60, rest: 90, restPercent: 0.4, type: "anaerobic" },

    // Tabata style
    { name: "8×(8×20s)", sets: 8, reps: 8, work: 20, rest: 10, setRest: 180, restPercent: 0.3, type: "anaerobic" },
    { name: "3×(10×40s)", sets: 3, reps: 10, work: 40, rest: 20, setRest: 180, restPercent: 0.4, type: "anaerobic" },

    // Pyramids
    { name: "Pyramid 1-2-3-4-3-2-1", pyramid: [60, 120, 180, 240, 180, 120, 60], rest: 60, restPercent: 0.5, type: "vo2max" },
    { name: "Pyramid 2-4-6-4-2", pyramid: [120, 240, 360, 240, 120], rest: 120, restPercent: 0.5, type: "vo2max" },

    // Mixed intervals
    { name: "5×(2min + 1min)", mixed: [[120, 60]], reps: 5, rest: 90, restPercent: 0.5, type: "vo2max" },
    { name: "4×(3min + 2min)", mixed: [[180, 120]], reps: 4, rest: 120, restPercent: 0.5, type: "vo2max" },

    // Long intervals
    { name: "2×15 min", reps: 2, work: 900, rest: 420, restPercent: 0.65, type: "threshold" }
];

// Helper function for W' recovery calculation
function calculateWPrimeRecovery(W_prime, W_bal, restTime, tau, recoveryFactor) {
    const W_recovered = (W_prime - W_bal) * (1 - Math.exp(-restTime / tau)) * recoveryFactor;
    return Math.min(W_bal + W_recovered, W_prime);
}

// Simuleringstillstånd. Samlar tömning, återhämtning och minimispårning på ett
// ställe så att min(W'bal) inte kan glömmas i någon av passtyperna nedan.
function createSimulation(CP, W_prime, tau, restPower) {
    const recoveryFactor = (CP - restPower) / CP;
    let W_bal = W_prime;
    let minWbal = W_prime;

    return {
        work: function(power, duration) {
            W_bal -= (power - CP) * duration;
            if (W_bal < minWbal) {
                minWbal = W_bal;
            }
        },
        rest: function(duration) {
            W_bal = calculateWPrimeRecovery(W_prime, W_bal, duration, tau, recoveryFactor);
        },
        result: function() {
            return { finalWbal: W_bal, minWbal: minWbal };
        }
    };
}

// Separate workout simulation functions. Alla returnerar { finalWbal, minWbal }:
// finalWbal är doseringen, minWbal avgör om passet går att fullfölja (WB-1).
function simulatePyramidWorkout(template, power, CP, W_prime, tau, restPower) {
    const sim = createSimulation(CP, W_prime, tau, restPower);

    for (let idx = 0; idx < template.pyramid.length; idx++) {
        sim.work(power, template.pyramid[idx]);

        // Rest (not after last)
        if (idx < template.pyramid.length - 1) {
            sim.rest(template.rest);
        }
    }

    return sim.result();
}

function simulateMixedWorkout(template, power, CP, W_prime, tau, restPower) {
    const sim = createSimulation(CP, W_prime, tau, restPower);
    const pattern = template.mixed[0];
    const miniRest = 30; // 30s between parts

    for (let rep = 0; rep < template.reps; rep++) {
        for (let idx = 0; idx < pattern.length; idx++) {
            sim.work(power, pattern[idx]);

            // Mini rest between parts
            if (idx < pattern.length - 1) {
                sim.rest(miniRest);
            }
        }

        // Main rest after full pattern
        if (rep < template.reps - 1) {
            sim.rest(template.rest);
        }
    }

    return sim.result();
}

function simulateTabataWorkout(template, power, CP, W_prime, tau, restPower) {
    const sim = createSimulation(CP, W_prime, tau, restPower);

    for (let set = 0; set < template.sets; set++) {
        for (let rep = 0; rep < template.reps; rep++) {
            sim.work(power, template.work);

            // Rest within set (not after last rep)
            if (rep < template.reps - 1) {
                sim.rest(template.rest);
            }
        }

        // Set rest (not after last set)
        if (set < template.sets - 1) {
            sim.rest(template.setRest);
        }
    }

    return sim.result();
}

function simulateStandardWorkout(template, power, CP, W_prime, tau, restPower) {
    const sim = createSimulation(CP, W_prime, tau, restPower);

    for (let i = 0; i < template.reps; i++) {
        sim.work(power, template.work);

        // Rest (not after last)
        if (i < template.reps - 1) {
            sim.rest(template.rest);
        }
    }

    return sim.result();
}

function simulateWorkout(template, power, CP, W_prime, tau, restPower) {
    if (template.pyramid) {
        return simulatePyramidWorkout(template, power, CP, W_prime, tau, restPower);
    } else if (template.mixed) {
        return simulateMixedWorkout(template, power, CP, W_prime, tau, restPower);
    } else if (template.sets) {
        return simulateTabataWorkout(template, power, CP, W_prime, tau, restPower);
    } else {
        return simulateStandardWorkout(template, power, CP, W_prime, tau, restPower);
    }
}

function calculateWorkout(template, CP, W_prime, tau, targetWbal) {
    const restPower = CP * template.restPercent;

    // Binary search for optimal power
    let minPower = CP * 1.05;
    let maxPower = CP * 1.50;
    let optimalPower = (minPower + maxPower) / 2;

    for (let i = 0; i < 30; i++) {
        const finalWbal = simulateWorkout(template, optimalPower, CP, W_prime, tau, restPower).finalWbal;

        if (Math.abs(finalWbal - targetWbal) < 100) {
            break;
        }

        if (finalWbal > targetWbal) {
            minPower = optimalPower;
        } else {
            maxPower = optimalPower;
        }

        optimalPower = (minPower + maxPower) / 2;
    }

    // Calculate total work time and duration
    const stats = calculateWorkoutStats(template);

    // Utfallet mäts på den oavrundade effekten - det är den siffran
    // docs/12-omskrivning-wbal.md tabellerar.
    const outcome = simulateWorkout(template, optimalPower, CP, W_prime, tau, restPower);

    return {
        name: template.name,
        type: template.type,
        power: Math.round(optimalPower),
        percentage: Math.round(optimalPower / CP * 100),
        restPower: Math.round(restPower),
        finalWbal: outcome.finalWbal,
        minWbal: outcome.minWbal,
        template: template,
        stats: stats
    };
}

function calculateWorkoutStats(template) {
    let totalWorkTime = 0;
    let totalRestTime = 0;
    let totalTime = 0;

    if (template.pyramid) {
        totalWorkTime = template.pyramid.reduce((a, b) => a + b, 0);
        totalRestTime = template.rest * (template.pyramid.length - 1);
    } else if (template.mixed) {
        const patternTime = template.mixed[0].reduce((a, b) => a + b, 0);
        const miniRests = (template.mixed[0].length - 1) * 30;
        totalWorkTime = patternTime * template.reps;
        totalRestTime = (miniRests + template.rest) * template.reps - template.rest;
    } else if (template.sets) {
        totalWorkTime = template.work * template.reps * template.sets;
        const restWithinSets = template.rest * (template.reps - 1) * template.sets;
        const restBetweenSets = template.setRest * (template.sets - 1);
        totalRestTime = restWithinSets + restBetweenSets;
    } else {
        totalWorkTime = template.work * template.reps;
        totalRestTime = template.rest * (template.reps - 1);
    }

    totalTime = totalWorkTime + totalRestTime;

    return {
        totalWorkTime: totalWorkTime,
        totalRestTime: totalRestTime,
        totalTime: totalTime
    };
}

// Räkna ut alla mallar för en fitness signature. Enda ingången modellen behöver utåt.
function calculateAllWorkouts(CP, W_prime, tau, targetWbal) {
    const workouts = [];

    workoutTemplates.forEach(template => {
        const workout = calculateWorkout(template, CP, W_prime, tau, targetWbal);
        if (workout) {
            workouts.push(workout);
        }
    });

    return workouts;
}

// CommonJS-shim: samma mönster som fit-analysis/module-loader.js bygger på.
// I webbläsaren är module odefinierad och blocket hoppas över.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        workoutTemplates,
        calculateWPrimeRecovery,
        simulateWorkout,
        calculateWorkout,
        calculateWorkoutStats,
        calculateAllWorkouts
    };
}
