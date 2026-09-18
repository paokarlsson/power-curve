/* global calculateAllWorkouts */
// Gränssnittet för Intervall Optimizer: läser inmatningen, anropar model.js och ritar
// resultatet. All matematik ligger i model.js.

function calculate() {
    const CP = parseFloat(document.getElementById('cp').value);
    const W_prime = parseFloat(document.getElementById('wprime').value) * 1000;
    const tau = parseFloat(document.getElementById('tau').value);
    const targetWbalPercent = parseFloat(document.getElementById('targetWbal').value) / 100;
    const targetWbal = W_prime * targetWbalPercent;

    const workouts = calculateAllWorkouts(CP, W_prime, tau, targetWbal);

    displayResults(workouts, CP, W_prime, tau, targetWbalPercent);
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
                    <span class="result-label">Lägsta W'bal i passet:</span>
                    <span class="result-value">${Math.round(workout.minWbal)} J (${Math.round(workout.minWbal / W_prime * 100)}% av W')</span>
                </div>

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