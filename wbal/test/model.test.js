// Regressionstester för wbal/model.js. Körs med `npm test` (node --test test/).
//
// Filen har två delar, och skillnaden mellan dem är avsiktlig enligt
// docs/13-genomforandeplan.md §1:
//
//   * INVARIANTER ska hålla i varje commit, oavsett vilken matematik modellen
//     använder. De får aldrig uppdateras för att "passa" en ändring.
//   * SNAPSHOT låser mätta tal ur docs/12-omskrivning-wbal.md. Mellan 2.2 och
//     2.4 finns ingen tabell att låsa mallarnas watt mot - de talen står
//     ingenstans i dokumentationen - så den delen håller bara de τ-värden och
//     acceptanskriterier steget självt är mätt mot. Kolumnen "Efter" låses igen
//     i 2.5, och aldrig mot vad körningen råkar ge.

const test = require('node:test');
const assert = require('node:assert/strict');

const model = require('../model.js');

// Verktygets defaultvärden (wbal/index.html)
const CP = 200;
const W_PRIME = 15000;
const TARGET_WBAL = W_PRIME * 0.30;

function simulateAt(template, power) {
    return model.simulateWorkout(template, power, CP, W_PRIME, CP * template.restPercent);
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
    for (const restPercent of [0, 0.3, 0.5, 0.65]) {
        const tau = model.deriveTau(CP, CP * restPercent);
        for (const rest of [0, 30, 180, 3600, 36000]) {
            const recovered = model.calculateWPrimeRecovery(W_PRIME, W_PRIME * 0.2, rest, tau);
            assert.ok(recovered <= W_PRIME, `vila ${rest} s vid ${restPercent} × CP gav ${recovered} J`);
        }
    }
});

test('asymptoten går mot W-prime oavsett vilointensitet', () => {
    // WB-3: återhämtningsfaktorn tog förr och kapade asymptoten till (CP − viloeffekt)/CP.
    // Vilointensiteten får bara styra hur snabbt, aldrig om.
    for (const restPercent of [0, 0.3, 0.5, 0.65, 0.9]) {
        const tau = model.deriveTau(CP, CP * restPercent);
        const recovered = model.calculateWPrimeRecovery(W_PRIME, 0, 36000, tau);
        assert.ok(recovered / W_PRIME > 0.999, `${restPercent} × CP gav ${(recovered / W_PRIME * 100).toFixed(2)} %`);
    }
});

test('återhämtning växer monotont med vilolängden och är noll vid ingen vila', () => {
    const tau = model.deriveTau(CP, CP * 0.5);
    const start = 0;
    assert.equal(model.calculateWPrimeRecovery(W_PRIME, start, 0, tau), start);

    let previous = start;
    for (const rest of [10, 30, 60, 120, 300, 900]) {
        const recovered = model.calculateWPrimeRecovery(W_PRIME, start, rest, tau);
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
        const workout = model.calculateAllWorkouts(CP, W_PRIME, TARGET_WBAL).find(w => w.name === name);
        assert.ok(workout.minWbal < workout.finalWbal - 1, `${name}: min ${workout.minWbal}, slut ${workout.finalWbal}`);
    }
});

test('passiv vila återvinner mer än 98 % av W-prime på 30 minuter', () => {
    // Test 1 i docs/12 §Regressionstest. Kriteriet är valt så att det håller för
    // CP 150-350 W, se docs/12 §1 [Justerat] - kravet på 99 % faller på CP < 198,7 W.
    for (const cp of [150, 200, 250, 350]) {
        const recovered = model.calculateWPrimeRecovery(W_PRIME, 0, 1800, model.deriveTau(cp, 0));
        assert.ok(recovered / W_PRIME > 0.98, `CP ${cp} W gav ${(recovered / W_PRIME * 100).toFixed(2)} %`);
    }
});

test('aktiv vila på halva CP återvinner mer än 50 % av underskottet', () => {
    // Test 2 i docs/12 §Regressionstest: vakt mot att återhämtningsfaktorn smyger
    // tillbaka. Med faktorn kunde den här vilan aldrig ge mer än 50 %.
    const tau = model.deriveTau(CP, CP * 0.5);
    const recovered = model.calculateWPrimeRecovery(W_PRIME, 0, 900, tau);
    assert.ok(recovered / W_PRIME > 0.5, `fick ${(recovered / W_PRIME * 100).toFixed(2)} %`);
});

test('solvern håller sig inom sitt sökintervall och rapporterar ett känt tillstånd', () => {
    for (const workout of model.calculateAllWorkouts(CP, W_PRIME, TARGET_WBAL)) {
        assert.ok(['solved', 'floor_limited', 'out_of_range'].includes(workout.status), workout.status);
        if (workout.status === 'out_of_range') {
            continue;
        }
        assert.ok(workout.power >= CP * 0.5, `${workout.name}: ${workout.power} W`);
        assert.ok(workout.power <= CP * 4.0, `${workout.name}: ${workout.power} W`);
    }
});

test('varje föreskriven effekt lämnar bottennivån över noll', () => {
    // Test 3 i docs/12 §Regressionstest, mätt på den heltalseffekt som visas.
    for (const workout of model.calculateAllWorkouts(CP, W_PRIME, TARGET_WBAL)) {
        assert.notEqual(workout.status, 'out_of_range', workout.name);
        const outcome = simulateAt(workout.template, workout.power);
        assert.ok(outcome.minWbal > 0, `${workout.name} vid ${workout.power} W: ${outcome.minWbal} J`);
    }
});

test('2x15 min är en genomförbar lösning, inte ett klippt gränsvärde', () => {
    // Test 4 i docs/12 §Regressionstest: idag −155 J, klippt mot undre gränsen
    // 1,05 × CP. Watttalet låses i snapshotten nedan.
    const workout = model.calculateAllWorkouts(CP, W_PRIME, TARGET_WBAL).find(w => w.name === '2×15 min');
    assert.equal(workout.status, 'solved');
    assert.ok(workout.minWbal > 0, `min ${workout.minWbal} J`);
});

test('bottennivån biter i det konstruerade fallet', () => {
    // Test 6 i docs/12 §Regressionstest, och det enda fall som faktiskt kan fallera
    // på golvvillkoret: CP 425 W, W' 5 kJ, mål 10 %. Doseringsmålet nås bara genom
    // att bottennivån går ner till 39 J mot marginalen 100 J.
    const template = templateByName('Pyramid 2-4-6-4-2');
    const workout = model.calculateWorkout(template, 425, 5000, 500);

    assert.equal(workout.status, 'floor_limited');
    assert.ok(workout.minWbal >= 5000 * 0.02, `min ${workout.minWbal} J`);
    assert.ok(workout.finalWbal > workout.targetWbal, `slut ${workout.finalWbal} J mot mål ${workout.targetWbal} J`);
});

test('out_of_range visas aldrig som en vanlig rekommendation', () => {
    // Test 8 i docs/12 §Regressionstest. Ett pass som är för kort för att tömma ner
    // till målet ens vid 4 × CP får ingen effektsiffra alls.
    const tooEasy = { name: '1×10s', reps: 1, work: 10, rest: 60, restPercent: 0.5, type: 'anaerobic' };
    const workout = model.calculateWorkout(tooEasy, CP, W_PRIME, TARGET_WBAL);

    assert.equal(workout.status, 'out_of_range');
    assert.equal(workout.power, null);
    assert.equal(workout.percentage, null);
    assert.equal(workout.minWbal, null);
});

// ---------------------------------------------------------------------------
// Snapshot: mätta τ-värden ur docs/12-omskrivning-wbal.md §1
// ---------------------------------------------------------------------------

test('τ härleds till de tabellerade värdena vid CP 200 W', () => {
    // docs/12 §1, kolumnen "τ, ny"
    const expected = [[0.30, 451], [0.40, 480], [0.50, 517], [0.60, 561], [0.65, 587]];
    for (const [restPercent, tau] of expected) {
        assert.equal(Math.round(model.deriveTau(CP, CP * restPercent)), tau, `restPercent ${restPercent}`);
    }
});

test('τ för passiv vila följer CP enligt den mätta tabellen', () => {
    // docs/12 §1 [Justerat], kolumnen τ vid D_CP = CP
    const expected = [[150, 437.8], [200, 389.9], [250, 360.8], [350, 332.5]];
    for (const [cp, tau] of expected) {
        assert.equal(model.deriveTau(cp, 0).toFixed(1), tau.toFixed(1), `CP ${cp} W`);
    }
});
