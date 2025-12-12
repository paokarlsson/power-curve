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

function calculate() {
    const CP = parseFloat(document.getElementById('cp').value);
    const W_prime = parseFloat(document.getElementById('wprime').value) * 1000;
    const tau = parseFloat(document.getElementById('tau').value);
    const targetWbalPercent = parseFloat(document.getElementById('targetWbal').value) / 100;
    const targetWbal = W_prime * targetWbalPercent;

    const workouts = [];

    workoutTemplates.forEach(template => {
        const workout = calculateWorkout(template, CP, W_prime, tau, targetWbal);
        if (workout) {
            workouts.push(workout);
        }
    });

    displayResults(workouts, CP, W_prime, tau, targetWbalPercent);
}

// Helper function for W' recovery calculation
function calculateWPrimeRecovery(W_prime, W_bal, restTime, tau, recoveryFactor) {
    const W_recovered = (W_prime - W_bal) * (1 - Math.exp(-restTime / tau)) * recoveryFactor;
    return Math.min(W_bal + W_recovered, W_prime);
}

// Separate workout simulation functions
function simulatePyramidWorkout(template, power, CP, W_prime, tau, restPower) {
    let W_bal = W_prime;

    for (let idx = 0; idx < template.pyramid.length; idx++) {
        const duration = template.pyramid[idx];
        // Work
        const W_depleted = (power - CP) * duration;
        W_bal -= W_depleted;

        // Rest (not after last)
        if (idx < template.pyramid.length - 1) {
            const recoveryFactor = (CP - restPower) / CP;
            W_bal = calculateWPrimeRecovery(W_prime, W_bal, template.rest, tau, recoveryFactor);
        }
    }

    return W_bal;
}

function simulateMixedWorkout(template, power, CP, W_prime, tau, restPower) {
    let W_bal = W_prime;
    const pattern = template.mixed[0];

    for (let rep = 0; rep < template.reps; rep++) {
        for (let idx = 0; idx < pattern.length; idx++) {
            const duration = pattern[idx];
            // Work
            const W_depleted = (power - CP) * duration;
            W_bal -= W_depleted;

            // Mini rest between parts
            if (idx < pattern.length - 1) {
                const recoveryFactor = (CP - restPower) / CP;
                const miniRest = 30; // 30s between parts
                W_bal = calculateWPrimeRecovery(W_prime, W_bal, miniRest, tau, recoveryFactor);
            }
        }

        // Main rest after full pattern
        if (rep < template.reps - 1) {
            const recoveryFactor = (CP - restPower) / CP;
            W_bal = calculateWPrimeRecovery(W_prime, W_bal, template.rest, tau, recoveryFactor);
        }
    }

    return W_bal;
}

function simulateTabataWorkout(template, power, CP, W_prime, tau, restPower) {
    let W_bal = W_prime;

    for (let set = 0; set < template.sets; set++) {
        for (let rep = 0; rep < template.reps; rep++) {
            // Work
            const W_depleted = (power - CP) * template.work;
            W_bal -= W_depleted;

            // Rest within set (not after last rep)
            if (rep < template.reps - 1) {
                const recoveryFactor = (CP - restPower) / CP;
                W_bal = calculateWPrimeRecovery(W_prime, W_bal, template.rest, tau, recoveryFactor);
            }
        }

        // Set rest (not after last set)
        if (set < template.sets - 1) {
            const recoveryFactor = (CP - restPower) / CP;
            W_bal = calculateWPrimeRecovery(W_prime, W_bal, template.setRest, tau, recoveryFactor);
        }
    }

    return W_bal;
}

function simulateStandardWorkout(template, power, CP, W_prime, tau, restPower) {
    let W_bal = W_prime;

    for (let i = 0; i < template.reps; i++) {
        // Work
        const W_depleted = (power - CP) * template.work;
        W_bal -= W_depleted;

        // Rest (not after last)
        if (i < template.reps - 1) {
            const recoveryFactor = (CP - restPower) / CP;
            W_bal = calculateWPrimeRecovery(W_prime, W_bal, template.rest, tau, recoveryFactor);
        }
    }

    return W_bal;
}

function calculateWorkout(template, CP, W_prime, tau, targetWbal) {
    const restPower = CP * template.restPercent;

    // Binary search for optimal power
    let minPower = CP * 1.05;
    let maxPower = CP * 1.50;
    let optimalPower = (minPower + maxPower) / 2;

    for (let i = 0; i < 30; i++) {
        const finalWbal = simulateWorkout(template, optimalPower, CP, W_prime, tau, restPower);

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

    return {
        name: template.name,
        type: template.type,
        power: Math.round(optimalPower),
        percentage: Math.round(optimalPower / CP * 100),
        restPower: Math.round(restPower),
        template: template,
        stats: stats
    };
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

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${secs}s`;
}

function formatDuration(seconds) {
    if (seconds >= 60) {
        const mins = seconds / 60;
        if (mins === Math.floor(mins)) {
            return `${mins} min`;
        }
        return `${mins.toFixed(1)} min`;
    }
    return `${seconds}s`;
}

function displayResults(workouts, CP, W_prime, tau, targetWbalPercent) {
    const resultsDiv = document.getElementById('results');

    // Summary card
    let html = `
        <div class="summary-card">
            <h2>Din Fitness Signature</h2>
            <div class="result-detail">
                <span class="result-label">CP (FTP):</span>
                <span class="result-value">${CP}W</span>
            </div>
            <div class="result-detail">
                <span class="result-label">W' (Anaerob Kapacitet):</span>
                <span class="result-value">${(W_prime / 1000).toFixed(1)} kJ</span>
            </div>
            <div class="result-detail">
                <span class="result-label">τ (Återhämtningskonstant):</span>
                <span class="result-value">${tau}s</span>
            </div>
            <div class="result-detail">
                <span class="result-label">Mål W'bal efter pass:</span>
                <span class="result-value">${Math.round(targetWbalPercent * 100)}% (${Math.round(W_prime * targetWbalPercent)}J)</span>
            </div>
        </div>

        <h2 style="color: #4CAF50; margin-bottom: 20px; text-align: center;">
            ${workouts.length} Optimerade Intervallpass
        </h2>

        <div class="workout-grid">
    `;

    workouts.forEach(workout => {
        const template = workout.template;
        let structure = '';

        if (template.pyramid) {
            structure = template.pyramid.map(d => formatDuration(d)).join('-');
        } else if (template.mixed) {
            const parts = template.mixed[0].map(d => formatDuration(d)).join('+');
            structure = `${template.reps}×(${parts})`;
        } else if (template.sets) {
            structure = `${template.sets} set × ${template.reps} rep`;
        } else {
            structure = `${template.reps}×${formatDuration(template.work)}`;
        }

        html += `
            <div class="result-card">
                <span class="workout-type ${workout.type}">${workout.type}</span>
                <h3>${workout.name}</h3>

                <div class="power-recommendation">
                    <div class="power-value">${workout.power}W</div>
                    <div style="font-size: 14px;">${workout.percentage}% av CP</div>
                </div>

                <div class="result-detail">
                    <span class="result-label">Struktur:</span>
                    <span class="result-value">${structure}</span>
                </div>

                ${!template.pyramid && !template.mixed ? `
                <div class="result-detail">
                    <span class="result-label">Vila:</span>
                    <span class="result-value">${formatDuration(template.rest)} @ ${workout.restPower}W</span>
                </div>
                ` : ''}

                ${template.setRest ? `
                <div class="result-detail">
                    <span class="result-label">Set-vila:</span>
                    <span class="result-value">${formatDuration(template.setRest)} @ ${workout.restPower}W</span>
                </div>
                ` : ''}

                <div class="result-detail">
                    <span class="result-label">Total arbetstid:</span>
                    <span class="result-value">${formatTime(workout.stats.totalWorkTime)}</span>
                </div>

                <div class="result-detail">
                    <span class="result-label">Total tid:</span>
                    <span class="result-value">${formatTime(workout.stats.totalTime)}</span>
                </div>
            </div>
        `;
    });

    html += `</div>`;

    resultsDiv.innerHTML = html;
    resultsDiv.style.display = 'block';

    // Scroll to results
    resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Auto-calculate on page load
window.onload = function() {
    calculate();
};