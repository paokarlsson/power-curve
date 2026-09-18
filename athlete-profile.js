// Gemensam atletprofil för de fyra verktygen.
//
// Alla fyra verktyg beskriver samma atlet med olika delar av samma fitness
// signature: power-curve/ och wbal/ delar CP och W', running/ har CS och D',
// fit-analysis/ normaliserar mot CP. docs/07-fel-power-curve.md avslutas med
// just den observationen - att verktygen inte delar värden är en av orsakerna
// till WB-5. Den här filen är det gemensamma signaturvärdet.
//
// Lagringen är localStorage, alltså per webbläsare och per origin. Inget
// skickas någonstans, och profilen följer inte med till en annan dator.
//
// Modulen rör aldrig DOM - samma uppdelning som wbal/model.js mot script.js.

(function (global) {
    'use strict';

    const STORAGE_KEY = 'endurance-athlete-profile';

    // Vilka fält som får finnas, och hur de valideras. Ett fält som inte klarar
    // sin kontroll tas bort i stället för att sparas: en trasig profil ska inte
    // kunna smitta ett verktyg med NaN.
    //
    // Enheterna är modellernas egna, inte inmatningens: W' i joule (inte kJ) och
    // CS i m/s (inte km/h). Varje verktyg räknar om vid visning ändå, och en
    // profil med blandade enheter är omöjlig att läsa.
    const FIELDS = {
        cp: isPositiveNumber,        // W    - Critical Power (= TP i power-curve/)
        wPrime: isPositiveNumber,    // J    - anaerob kapacitet (= HIE i power-curve/)
        cs: isPositiveNumber,        // m/s  - Critical Speed
        dPrime: isPositiveNumber,    // m    - anaerob distansreserv
        powerTests: isPowerTests,    // power-curve/: testpunkterna bakom CP och W'
        runTests: isRunTests,        // running/: de två loppen bakom CS och D'
        savedAt: isString            // ISO-tid, sätts av save()
    };

    function isPositiveNumber(value) {
        return typeof value === 'number' && isFinite(value) && value > 0;
    }

    function isString(value) {
        return typeof value === 'string';
    }

    // power-curve/ tillåter 2-5 punkter; profilen kontrollerar formen, inte antalet,
    // så att verktyget ensamt äger sin gräns.
    function isPowerTests(value) {
        return Array.isArray(value)
            && value.length >= 2
            && value.every(point => point
                && isPositiveNumber(point.watts)
                && isPositiveNumber(point.seconds));
    }

    function isRunTests(value) {
        return !!value
            && isPositiveNumber(value.d1) && isPositiveNumber(value.t1)
            && isPositiveNumber(value.d2) && isPositiveNumber(value.t2);
    }

    // Behåll bara fält som känns igen och klarar sin kontroll. Allt annat faller
    // bort tyst - en profil från en äldre version ska ge de värden den kan, inte
    // ett fel.
    function sanitize(raw) {
        const clean = {};
        if (!raw || typeof raw !== 'object') return clean;

        Object.keys(FIELDS).forEach(key => {
            if (key in raw && FIELDS[key](raw[key])) {
                clean[key] = raw[key];
            }
        });

        return clean;
    }

    // localStorage kastar i privat läge och när lagringen är avstängd, och
    // innehållet kan vara trasig JSON. Inget av det får stoppa verktyget: utan
    // profil används verktygets egna defaultvärden, precis som förut.
    function load() {
        try {
            return sanitize(JSON.parse(global.localStorage.getItem(STORAGE_KEY)));
        } catch {
            return {};
        }
    }

    // Slår ihop patch med det som redan finns, så att power-curve/ kan spara CP
    // och W' utan att radera CS och D' från running/. Returnerar den sparade
    // profilen, eller null om lagringen inte gick att skriva till.
    function save(patch) {
        const merged = sanitize(Object.assign(load(), patch));
        merged.savedAt = new Date().toISOString();

        try {
            global.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            return merged;
        } catch {
            return null;
        }
    }

    function clear() {
        try {
            global.localStorage.removeItem(STORAGE_KEY);
        } catch {
            // Finns ingen lagring finns inget att rensa.
        }
    }

    const AthleteProfile = {
        STORAGE_KEY: STORAGE_KEY,
        load: load,
        save: save,
        clear: clear
    };

    global.AthleteProfile = AthleteProfile;

    // CommonJS-shim, samma mönster som wbal/model.js: i webbläsaren är module
    // odefinierad och blocket hoppas över.
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = AthleteProfile;
    }
}(typeof window !== 'undefined' ? window : globalThis));
