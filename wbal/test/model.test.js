// Regressionstester för wbal/model.js. Körs med `npm test` (node --test test/).
//
// Filen har två delar, och skillnaden mellan dem är avsiktlig enligt
// docs/13-genomforandeplan.md §1:
//
//   * INVARIANTER ska hålla i varje commit, oavsett vilken matematik modellen
//     använder. De får aldrig uppdateras för att "passa" en ändring.
//   * SNAPSHOT låser kolumnen "Idag" i docs/12-omskrivning-wbal.md, alltså
//     dagens matematik med τ = 180 s som användarinställning. Stegen 1-3 i
//     docs/12 flyttar dessa tal med avsikt; då byts snapshotten mot kolumnen
//     "Efter" i samma tabell - inte mot vad körningen råkar ge.

const test = require('node:test');
const assert = require('node:assert/strict');

const model = require('../model.js');

// Verktygets defaultvärden (wbal/index.html)
const CP = 200;
const W_PRIME = 15000;
const TAU = 180;
const TARGET_WBAL = W_PRIME * 0.30;

function simulateAt(template, power) {
    return model.simulateWorkout(template, power, CP, W_PRIME, TAU, CP * template.restPercent);
}

function finalWbalAt(template, power) {
    return simulateAt(template, power).finalWbal;
}

function templateByName(name) {
    const template = model.workoutTemplates.find(t => t.name === name);
    assert.ok(template, `mallen ${name} finns inte`);
    return template;
}

// ---------------------------------------------------------------------------
// Invarianter
// ---------------------------------------------------------------------------

test('varje mall har namn, typ och vilointensitet', () => {
    const names = new Set();
    for (const template of model.workoutTemplates) {
        assert.equal(typeof template.name, 'string');
        assert.ok(['vo2max', 'threshold', 'anaerobic'].includes(template.type), template.name);
        assert.ok(template.restPercent > 0 && template.restPercent < 1, template.name);
        assert.ok(!names.has(template.name), `dubblerat mallnamn: ${template.name}`);
        names.add(template.name);
    }
});

test('total tid är arbetstid plus vilotid, för varje mall', () => {
    for (const template of model.workoutTemplates) {
        const stats = model.calculateWorkoutStats(template);
        assert.equal(stats.totalTime, stats.totalWorkTime + stats.totalRestTime, template.name);
        assert.ok(stats.totalWorkTime > 0, template.name);
        assert.ok(stats.totalRestTime > 0, template.name);
    }
});

test('återhämtning kan aldrig överstiga W-prime', () => {
    for (const rest of [0, 30, 180, 3600, 36000]) {
        const recovered = model.calculateWPrimeRecovery(W_PRIME, W_PRIME * 0.2, rest, TAU, 1);
        assert.ok(recovered <= W_PRIME, `vila ${rest} s gav ${recovered} J`);
    }
});

test('återhämtning växer monotont med vilolängden och är noll vid ingen vila', () => {
    const start = 0;
    assert.equal(model.calculateWPrimeRecovery(W_PRIME, start, 0, TAU, 1), start);

    let previous = start;
    for (const rest of [10, 30, 60, 120, 300, 900]) {
        const recovered = model.calculateWPrimeRecovery(W_PRIME, start, rest, TAU, 1);
        assert.ok(recovered > previous, `vila ${rest} s gav inte mer än ${previous} J`);
        previous = recovered;
    }
});

test('slut-W-prime-bal sjunker monotont med föreskriven effekt, för varje mall', () => {
    for (const template of model.workoutTemplates) {
        let previous = Infinity;
        for (const power of [CP, CP * 1.05, CP * 1.2, CP * 1.35, CP * 1.5]) {
            const finalWbal = finalWbalAt(template, power);
            assert.ok(finalWbal < previous, `${template.name} vid ${power} W: ${finalWbal} J`);
            previous = finalWbal;
        }
    }
});

test('lägsta W-prime-bal ligger aldrig över slutvärdet, för varje mall', () => {
    // Sista arbetsintervallet följs inte av vila, så slutvärdet är självt en av
    // bottnarna: min kan aldrig vara högre.
    for (const template of model.workoutTemplates) {
        const outcome = simulateAt(template, CP * 1.2);
        assert.ok(outcome.minWbal <= outcome.finalWbal, `${template.name}: min ${outcome.minWbal} > slut ${outcome.finalWbal}`);
    }
});

test('lägsta W-prime-bal sjunker monotont med föreskriven effekt, för varje mall', () => {
    for (const template of model.workoutTemplates) {
        let previous = Infinity;
        for (const power of [CP, CP * 1.05, CP * 1.2, CP * 1.35, CP * 1.5]) {
            const minWbal = simulateAt(template, power).minWbal;
            assert.ok(minWbal < previous, `${template.name} vid ${power} W: ${minWbal} J`);
            previous = minWbal;
        }
    }
});

test('båda pyramiderna har sin bottennivå strikt under slutvärdet', () => {
    // Test 5 i docs/12 §Regressionstest. Pyramiderna är de enda mallarna där
    // bottennivån ligger mitt i passet - det är hela skälet till WB-1.
    for (const name of ['Pyramid 1-2-3-4-3-2-1', 'Pyramid 2-4-6-4-2']) {
        const workout = model.calculateAllWorkouts(CP, W_PRIME, TAU, TARGET_WBAL).find(w => w.name === name);
        assert.ok(workout.minWbal < workout.finalWbal - 1, `${name}: min ${workout.minWbal}, slut ${workout.finalWbal}`);
    }
});

test('passiv vila återvinner mer än 98 % av W-prime på 30 minuter', () => {
    // Test 1 i docs/12 §Regressionstest. Kriteriet är valt så att det håller för
    // CP 150-350 W, se docs/12 §1 [Justerat].
    for (const cp of [150, 200, 250, 350]) {
        const recovered = model.calculateWPrimeRecovery(W_PRIME, 0, 1800, TAU, (cp - 0) / cp);
        assert.ok(recovered / W_PRIME > 0.98, `CP ${cp} W gav ${(recovered / W_PRIME * 100).toFixed(2)} %`);
    }
});

test('solvern håller sig inom sitt sökintervall', () => {
    for (const workout of model.calculateAllWorkouts(CP, W_PRIME, TAU, TARGET_WBAL)) {
        assert.ok(workout.power >= Math.round(CP * 1.05), `${workout.name}: ${workout.power} W`);
        assert.ok(workout.power <= Math.round(CP * 1.50), `${workout.name}: ${workout.power} W`);
    }
});

// ---------------------------------------------------------------------------
// Snapshot: kolumnen "Idag" i docs/12-omskrivning-wbal.md
// ---------------------------------------------------------------------------

// CP 200 W, W' 15 kJ, mål-W'bal 30 % (= 4500 J), τ = 180 s.
// Kolumnerna är [mall, effekt, procent av CP, min(W'bal)]. min mäts på den
// oavrundade lösningen, precis som tabellen i docs/12.
const IDAG = [
    ['4×4 min', 218, 109, 4480],
    ['5×5 min', 213, 106, 4517],
    ['6×3 min', 217, 109, 4554],
    ['8×2 min', 221, 110, 4462],
    ['3×8 min', 210, 105, 4402],
    ['4×6 min', 211, 105, 4510],
    ['2×10 min', 210, 105, 4593],
    ['10×90s', 221, 111, 4433],
    ['12×1 min', 233, 117, 4537],
    ['15×1 min', 226, 113, 4566],
    ['20×30s', 237, 119, 4576],
    ['12×45s', 238, 119, 4414],
    ['10×1 min', 244, 122, 4467],
    ['8×(8×20s)', 243, 122, 4493],
    ['3×(10×40s)', 224, 112, 4459],
    ['Pyramid 1-2-3-4-3-2-1', 217, 108, 4023],
    ['Pyramid 2-4-6-4-2', 216, 108, 3787],
    ['5×(2min + 1min)', 221, 110, 4466],
    ['4×(3min + 2min)', 215, 107, 4460],
    ['2×15 min', 210, 105, -155]
];

test('alla 20 mallar ger kolumnen "Idag" på defaultvärden', () => {
    const workouts = model.calculateAllWorkouts(CP, W_PRIME, TAU, TARGET_WBAL);
    assert.equal(workouts.length, IDAG.length);

    for (let i = 0; i < IDAG.length; i++) {
        const [name, power, percentage, minWbal] = IDAG[i];
        assert.equal(workouts[i].name, name, `mall ${i} heter ${workouts[i].name}`);
        assert.equal(workouts[i].power, power, `${name}: effekt`);
        assert.equal(workouts[i].percentage, percentage, `${name}: procent av CP`);
        assert.equal(Math.round(workouts[i].minWbal), minWbal, `${name}: min(W'bal)`);
    }
});

test('2×15 min är idag ett klippt gränsvärde med negativ slut-W-prime-bal', () => {
    // WB-2 i docs/09-fel-wbal.md: solvern returnerar undre gränsen 1,05 × CP tyst,
    // och passet är i själva verket ogenomförbart. Steg 3 i docs/12 gör 208 W med
    // slut-W'bal 4500 J av det här - då ska raden bytas, inte tas bort.
    const template = templateByName('2×15 min');
    assert.equal(Math.round(finalWbalAt(template, 210)), -155);
});

test('aktiv vila har idag en asymptot som stannar på vilointensitetens faktor', () => {
    // WB-3 i docs/09-fel-wbal.md, låst för att steg 1 i docs/12 ska gå att se:
    // återhämtningsfaktorn multiplicerar mängden återhämtning, så oändlig vila på
    // 0,5 × CP ger bara 50 % av underskottet tillbaka. Efter steg 1 ska samma
    // anrop ge > 50 % (test 2 i docs/12 §Regressionstest).
    const factor = (CP - CP * 0.5) / CP;
    const recovered = model.calculateWPrimeRecovery(W_PRIME, 0, 36000, TAU, factor);
    assert.ok(recovered / W_PRIME <= 0.5, `fick ${(recovered / W_PRIME * 100).toFixed(2)} %`);
    assert.ok(recovered / W_PRIME > 0.4999, `fick ${(recovered / W_PRIME * 100).toFixed(2)} %`);
});
