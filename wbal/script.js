/* global calculateAllWorkouts, cpFromFtp */
// Gränssnittet för Intervall Optimizer: läser inmatningen, anropar model.js och ritar
// resultatet. All matematik ligger i model.js.

function calculate() {
    const enteredPower = parseFloat(document.getElementById('cp').value);
    const enteredAsFtp = document.getElementById('cpSource').value === 'ftp';

    // WB-5: modellen vill ha CP. Matas FTP in konverteras det explicit och märks
    // som uppskattat - det tas aldrig tyst för att vara samma storhet.
    const CP = enteredAsFtp ? cpFromFtp(enteredPower) : enteredPower;
    const W_prime = parseFloat(document.getElementById('wprime').value) * 1000;
    const targetWbalPercent = parseFloat(document.getElementById('targetWbal').value) / 100;
    const targetWbal = W_prime * targetWbalPercent;

    const workouts = calculateAllWorkouts(CP, W_prime, targetWbal);

    displayResults(workouts, CP, W_prime, targetWbalPercent, enteredAsFtp ? enteredPower : null);
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

function displayResults(workouts, CP, W_prime, targetWbalPercent, ftp) {
    const resultsDiv = document.getElementById('results');

    // Summary card
    let html = `
        <div class="summary-card">
            <h2>Din Fitness Signature</h2>
            <div class="result-detail">
                <span class="result-label">${ftp === null ? 'CP:' : 'CP (uppskattad ur FTP):'}</span>
                <span class="result-value">${Number.isInteger(CP) ? CP : CP.toFixed(1).replace('.', ',')}W</span>
            </div>
            <div class="result-detail">
                <span class="result-label">W' (Anaerob Kapacitet):</span>
                <span class="result-value">${(W_prime / 1000).toFixed(1)} kJ</span>
            </div>
            <div class="result-detail">
                <span class="result-label">Mål W'bal efter pass:</span>
                <span class="result-value">${Math.round(targetWbalPercent * 100)}% (${Math.round(W_prime * targetWbalPercent)}J)</span>
            </div>
            ${ftp === null ? '' : `
            <p class="estimated-note">
                Uppskattad ur FTP ${ftp}W med CP ≈ FTP / 0,95. Det är en tumregel, inte en
                mätning - ett CP ur ett effekt-duration-test är alltid att föredra.
            </p>
            `}
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

                ${workout.status === 'out_of_range' ? `
                <div class="power-recommendation no-solution">
                    <div style="font-size: 18px; font-weight: bold;">Ingen lösning</div>
                    <div style="font-size: 13px;">inte ens 4 × CP tömmer ner till mål-W'bal</div>
                </div>
                ` : `
                <div class="power-recommendation ${workout.status}">
                    <div class="power-value">${workout.power}W</div>
                    <div style="font-size: 14px;">${workout.percentage}% av CP</div>
                </div>
                `}

                ${workout.status === 'floor_limited' ? `
                <div class="status-note">
                    Begränsad av bottennivån, inte av mål-W'bal: slut-W'bal blir
                    ${Math.round(workout.finalWbal)} J mot målet ${Math.round(workout.targetWbal)} J.
                </div>
                ` : ''}

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
                    <span class="result-label">τ (härledd ur viloeffekten):</span>
                    <span class="result-value">${Math.round(workout.tau)}s</span>
                </div>

                ${workout.minWbal === null ? '' : `
                <div class="result-detail">
                    <span class="result-label">Lägsta W'bal i passet:</span>
                    <span class="result-value">${Math.round(workout.minWbal)} J (${Math.round(workout.minWbal / W_prime * 100)}% av W')</span>
                </div>
                `}

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