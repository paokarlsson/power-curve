// =============================================================================
// CONFIGURATION
// =============================================================================

// Configuration constants - centralized values
const CONFIG = {
    // Default values
    DEFAULT_CP: 210,            // Default CP value in watts (ger FTP 200 W, verktygets gamla default)
    DEFAULT_MAX_PEAK_POWER: 500, // Default max peak power in watts
    DEFAULT_POWER_EXPONENT: 4, // Power exponent for NP calculations

    // Data processing constants
    WINDOW_COVERAGE_THRESHOLD: 0.5, // Minimum share of a window that must be covered by samples
    RESAMPLE_HZ: 1                  // NP är definierad på 1-sekundersdata
};

// En standardinställning ska ha exakt en definition. Både initieringen och
// resetTSSConfigs() läser härifrån, och kopierar vid tilldelning så att reset
// verkligen återställer i stället för att dela referens (FA-9).
// Fönsterlängden är ett lågpassfilter på effektsignalen: den väljer vilken
// tidsskala av variabilitet som mäts, inte vilket energisystem som belastades.
// Namnen är därför neutrala (FA-4) - ett 10-sekundersfönster ger en siffra även
// på ett pass utan en enda sprint, och "TSS (Sprint)" inbjöd till slutsatsen att
// siffran säger något om det anaeroba systemet. Ordnade efter fönsterlängd, så
// spektrumet läses från kort till långt.
const DEFAULT_TSS_CONFIGS = {
    W10: {
        seconds: 10,
        displayKey: 'w10',
        elementId: 'tssW10',
        label: 'TSS@10s',
        chartColor: '#f57c00',
        chartBackground: '#fff3e0'
    },
    W30: {
        seconds: 30, // Coggans standardfönster - det enda med en publicerad definition
        displayKey: 'w30',
        elementId: 'tssW30',
        label: 'TSS@30s (referens)',
        chartColor: '#7b1fa2',
        chartBackground: '#f3e5f5',
        fixed: true, // Cannot be edited or removed
        reference: true // Jämförbar med Strava, TrainingPeaks och WKO (FA-5)
    },
    W180: {
        seconds: 180,
        displayKey: 'w180',
        elementId: 'tssW180',
        label: 'TSS@180s',
        chartColor: '#388e3c',
        chartBackground: '#e8f5e8'
    },
    W600: {
        seconds: 600,
        displayKey: 'w600',
        elementId: 'tssW600',
        label: 'TSS@600s',
        chartColor: '#1976d2',
        chartBackground: '#e3f2fd'
    },
    // NP med ett oändligt långt fönster är medeleffekten, så baslinjen är
    // spektrumets nedre asymptot - den nivå alla fönstervärden konvergerar mot.
    // Sentinelvärdet -1 aktiverar den färdiga grenen i computeNP_by_time (FA-8).
    BASE: {
        seconds: -1,
        displayKey: 'base',
        elementId: 'tssBase',
        label: 'Base TSS (medeleffekt)',
        chartColor: '#546e7a',
        chartBackground: '#eceff1',
        fixed: true // Cannot be edited or removed
    }
};

function createDefaultTSSConfigs() {
    const configs = {};
    Object.entries(DEFAULT_TSS_CONFIGS).forEach(([key, config]) => {
        configs[key] = { ...config };
    });
    return configs;
}

// Dynamic TSS configurations - can be modified at runtime
let TSS_CONFIGS = createDefaultTSSConfigs();

// Passmålen anges relativt FTP (FA-6). TSS är per definition redan normaliserad
// mot FTP, så ett pass som beskrivs relativt får en planerad TSS som är identisk
// för alla atleter - vilket är precis vad man vill när pass delas eller
// återanvänds. Absoluta watt knöt passet till en atlet vid en tidpunkt:
// exempelpasset "4x4 Threshold" föreskrev 250 W, alltså 125 % av standard-FTP
// 200 W, vilket är VO2max-intensitet och inte tröskel.
//
// targetPercent: 0 är tillåtet så att äkta vila går att uttrycka. Det förutsätter
// att 30 W-golvet är borta (7.2), annars räknas vilan ändå som 30 W och ändringen
// ser ut att fungera utan att göra någon skillnad.
function segmentPercent(target, ftp) {
    if (!target) return 0;
    if (typeof target.targetPercent === 'number') return target.targetPercent;
    // Äldre passfiler med absoluta watt läses fortfarande
    if (typeof target.targetWatt === 'number') return ftp > 0 ? target.targetWatt / ftp : 0;
    return 0;
}

function segmentWatt(target, ftp) {
    return Math.round(segmentPercent(target, ftp) * ftp);
}

// Verktyget frågar efter CP, inte FTP. CP är den storhet som mäts i power-curve/
// och som resten av repot delar via atletprofilen; FTP är ett mätrecept ovanpå
// samma fysiologi (typiskt 95 % av ett 20-minuterstest) och ligger något under.
// Samma tumregel och samma konstant som wbal/model.js, se docs/12 steg 4.
const FTP_OF_CP = 0.95;

function currentCP() {
    return parseInt(document.getElementById('cpInput').value) || CONFIG.DEFAULT_CP;
}

// TSS räknas mot FTP, aldrig mot CP. Coggans definition är IF = NP/FTP och
// TSS = (t/3600)·IF²·100, alltså 100 poäng per timme på FTP - det är den
// definition Strava, TrainingPeaks och WKO använder, och som gör TSS@30s
// jämförbar utåt (FA-5). Byttes nämnaren mot CP skulle varje TSS-tal i
// verktyget sjunka med ~10 % och sluta betyda samma sak som överallt annars.
// Inmatningen är alltså CP; nämnaren härleds ur den.
function currentFTP() {
    return Math.round(currentCP() * FTP_OF_CP);
}

// Profilen ligger i webbläsarens localStorage, per dator och per webbläsare.
// Går den inte att läsa eller skriva fungerar verktyget precis som förut, fast
// med sitt eget defaultvärde - det ska synas i hjälptexten.
function loadCPFromProfile() {
    const profile = AthleteProfile.load();

    if (profile.cp !== undefined) {
        document.getElementById('cpInput').value = Math.round(profile.cp);
    }

    showCPHint(profile.cp !== undefined);
}

function onCPChanged() {
    // Skriv tillbaka till profilen så att en ändring här följer med till wbal/.
    // Fältet innehåller CP, så inget behöver konverteras.
    const saved = AthleteProfile.save({ cp: currentCP() });
    showCPHint(saved !== null);

    recalculateWithNewSettings();

    // Passchemat beror på CP i båda ändar: målen anges i procent av FTP, som
    // härleds ur CP, och referenslinjen ritas på CP. Det ritas därför om i sin
    // helhet - recalculateWithNewSettings avbryter helt om ingen effektfil är
    // inläst, och uppdaterar annars bara referenslinjerna, inte målwatten.
    if (currentWorkout) {
        plotWorkoutPlan(currentWorkout);
    }
}

function showCPHint(fromProfile) {
    const hint = document.getElementById('cpHint');
    const source = fromProfile
        ? `Värdet kommer från den gemensamma atletprofilen och delas med
           <a href="../wbal/">Intervall Optimizer</a>.`
        : `Ingen atletprofil hittad - fältet visar standardvärdet.
           Mät CP i <a href="../power-curve/">Power Curve Plotter</a>, så fylls det i här automatiskt.`;

    hint.innerHTML = `${source} TSS räknas mot FTP = ${Math.round(FTP_OF_CP * 100)} % av CP
        = ${currentFTP()} W, så siffrorna är jämförbara med Strava och TrainingPeaks.
        Passmålen nedan anges i procent av samma FTP.`;
}

// Function to get current TSS window seconds array
function getTSSWindowSeconds() {
    return Object.values(TSS_CONFIGS).map(config => config.seconds);
}

// =============================================================================
// GLOBAL STATE
// =============================================================================

let chart = null;
let tssChart = null;
let workoutChart = null;
let currentPowerRecords = null; // Store power data for recalculation
let currentWorkout = null; // Store workout data for TSS recalculation

// =============================================================================
// PUBLIC API - Main entry points and UI handlers
// =============================================================================

// Set default values from configuration
document.getElementById('cpInput').value = CONFIG.DEFAULT_CP;
document.getElementById('maxPeakPowerInput').value = CONFIG.DEFAULT_MAX_PEAK_POWER;
document.getElementById('powerRaiseInput').value = CONFIG.DEFAULT_POWER_EXPONENT;

// Atletprofilen går före defaultvärdet: CP mäts i power-curve/ och delas med
// wbal/. Exponent och fönsterlängder är analysinställningar, inte egenskaper hos
// atleten, och hör därför inte hemma i profilen.
loadCPFromProfile();

// Load and display workout plan
loadAndDisplayWorkout();

// Add event listeners for real-time recalculation
document.getElementById('cpInput').addEventListener('input', onCPChanged);
document.getElementById('maxPeakPowerInput').addEventListener('input', recalculateWithNewSettings);
document.getElementById('powerRaiseInput').addEventListener('input', recalculateWithNewSettings);

// TSS Configuration UI event listeners
document.getElementById('tssConfigBtn').addEventListener('click', showTSSConfigPanel);
document.getElementById('closeTssConfig').addEventListener('click', hideTSSConfigPanel);
document.getElementById('addTssConfig').addEventListener('click', addNewTSSConfig);
document.getElementById('resetTssConfig').addEventListener('click', resetTSSConfigs);

// Workout Configuration UI event listeners
document.getElementById('workoutConfigBtn').addEventListener('click', showWorkoutConfigPanel);
document.getElementById('closeWorkoutConfig').addEventListener('click', hideWorkoutConfigPanel);
document.getElementById('addWarmupSegment').addEventListener('click', () => addWorkoutSegment('warmup'));
document.getElementById('addIntervalSegment').addEventListener('click', () => addWorkoutSegment('interval'));
document.getElementById('addCooldownSegment').addEventListener('click', () => addWorkoutSegment('cooldown'));
document.getElementById('exportWorkout').addEventListener('click', exportWorkoutJSON);
document.getElementById('importWorkoutBtn').addEventListener('click', () => document.getElementById('importWorkout').click());
document.getElementById('importWorkout').addEventListener('change', importWorkoutJSON);
document.getElementById('resetWorkout').addEventListener('click', resetWorkoutToDefault);

document.getElementById('fitFile').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isCSV = fileName.endsWith('.csv');

    const reader = new FileReader();

    reader.onload = function (event) {
        try {
            if (isCSV) {
                // Parse CSV timeline data
                const csvContent = event.target.result;
                const lines = csvContent.split('\n').filter(line => line.trim());
                const header = lines[0];

                // Expected format: Second,Power,RecordIndex,Timestamp
                if (!header.includes('Second') || !header.includes('Power')) {
                    showError('Invalid CSV format. Expected columns: Second,Power,RecordIndex,Timestamp');
                    return;
                }

                const powerRecords = [];
                const startTime = new Date('2025-04-07T04:53:00.000Z'); // Base timestamp

                for (let i = 1; i < lines.length; i++) {
                    const [second, power] = lines[i].split(',');
                    if (second && power) {
                        const recordTime = new Date(startTime.getTime() + parseInt(second) * 1000);
                        powerRecords.push({
                            timestamp: recordTime,
                            power: parseInt(power) || 0
                        });
                    }
                }

                if (powerRecords.length === 0) {
                    showError('No valid power data found in CSV file');
                    return;
                }

                console.log('📊 Loaded CSV timeline:', powerRecords.length, 'power records');

                // Store power records for recalculation
                currentPowerRecords = powerRecords;

                const ftp = currentFTP();
                // No HR data from CSV, pass empty array
                plotData([], powerRecords, ftp);

            } else {
                // Parse FIT file
                const arrayBuffer = event.target.result;
                const parser = new FitParser({
                    force: true,
                    speedUnit: 'km/h',
                    lengthUnit: 'km',
                    temperatureUnit: 'celsius',
                    elapsedRecordField: true,
                    mode: 'list'
                });

                parser.parse(arrayBuffer, function (error, data) {
                    if (error) {
                        showError('Error parsing FIT file: ' + error);
                        return;
                    }

                    const hrRecords = data.records.filter(r => r.heart_rate !== undefined);
                    const powerRecords = data.records.filter(r => r.power !== undefined);

                    if (hrRecords.length === 0 && powerRecords.length === 0) {
                        showError('No heart rate or power data found in this FIT file');
                        return;
                    }

                    // Store power records for recalculation
                    currentPowerRecords = powerRecords;

                    const ftp = currentFTP();
                    plotData(hrRecords, powerRecords, ftp);
                });
            }
        } catch (err) {
            showError('Error reading file: ' + err.message);
        }
    };

    if (isCSV) {
        reader.readAsText(file);
    } else {
        reader.readAsArrayBuffer(file);
    }
});

function recalculateWithNewSettings() {
    console.log('recalculateWithNewSettings called, currentPowerRecords:', !!currentPowerRecords);
    if (!currentPowerRecords) return; // No data loaded yet

    const ftp = currentFTP();
    console.log('Recalculating with FTP:', ftp);

    // Recalculate TSS values and redraw chart with new reference lines
    recalculateTSS(currentPowerRecords, ftp);

    // Update chart reference lines if chart exists
    if (chart && chart.data.datasets.length > 0) {
        updateChartReferenceLines();
    }
}

function recalculateTSS(powerRecords, ftp) {
    console.log('recalculateTSS called with', powerRecords.length, 'records, FTP:', ftp);
    if (powerRecords.length === 0) return;

    // Convert to timestamp-power format for calculation
    const startTime = new Date(powerRecords[0].timestamp);
    const powerData = powerRecords.map(r => ({
        t: (new Date(r.timestamp) - startTime) / 1000, // seconds from start
        p: r.power || 0
    }));

    // Get current power exponent from input
    const powerExponent = parseFloat(document.getElementById('powerRaiseInput').value) || CONFIG.DEFAULT_POWER_EXPONENT;

    console.log('Current TSS_CONFIGS:', Object.keys(TSS_CONFIGS));

    // Use the time-based calculation with current settings
    const tssData = computeNP_by_time(powerData, ftp, getTSSWindowSeconds(), powerExponent);

    // Convert to display format - now dynamically build based on current configs
    const tssResults = {
        duration: {
            seconds: tssData.duration,
            minutes: Math.round(tssData.duration / 60),
            hours: Math.round(tssData.duration / 3600 * 10) / 10
        },
        cleaning: tssData.cleaning,
        windows: {}
    };

    // Build windows object dynamically from current TSS_CONFIGS
    Object.entries(TSS_CONFIGS).forEach(([windowType, config]) => {
        tssResults.windows[config.displayKey] = getTSSWindowData(tssData, windowType);
    });

    console.log('TSS Results:', tssResults);

    // Update TSS display values for all current configs
    updateTSSDisplayValues(tssResults);

    // Recalculate and update TSS accumulation chart
    const tssAccumulation = calculateTSSAccumulation(powerData, ftp, powerExponent);
    plotTSSAccumulation(tssAccumulation);
}

function plotData(hrRecords, powerRecords, ftp) {
    // Create combined timeline from all records
    const allRecords = [...hrRecords, ...powerRecords];
    const startTime = allRecords.length > 0 ? allRecords[0].timestamp : null;

    if (!startTime) {
        showError('No valid timestamp data found');
        return;
    }

    // Process heart rate data
    const hrData = [];
    const hrTimestamps = [];
    hrRecords.forEach(record => {
        const elapsed = calculateElapsedMinutes(record.timestamp, startTime);
        hrTimestamps.push(elapsed);
        hrData.push({ x: elapsed, y: record.heart_rate });
    });

    // Process power data
    const powerData = [];
    const powerTimestamps = [];
    powerRecords.forEach(record => {
        const elapsed = calculateElapsedMinutes(record.timestamp, startTime);
        powerTimestamps.push(elapsed);
        powerData.push({ x: elapsed, y: record.power });
    });

    // Get all unique timestamps for x-axis
    const allTimestamps = [...new Set([...hrTimestamps, ...powerTimestamps])].sort((a, b) => a - b);

    // Calculate TSS if power data is available
    let tssResults = null;
    let tssAccumulation = null;
    if (powerRecords.length > 0) {
        // Convert to timestamp-power format for the new function
        const startTime = new Date(powerRecords[0].timestamp);
        const powerData = powerRecords.map(r => ({
            t: (new Date(r.timestamp) - startTime) / 1000, // seconds from start
            p: r.power || 0,
            cadence: r.cadence,   // avgör om en nolla är bortfall eller frihjulning
            speed: r.speed
        }));

        // Get current power exponent from input
        const powerExponent = parseFloat(document.getElementById('powerRaiseInput').value) || CONFIG.DEFAULT_POWER_EXPONENT;

        // Use the new correct time-based calculation
        const tssData = computeNP_by_time(powerData, ftp, getTSSWindowSeconds(), powerExponent);

        // Convert to display format - build dynamically from current configs
        tssResults = {
            duration: {
                seconds: tssData.duration,
                minutes: Math.round(tssData.duration / 60),
                hours: Math.round(tssData.duration / 3600 * 10) / 10
            },
            cleaning: tssData.cleaning,
            windows: {}
        };

        // Build windows object dynamically from current TSS_CONFIGS
        Object.entries(TSS_CONFIGS).forEach(([windowType, config]) => {
            tssResults.windows[config.displayKey] = getTSSWindowData(tssData, windowType);
        });

        // Calculate TSS accumulation over time
        tssAccumulation = calculateTSSAccumulation(powerData, ftp, powerExponent);
    }

    // Ensure TSS display is built with current config
    rebuildTSSDisplay();

    updateStats(hrRecords, powerRecords, allTimestamps, tssResults);
    plotTSSAccumulation(tssAccumulation);

    const ctx = document.getElementById('hrChart').getContext('2d');

    if (chart) {
        chart.destroy();
    }

    const datasets = [];

    // Add heart rate dataset if data exists
    if (hrData.length > 0) {
        datasets.push({
            label: 'Heart Rate (bpm)',
            data: hrData,
            borderColor: '#e91e63',
            backgroundColor: 'rgba(233, 30, 99, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 5,
            yAxisID: 'y'
        });
    }

    // Add power dataset if data exists
    if (powerData.length > 0) {
        datasets.push({
            label: 'Power (watts)',
            data: powerData,
            borderColor: '#2196F3',
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 5,
            yAxisID: 'y1'
        });

        // Referenslinjen ritas på CP, inte på den härledda FTP: CP är den gräns
        // som säger något om passet - över den töms W', under den fylls det på.
        // FTP är bara TSS-nämnaren, och den hör hemma i hjälptexten.
        const cp = currentCP();
        const maxTime = Math.max(...powerData.map(p => p.x));
        datasets.push({
            label: `CP (${cp}W)`,
            data: [{ x: 0, y: cp }, { x: maxTime, y: cp }],
            borderColor: '#FF9800',
            backgroundColor: 'rgba(255, 152, 0, 0.1)',
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 0,
            yAxisID: 'y1'
        });

        // Add Max Peak Power reference line
        const maxPeakPower = parseInt(document.getElementById('maxPeakPowerInput').value) || CONFIG.DEFAULT_MAX_PEAK_POWER;
        datasets.push({
            label: `Max Peak (${maxPeakPower}W)`,
            data: [{ x: 0, y: maxPeakPower }, { x: maxTime, y: maxPeakPower }],
            borderColor: '#F44336',
            backgroundColor: 'rgba(244, 67, 54, 0.1)',
            borderWidth: 2,
            borderDash: [10, 5],
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 0,
            yAxisID: 'y1'
        });
    }

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: function (context) {
                            return 'Time: ' + context[0].parsed.x.toFixed(1) + ' min';
                        },
                        label: function (context) {
                            const label = context.dataset.label;
                            const value = context.parsed.y;
                            if (label.includes('Heart Rate')) {
                                return label + ': ' + value + ' bpm';
                            } else if (label.includes('Power')) {
                                return label + ': ' + value + ' watts';
                            }
                            return label + ': ' + value;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Time (minutes)'
                    },
                    type: 'linear',
                    position: 'bottom'
                },
                y: {
                    type: 'linear',
                    display: hrData.length > 0,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Heart Rate (bpm)'
                    },
                    beginAtZero: false
                },
                y1: {
                    type: 'linear',
                    display: powerData.length > 0,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Power (watts)'
                    },
                    beginAtZero: true,
                    grid: {
                        drawOnChartArea: false,
                    },
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });

    document.getElementById('stats').style.display = 'grid';
}

function updateChartReferenceLines() {
    if (!chart || !chart.data.datasets) return;

    const cp = currentCP();
    const maxPeakPower = parseInt(document.getElementById('maxPeakPowerInput').value) || CONFIG.DEFAULT_MAX_PEAK_POWER;

    // Find power data to get max time
    const powerDataset = chart.data.datasets.find(ds => ds.label === 'Power (watts)');
    if (!powerDataset || powerDataset.data.length === 0) return;

    const maxTime = Math.max(...powerDataset.data.map(p => p.x));

    // Update CP line
    const cpDataset = chart.data.datasets.find(ds => ds.label.startsWith('CP ('));
    if (cpDataset) {
        cpDataset.label = `CP (${cp}W)`;
        cpDataset.data = [{ x: 0, y: cp }, { x: maxTime, y: cp }];
    }

    // Update Max Peak Power line
    const maxPeakDataset = chart.data.datasets.find(ds => ds.label.includes('Max Peak'));
    if (maxPeakDataset) {
        maxPeakDataset.label = `Max Peak (${maxPeakPower}W)`;
        maxPeakDataset.data = [{ x: 0, y: maxPeakPower }, { x: maxTime, y: maxPeakPower }];
    }

    chart.update();

    // Also update workout chart reference lines if it exists
    updateWorkoutChartReferenceLines();

    // Recalculate workout TSS if workout is loaded
    recalculateWorkoutTSS();
}

function updateWorkoutChartReferenceLines() {
    if (!workoutChart || !workoutChart.data.datasets) return;

    const cp = currentCP();
    const maxPeakPower = parseInt(document.getElementById('maxPeakPowerInput').value) || CONFIG.DEFAULT_MAX_PEAK_POWER;

    // Find workout data to get max time
    const workoutDataset = workoutChart.data.datasets.find(ds => ds.label === 'Target Power (watts)');
    if (!workoutDataset || workoutDataset.data.length === 0) return;

    const maxTime = Math.max(...workoutDataset.data.map(p => p.x));

    // Update CP line
    const cpDataset = workoutChart.data.datasets.find(ds => ds.label.startsWith('CP ('));
    if (cpDataset) {
        cpDataset.label = `CP (${cp}W)`;
        cpDataset.data = [{ x: 0, y: cp }, { x: maxTime, y: cp }];
    }

    // Update Max Peak Power line
    const maxPeakDataset = workoutChart.data.datasets.find(ds => ds.label.includes('Max Peak'));
    if (maxPeakDataset) {
        maxPeakDataset.label = `Max Peak (${maxPeakPower}W)`;
        maxPeakDataset.data = [{ x: 0, y: maxPeakPower }, { x: maxTime, y: maxPeakPower }];
    }

    workoutChart.update();
}

function plotTSSAccumulation(tssData) {
    console.log('plotTSSAccumulation called with:', tssData);

    if (!tssData) {
        console.log('No TSS data, hiding chart');
        document.getElementById('tssChartContainer').style.display = 'none';
        return;
    }

    console.log('Showing TSS accumulation chart');
    document.getElementById('tssChartContainer').style.display = 'block';

    const ctx = document.getElementById('tssChart').getContext('2d');

    if (tssChart) {
        tssChart.destroy();
    }

    const datasets = [];

    // Add datasets for each TSS window using config
    Object.entries(TSS_CONFIGS).forEach(([windowType, config]) => {
        console.log(`Checking TSS data for ${windowType}:`, config.elementId, 'has data:', !!tssData[config.elementId]);

        if (tssData[config.elementId] && tssData[config.elementId].some(v => v !== null)) {
            console.log(`Adding dataset for ${windowType} with ${tssData[config.elementId].length} points`);

            // Parse rgba from hex color
            const hexToRgba = (hex, alpha) => {
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                return `rgba(${r}, ${g}, ${b}, ${alpha})`;
            };

            datasets.push({
                label: config.label,
                data: tssData.timestamps.map((time, i) => ({ x: time, y: tssData[config.elementId][i] })),
                borderColor: config.chartColor,
                backgroundColor: hexToRgba(config.chartColor, 0.1),
                borderWidth: config.reference ? 3 : 2,
                tension: 0.4,
                fill: false,
                pointRadius: 0,
                pointHoverRadius: 5
            });
        } else {
            console.log(`No valid data for ${windowType}`);
        }
    });

    console.log(`Created ${datasets.length} datasets for TSS chart`);

    tssChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: function (context) {
                            return 'Time: ' + context[0].parsed.x.toFixed(1) + ' min';
                        },
                        label: function (context) {
                            const label = context.dataset.label;
                            const value = context.parsed.y;
                            return label + ': ' + (value ? value.toFixed(1) : 'N/A');
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Time (minutes)'
                    },
                    type: 'linear',
                    position: 'bottom'
                },
                y: {
                    title: {
                        display: true,
                        text: 'TSS (Training Stress Score)'
                    },
                    beginAtZero: true
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

function updateStats(hrRecords, powerRecords, timestamps, tssResults) {
    // Heart rate stats
    if (hrRecords.length > 0) {
        const heartRates = hrRecords.map(r => r.heart_rate);
        const avgHR = heartRates.reduce((a, b) => a + b, 0) / heartRates.length;
        const maxHR = Math.max(...heartRates);
        updateElementText('avgHR', Math.round(avgHR));
        updateElementText('maxHR', maxHR);
    } else {
        updateElementText('avgHR', '--');
        updateElementText('maxHR', '--');
    }

    // Power stats
    if (powerRecords.length > 0) {
        const powers = powerRecords.map(r => r.power);
        const avgPower = powers.reduce((a, b) => a + b, 0) / powers.length;
        const maxPower = Math.max(...powers);
        updateElementText('avgPower', Math.round(avgPower));
        updateElementText('maxPower', maxPower);
    } else {
        updateElementText('avgPower', '--');
        updateElementText('maxPower', '--');
    }

    // Duration
    if (timestamps.length > 0) {
        const duration = timestamps[timestamps.length - 1];
        updateElementText('duration', duration.toFixed(1) + ' min');
    } else {
        updateElementText('duration', '--');
    }

    // TSS stats
    if (tssResults) {
        updateTSSDisplayValues(tssResults);
        updateCleaningNote(tssResults.cleaning);
        document.getElementById('tssStats').style.display = 'grid';
    } else {
        // Clear all TSS values when no results available
        Object.keys(TSS_CONFIGS).forEach(windowType => {
            updateElementText(TSS_CONFIGS[windowType].elementId, '--');
        });
        updateElementText('tssSpread', '--');
        updateCleaningNote(null);
        document.getElementById('tssStats').style.display = 'none';
    }
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    document.querySelector('.upload-section').appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

// =============================================================================
// PRIVATE FUNCTIONS - Data processing and calculations
// =============================================================================

// Utility function to calculate elapsed time in minutes
function calculateElapsedMinutes(timestamp, startTime) {
    return (new Date(timestamp) - new Date(startTime)) / 1000 / 60;
}

// Helper function to safely get TSS window data
function getTSSWindowData(tssData, windowType) {
    const config = TSS_CONFIGS[windowType];
    const windowData = tssData.windows[config.seconds];
    return {
        available: windowData && windowData.NP !== null,
        np: windowData ? windowData.NP : 0,
        tss: windowData ? windowData.TSS : 0
    };
}

// Helper function to update DOM element text content
function updateElementText(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    } else {
        console.warn(`Element with id '${elementId}' not found`);
    }
}

// Variabilitetsindex: skillnaden mellan kortaste och längsta fönstret (FA-4).
// Ett kort fönster låter topparna överleva utjämningen, ett långt slätar ut dem och
// konvergerar mot medeleffekten - alltså mäter avståndet mellan dem hur ojämnt
// passet var. All data finns redan beräknad; det är spektrumets läsvärde.
function calculateVariabilitySpread(tssResults) {
    const windows = Object.values(TSS_CONFIGS).filter(config => config.seconds > 0);
    if (windows.length < 2) return null;

    const shortest = windows.reduce((a, b) => (a.seconds <= b.seconds ? a : b));
    const longest = windows.reduce((a, b) => (a.seconds >= b.seconds ? a : b));

    const shortData = tssResults.windows[shortest.displayKey];
    const longData = tssResults.windows[longest.displayKey];
    if (!shortData?.available || !longData?.available) return null;

    return {
        spread: shortData.tss - longData.tss,
        shortSeconds: shortest.seconds,
        longSeconds: longest.seconds
    };
}

// Läsregeln ur docs/10-fel-fit-analysis.md FA-4.
function readVariabilitySpread(spread) {
    if (spread < 5) return 'jämnt distans- eller tempopass, dosen är aerob';
    if (spread <= 20) return 'strukturerade långa intervaller, måttlig variabilitet';
    if (spread <= 40) return 'tydlig variabilitet, mellan de dokumenterade banden';
    return 'kort, hård, intermittent belastning – den anaeroba kostnaden dominerar';
}

// Uppdatera samtliga TSS-rutor plus spridningen. Både omräkningen och
// statistikpanelen går genom den här, så de kan inte glida ifrån varandra.
// Säg vad koden gjorde med nollorna. Tolkningen är hela poängen med FA-1: en
// frihjulad nolla och ett sensorbortfall ser identiska ut i effektserien, och
// valet mellan dem flyttar TSS.
function updateCleaningNote(cleaning) {
    const note = document.getElementById('cleaningNote');
    if (!note) return;

    if (!cleaning) {
        note.textContent = '';
        return;
    }

    const parts = [];
    if (cleaning.interpolated > 0) {
        parts.push(`${cleaning.interpolated} nollor tolkade som sensorbortfall och interpolerade`);
    }
    if (cleaning.zerosKept > 0) {
        parts.push(`${cleaning.zerosKept} nollor behållna som data (frihjulning eller stillastående)`);
    }
    if (parts.length === 0) {
        note.textContent = 'Inga nollvärden i filen.';
        return;
    }

    const source = cleaning.cadenceDecided > 0
        ? `${cleaning.cadenceDecided} av dem avgjorda med kadens ur filen`
        : 'ingen kadenskanal i filen, så isolerade nollor räknas som bortfall och serier som frihjulning';

    note.textContent = `Nollvärden: ${parts.join(', ')} – ${source}.`;
}

function updateTSSDisplayValues(tssResults) {
    Object.keys(TSS_CONFIGS).forEach(windowType => {
        updateTSSElement(windowType, tssResults);
    });

    const variability = calculateVariabilitySpread(tssResults);
    if (variability) {
        updateElementText('tssSpread', variability.spread.toFixed(1));
        updateElementText('tssSpreadNote',
            `TSS@${variability.shortSeconds}s − TSS@${variability.longSeconds}s: ${readVariabilitySpread(variability.spread)}`);
    } else {
        updateElementText('tssSpread', '--');
        updateElementText('tssSpreadNote', 'kräver minst två beräknade fönster');
    }
}

// Helper function to update TSS display values
function updateTSSElement(windowType, tssResults) {
    const config = TSS_CONFIGS[windowType];
    const windowData = tssResults.windows[config.displayKey];

    console.log(`updateTSSElement for ${windowType}:`, {
        elementId: config.elementId,
        displayKey: config.displayKey,
        windowData: windowData,
        available: windowData?.available
    });

    // Fallbacktext när fönstret inte kunde beräknas: passet är kortare än fönstret.
    // Uttryckt i fönsterlängd i stället för i en nyckel, så den följer med när
    // fönstren konfigureras om.
    const fallbackText = config.seconds > 0 ? `N/A (<${config.seconds}s)` : '--';

    const value = windowData?.available ? windowData.tss.toFixed(1) : fallbackText;
    console.log(`Setting element ${config.elementId} to value: ${value}`);
    updateElementText(config.elementId, value);
}

// Noll watt betyder tre olika saker, och effektserien ensam kan inte skilja dem
// (FA-1). Kadensen kan:
//
//   0 W, kadens > 0  -> sensorbortfall: man trampar men mätaren registrerar inte
//   0 W, kadens = 0  -> frihjulning eller stillastående: en äkta nolla
//
// Båda kanalerna finns i FIT-filen. Saknas kadens - CSV-import, eller en fil utan
// kadensgivare - faller koden tillbaka på den gamla regeln: interpolera isolerade
// nollor, behåll serier.
function isSensorDropout(point) {
    if (typeof point.cadence !== 'number') return null;
    return point.cadence > 0;
}

// Linjär interpolation mellan närmaste positiva effekt före och efter.
function interpolatePower(points, index) {
    let before = null;
    let after = null;

    for (let i = index - 1; i >= 0; i--) {
        if (points[i].p > 0) { before = points[i]; break; }
    }
    for (let i = index + 1; i < points.length; i++) {
        if (points[i].p > 0) { after = points[i]; break; }
    }

    if (before && after) {
        const span = after.t - before.t;
        const share = span > 0 ? (points[index].t - before.t) / span : 0.5;
        return before.p + (after.p - before.p) * share;
    }

    if (before) return before.p;
    if (after) return after.p;
    return 0;
}

// Robust data cleaning for interval training power data
function cleanPowerData(rawPowerData) {
    console.log('🔧 Cleaning power data:', rawPowerData.length, 'points');

    // Step 1: Sort and deduplicate by time
    const sortedData = rawPowerData.slice().sort((a, b) => a.t - b.t);
    const deduped = [];
    const seen = new Set();

    for (const point of sortedData) {
        const key = point.t.toString();
        if (!seen.has(key)) {
            deduped.push(point);
            seen.add(key);
        }
    }

    // Step 2: Skilj sensorbortfall från äkta nollor, med kadens när den finns
    const cleaned = deduped.map(point => ({ ...point }));
    let interpolated = 0;
    let zerosKept = 0;
    let cadenceDecided = 0;

    for (let i = 0; i < cleaned.length; i++) {
        if (cleaned[i].p !== 0) continue;

        const dropout = isSensorDropout(cleaned[i]);
        let treatAsDropout;

        if (dropout === null) {
            // Ingen kadenskanal: bara isolerade nollor är sannolika bortfall
            const prevPower = i > 0 ? deduped[i - 1].p : 0;
            const nextPower = i < deduped.length - 1 ? deduped[i + 1].p : 0;
            treatAsDropout = prevPower > 0 && nextPower > 0;
        } else {
            treatAsDropout = dropout;
            cadenceDecided++;
        }

        if (treatAsDropout) {
            cleaned[i].p = interpolatePower(deduped, i);
            interpolated++;
        } else {
            zerosKept++;
        }
    }

    console.log(`🔧 Cleaned: ${sortedData.length} → ${deduped.length} points, ${interpolated} zeros interpolated as dropouts, ${zerosKept} kept as data (${cadenceDecided} decided by cadence)`);

    return {
        points: cleaned,
        interpolated: interpolated,
        zerosKept: zerosKept,
        cadenceDecided: cadenceDecided
    };
}

// Mediansamplingsintervallet, alltså hur tätt filen faktiskt spelar in.
function medianInterval(powerData) {
    const gaps = [];
    for (let i = 1; i < powerData.length; i++) {
        gaps.push(powerData[i].t - powerData[i - 1].t);
    }
    if (gaps.length === 0) return 1;

    gaps.sort((a, b) => a - b);
    return gaps[Math.floor(gaps.length / 2)];
}

// Resampla till 1 Hz före beräkningen (FA-2, den riktiga lösningen). Standard-NP
// är definierad på 1-sekundersdata, och ett rullande medelvärde förutsätter jämnt
// spridda punkter - med gles eller ojämn sampling räknar man i praktiken på något
// annat än NP, oavsett hur täckningskravet formuleras. Efteråt betyder varje
// fönsterlängd samma sak i alla filer, vilket är en förutsättning för att
// fönsterspektrumet ska gå att jämföra mellan pass och enheter.
//
// Senaste värdet hålls över luckor upp till tre mediansamplingsintervall, vilket
// är vad smart recording betyder: en punkt skrivs när värdet ändras. Större
// luckor är pauser eller signalbortfall och lämnas tomma - då avvisar
// täckningskravet de fönster som överlappar dem, i stället för att koden hittar
// på effekt som aldrig mättes.
function resampleTo1Hz(powerData) {
    if (powerData.length < 2) return powerData;

    const maxHold = Math.max(2, 3 * medianInterval(powerData));
    const firstSecond = Math.ceil(powerData[0].t);
    const lastSecond = Math.floor(powerData[powerData.length - 1].t);
    const resampled = [];
    let index = 0;

    for (let t = firstSecond; t <= lastSecond; t++) {
        while (index + 1 < powerData.length && powerData[index + 1].t <= t) {
            index++;
        }

        const sample = powerData[index];
        if (t - sample.t <= maxHold) {
            resampled.push({ ...sample, t: t });
        }
    }

    console.log(`🕐 Resampled to 1 Hz: ${powerData.length} → ${resampled.length} points (max hold ${maxHold}s)`);
    return resampled;
}

function computeNP_by_time(rawPowerData, ftp, windowSecondsList = TSS_WINDOW_SECONDS, exponent = CONFIG.DEFAULT_POWER_EXPONENT) {
    if (!rawPowerData || rawPowerData.length < 2) throw new Error("Behöver minst två datapunkter med tidsstämplar.");

    // Clean the data first, then put it on a 1 Hz grid
    const cleaning = cleanPowerData(rawPowerData);
    const cleanedData = cleaning.points;
    const powerData = resampleTo1Hz(cleanedData);

    if (powerData.length < 2) throw new Error("Behöver minst två datapunkter med tidsstämplar.");

    // Basic stats
    const firstTs = powerData[0].t;
    const lastTs = powerData[powerData.length - 1].t;
    const duration = lastTs - firstTs;
    const samples = powerData.length;
    const sourceSamplingHz = cleanedData.length / (cleanedData[cleanedData.length - 1].t - cleanedData[0].t);

    console.log('📊 Data stats:', samples, 'points over', duration.toFixed(1), 's, filens sampling:', sourceSamplingHz.toFixed(2), 'Hz');

    // Robust window averaging with fixed step size
    function robustWindowAverages(windowSec) {
        if (windowSec > duration * 0.9) return [];

        const averages = [];
        const stepSize = Math.max(1, Math.floor(windowSec / 60)); // Adaptive step size

        // Täckningskravet är en kvot, och nu jämför den två storheter av samma slag:
        // serien ligger på ett 1 Hz-rutnät, så förväntat antal punkter är
        // fönsterlängden i sekunder. Bara äkta luckor - pauser och signalbortfall
        // som resamplingen lämnade tomma - kan numera fälla ett fönster.
        const minPoints = windowSec * CONFIG.RESAMPLE_HZ * CONFIG.WINDOW_COVERAGE_THRESHOLD;

        for (let start = firstTs; start + windowSec <= lastTs; start += stepSize) {
            const end = start + windowSec;
            const windowPoints = powerData.filter(p => p.t >= start && p.t < end);

            if (windowPoints.length >= minPoints) {
                const avg = windowPoints.reduce((sum, p) => sum + p.p, 0) / windowPoints.length;
                averages.push(avg);
            }
        }

        return averages;
    }

    const results = {
        samples,
        duration,
        firstTs,
        lastTs,
        sourceSamplingHz,
        cleaning,
        windows: {}
    };

    // Calculate NP for each window size
    const npValues = {};
    for (const w of windowSecondsList) {
        if (w === -1) {
            // Special case for Base TSS - use simple average power
            const totalPower = powerData.reduce((sum, p) => sum + p.p, 0);
            const avgPower = totalPower / powerData.length;

            npValues[w] = avgPower;
            const TSS = (duration / 3600) * Math.pow(avgPower / ftp, 2) * 100;
            results.windows[w] = {
                windowsProcessed: 1,
                NP: Math.round(avgPower * 10) / 10,
                TSS: Math.round(TSS * 10) / 10
            };

            console.log(`⚡ Base: Average power ${avgPower.toFixed(1)}W, TSS ${TSS.toFixed(1)}`);
            continue;
        }

        const avgs = robustWindowAverages(w);
        const count = avgs.length;

        if (count === 0) {
            results.windows[w] = { windowsProcessed: 0, NP: null, TSS: null };
            npValues[w] = null;
            continue;
        }

        // Calculate NP with robust math
        let sumPow = 0;
        for (const a of avgs) {
            sumPow += Math.pow(Math.max(1, a), exponent); // Prevent negative powers
        }
        const meanPow = sumPow / count;
        const NP = Math.pow(meanPow, 1 / exponent);
        npValues[w] = NP;

        const TSS = (duration / 3600) * Math.pow(NP / ftp, 2) * 100;
        results.windows[w] = { windowsProcessed: count, NP: Math.round(NP * 10) / 10, TSS: Math.round(TSS * 10) / 10 };

        const minAvg = Math.min(...avgs);
        const maxAvg = Math.max(...avgs);
        console.log(`⚡ ${w}s: ${count} windows, range ${minAvg.toFixed(1)}-${maxAvg.toFixed(1)}W, NP ${NP.toFixed(1)}W, TSS ${TSS.toFixed(1)}`);
    }

    console.log('📋 NP calculation completed without order corrections');

    return results;
}

// Ackumulerad TSS över tid, räknad per bit av passet i stället för per prefix
// (FA-3). Den gamla kurvan körde hela NP-beräkningen om från passets början vid
// varje punkt, alltså en fullständig omanpassning över allt som hittills hänt. En
// hård insats tidigt räknades då om mot ett växande underlag och fortsatte ge
// tillskott långt efter att den var över: kurvan växte som roten ur tiden, för
// alltid, även om atleten stannade helt.
//
// NP och TSS är definierade för ett helt pass, som en sammanfattning i efterhand,
// inte som funktioner av förfluten tid. Här delas passet därför i bitar, varje bit
// får sin egen dos beräknad isolerat, och bitarna summeras. Då är kurvan en äkta
// löpande summa: varje minut bidrar en gång, och kurvan planar ut när arbetet
// upphör.
const ACCUMULATION_SLICE = 60; // sekunder per bit

// En bit kan inte vara kortare än fönstret som ska mätas i den. För fönster som
// är minst lika långa som biten blir NP över en enda fönsterbredd definitionsmässigt
// bitens medeleffekt, vilket är precis vad baslinjegrenen (-1) räknar.
function sliceTSS(slice, windowSeconds, ftp, powerExponent) {
    if (!slice || slice.length < 2) return 0;

    const useRolling = windowSeconds > 0 && windowSeconds < ACCUMULATION_SLICE;
    const window = useRolling ? windowSeconds : -1;
    const result = computeNP_by_time(slice, ftp, [window], powerExponent);
    const data = result.windows[window];

    return data && data.TSS ? data.TSS : 0;
}

function calculateTSSAccumulation(powerData, ftp, powerExponent) {
    if (!powerData || powerData.length < 2) return null;

    const firstTs = powerData[0].t;
    const duration = powerData[powerData.length - 1].t - firstTs;

    const timestamps = [];
    for (let t = ACCUMULATION_SLICE; t <= duration; t += ACCUMULATION_SLICE) {
        timestamps.push(t / 60); // Convert to minutes for chart
    }

    const tssData = {};

    Object.values(TSS_CONFIGS).forEach(config => {
        const sliceSec = Math.max(ACCUMULATION_SLICE, config.seconds);
        const series = [];

        let accumulated = 0;
        let sliceStart = firstTs;
        let boundary = sliceSec;

        timestamps.forEach(minutes => {
            const elapsed = minutes * 60;

            // Summera de bitar som hunnit bli fullständiga
            while (elapsed >= boundary) {
                const slice = powerData.filter(p => p.t >= sliceStart && p.t < firstTs + boundary);
                accumulated += sliceTSS(slice, config.seconds, ftp, powerExponent);
                sliceStart = firstTs + boundary;
                boundary += sliceSec;
            }

            series.push(accumulated > 0 ? Math.round(accumulated * 10) / 10 : null);
        });

        tssData[config.elementId] = series;
    });

    return {
        timestamps,
        ...tssData
    };
}

// =============================================================================
// WORKOUT PLAN VISUALIZATION
// =============================================================================

async function loadAndDisplayWorkout() {
    try {
        const response = await fetch('sample-workout.json');
        const workout = await response.json();
        console.log('Loaded workout:', workout);

        // Store workout globally for recalculation
        currentWorkout = workout;

        plotWorkoutPlan(workout);
    } catch (error) {
        console.error('Failed to load workout:', error);
    }
}

function plotWorkoutPlan(workout) {
    const ctx = document.getElementById('workoutChart').getContext('2d');

    if (workoutChart) {
        workoutChart.destroy();
    }

    // Generate workout timeline data
    const workoutData = generateWorkoutTimeline(workout);

    // Calculate TSS for perfect execution
    calculateWorkoutTSS(workout);

    const datasets = [{
        label: 'Target Power (watts)',
        data: workoutData,
        borderColor: '#9C27B0',
        backgroundColor: 'rgba(156, 39, 176, 0.1)',
        borderWidth: 3,
        tension: 0,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 5,
        stepped: true
    }];

    // Add CP and Max Peak Power reference lines
    const cp = currentCP();
    const maxPeakPower = parseInt(document.getElementById('maxPeakPowerInput').value) || CONFIG.DEFAULT_MAX_PEAK_POWER;
    const maxTime = Math.max(...workoutData.map(p => p.x));

    // CP reference line
    datasets.push({
        label: `CP (${cp}W)`,
        data: [{ x: 0, y: cp }, { x: maxTime, y: cp }],
        borderColor: '#FF9800',
        backgroundColor: 'rgba(255, 152, 0, 0.1)',
        borderWidth: 2,
        borderDash: [5, 5],
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 0
    });

    // Max Peak Power reference line
    datasets.push({
        label: `Max Peak (${maxPeakPower}W)`,
        data: [{ x: 0, y: maxPeakPower }, { x: maxTime, y: maxPeakPower }],
        borderColor: '#F44336',
        backgroundColor: 'rgba(244, 67, 54, 0.1)',
        borderWidth: 2,
        borderDash: [10, 5],
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 0
    });

    workoutChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: function (context) {
                            return 'Time: ' + context[0].parsed.x.toFixed(1) + ' min';
                        },
                        label: function (context) {
                            const label = context.dataset.label;
                            const value = context.parsed.y;
                            return label + ': ' + value + ' watts';
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Time (minutes)'
                    },
                    type: 'linear',
                    position: 'bottom'
                },
                y: {
                    title: {
                        display: true,
                        text: 'Power (watts)'
                    },
                    beginAtZero: true
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

function generateWorkoutTimeline(workout) {
    const timeline = [];
    const ftp = currentFTP();
    let currentTime = 0;

    workout.segments.forEach(segment => {
        currentTime = processSegment(segment, timeline, currentTime, ftp);
    });

    return timeline;
}

function processSegment(segment, timeline, currentTime, ftp) {
    // Målen räknas om till watt först vid visning
    const step = (target, duration) => {
        const watt = segmentWatt(target, ftp);
        timeline.push({ x: currentTime / 60, y: watt });
        currentTime += duration;
        timeline.push({ x: currentTime / 60, y: watt });
    };

    if (segment.type === 'interval' && segment.repeat) {
        // Handle repeated intervals
        for (let i = 0; i < segment.repeat; i++) {
            if (segment.subSegments && segment.subSegments.length > 0) {
                // Recursive intervals with sub-segments
                segment.subSegments.forEach(subSegment => {
                    step(subSegment, subSegment.duration);
                });
            } else {
                // Simple interval
                step(segment, segment.duration);
            }

            // Rest period (except after last interval)
            if (i < segment.repeat - 1 && segment.rest) {
                step(segment.rest, segment.rest.duration);
            }
        }
    } else {
        // Simple segment (warmup, cooldown, etc.)
        step(segment, segment.duration);
    }

    return currentTime;
}

function calculateWorkoutTSS(workout) {
    const ftp = currentFTP();

    // Convert workout to power data format (1-second intervals)
    const powerData = generateWorkoutPowerData(workout, ftp);

    if (powerData.length === 0) return;

    const powerExponent = parseFloat(document.getElementById('powerRaiseInput').value) || CONFIG.DEFAULT_POWER_EXPONENT;

    console.log('Calculating workout TSS with', powerData.length, 'data points');

    // Calculate TSS using the same function as for real data
    const tssData = computeNP_by_time(powerData, ftp, getTSSWindowSeconds(), powerExponent);

    // Convert to display format
    const tssResults = {
        duration: {
            seconds: tssData.duration,
            minutes: Math.round(tssData.duration / 60),
            hours: Math.round(tssData.duration / 3600 * 10) / 10
        },
        cleaning: tssData.cleaning,
        windows: {}
    };

    // Build windows object dynamically from current TSS_CONFIGS
    Object.entries(TSS_CONFIGS).forEach(([windowType, config]) => {
        tssResults.windows[config.displayKey] = getTSSWindowData(tssData, windowType);
    });

    // Display workout TSS scores
    displayWorkoutTSS(workout, tssResults);
}

function generateWorkoutPowerData(workout, ftp) {
    const powerData = [];
    let currentTime = 0;

    workout.segments.forEach(segment => {
        currentTime = processSegmentPowerData(segment, powerData, currentTime, ftp);
    });

    return powerData;
}

function processSegmentPowerData(segment, powerData, currentTime, ftp) {
    // Ett steg i passet, i watt vid den FTP som gäller nu
    const fill = (target, duration) => {
        const watt = segmentWatt(target, ftp);
        for (let t = 0; t < duration; t++) {
            powerData.push({ t: currentTime + t, p: watt });
        }
        currentTime += duration;
    };

    if (segment.type === 'interval' && segment.repeat) {
        // Handle repeated intervals
        for (let i = 0; i < segment.repeat; i++) {
            if (segment.subSegments && segment.subSegments.length > 0) {
                // Recursive intervals with sub-segments
                segment.subSegments.forEach(subSegment => {
                    fill(subSegment, subSegment.duration);
                });
            } else {
                // Simple interval - add 1-second data points
                fill(segment, segment.duration);
            }

            // Rest period (except after last interval)
            if (i < segment.repeat - 1 && segment.rest) {
                fill(segment.rest, segment.rest.duration);
            }
        }
    } else {
        // Simple segment - add 1-second data points
        fill(segment, segment.duration);
    }

    return currentTime;
}

function displayWorkoutTSS(workout, tssResults) {
    // Create or update workout TSS display
    let workoutTSSContainer = document.getElementById('workoutTSSStats');

    if (!workoutTSSContainer) {
        workoutTSSContainer = document.createElement('div');
        workoutTSSContainer.id = 'workoutTSSStats';
        workoutTSSContainer.className = 'stats';
        workoutTSSContainer.style.marginTop = '15px';

        // Add title
        const title = document.createElement('h4');
        title.textContent = `Planned TSS for "${workout.name}"`;
        title.style.margin = '0 0 15px 0';
        title.style.color = '#333';

        const workoutContainer = document.getElementById('workoutChartContainer');
        workoutContainer.insertBefore(title, workoutContainer.firstChild.nextSibling);
        workoutContainer.insertBefore(workoutTSSContainer, workoutContainer.children[2]);
    }

    // Clear existing content
    workoutTSSContainer.innerHTML = '';

    // Add duration info
    const durationBox = document.createElement('div');
    durationBox.className = 'stat-box';
    durationBox.style.background = '#e3f2fd';
    durationBox.innerHTML = `
        <div class="stat-label">Duration</div>
        <div class="stat-value" style="color: #1976d2;">${tssResults.duration.minutes} min</div>
    `;
    workoutTSSContainer.appendChild(durationBox);

    // Add TSS values for each configured window
    Object.entries(TSS_CONFIGS).forEach(([windowType, config]) => {
        const windowData = tssResults.windows[config.displayKey];
        const value = windowData?.available ? windowData.tss.toFixed(1) : '--';

        const statBox = document.createElement('div');
        statBox.className = 'stat-box';
        statBox.style.background = config.chartBackground;
        statBox.innerHTML = `
            <div class="stat-label">${config.label}</div>
            <div class="stat-value" style="color: ${config.chartColor};">${value}</div>
        `;
        workoutTSSContainer.appendChild(statBox);
    });
}

function recalculateWorkoutTSS() {
    if (!currentWorkout) return;
    console.log('Recalculating workout TSS...');
    calculateWorkoutTSS(currentWorkout);
}

// =============================================================================
// TSS CONFIGURATION MANAGEMENT
// =============================================================================

function showTSSConfigPanel() {
    renderTSSConfigList();
    document.getElementById('tssConfigPanel').style.display = 'block';
}

function hideTSSConfigPanel() {
    document.getElementById('tssConfigPanel').style.display = 'none';
}

function renderTSSConfigList() {
    const container = document.getElementById('tssConfigList');
    container.innerHTML = '';

    Object.entries(TSS_CONFIGS).forEach(([key, config]) => {
        const item = document.createElement('div');
        item.className = 'config-item';
        item.innerHTML = `
            <label>${config.label}</label>
            <input type="number" min="1" max="7200" value="${config.seconds}"
                   onchange="updateTSSConfig('${key}', 'seconds', parseInt(this.value))">
            <input type="text" value="${config.label}"
                   onchange="updateTSSConfig('${key}', 'label', this.value)">
            <input type="color" value="${config.chartColor}"
                   onchange="updateTSSConfig('${key}', 'chartColor', this.value)">
            <button class="remove-btn" onclick="removeTSSConfig('${key}')">Remove</button>
        `;
        container.appendChild(item);
    });
}

function updateTSSConfig(key, property, value) {
    if (TSS_CONFIGS[key]) {
        TSS_CONFIGS[key][property] = value;

        // displayKey är identifieraren resultaten slås upp med och måste därför
        // härledas ur fönsterlängden (FA-7). Den gamla formen avrundade till hela
        // minuter, så 90 s och 120 s blev båda '2Minute' och skrev över varandra.
        // Med w${seconds} betyder lika nyckel lika fönsterlängd, alltså samma
        // korrekta värde - kollisionen är omöjlig att göra fel.
        if (property === 'seconds') {
            TSS_CONFIGS[key].displayKey = `w${value}`;
        }

        console.log('TSS Config updated:', key, property, value);

        // Always rebuild display
        rebuildTSSDisplay();

        // Recalculate if data is loaded
        if (currentPowerRecords) {
            console.log('Recalculating with new settings...');
            recalculateWithNewSettings();
        } else {
            console.log('No power data loaded yet');
        }
    }
}

function removeTSSConfig(key) {
    if (Object.keys(TSS_CONFIGS).length <= 1) {
        alert('You must have at least one TSS configuration');
        return;
    }

    delete TSS_CONFIGS[key];
    renderTSSConfigList();

    if (currentPowerRecords) {
        rebuildTSSDisplay();
        recalculateWithNewSettings();
    }
}

function addNewTSSConfig() {
    const newKey = `CUSTOM_${Date.now()}`;
    const newSeconds = 60; // Default to 1 minute

    TSS_CONFIGS[newKey] = {
        seconds: newSeconds,
        displayKey: `w${newSeconds}`,
        elementId: `tss${newKey}`,
        label: `TSS@${newSeconds}s`,
        chartColor: '#9C27B0',
        chartBackground: '#f3e5f5'
    };

    renderTSSConfigList();
    rebuildTSSDisplay();

    if (currentPowerRecords) {
        recalculateWithNewSettings();
    }
}

function resetTSSConfigs() {
    TSS_CONFIGS = createDefaultTSSConfigs();

    renderTSSConfigList();
    rebuildTSSDisplay();

    if (currentPowerRecords) {
        recalculateWithNewSettings();
    }
}

function rebuildTSSDisplay() {
    const container = document.getElementById('tssStats');
    container.innerHTML = '';

    Object.entries(TSS_CONFIGS).forEach(([key, config]) => {
        const statBox = document.createElement('div');
        statBox.className = 'stat-box';
        statBox.style.background = config.chartBackground;
        statBox.innerHTML = `
            <div class="stat-label">${config.label}</div>
            <div class="stat-value" id="${config.elementId}" style="color: ${config.chartColor};">--</div>
            ${config.reference ? '<div class="stat-note">Coggans standardfönster – den siffra som går att jämföra med Strava, TrainingPeaks och WKO. Övriga fönster är verktygets egen utvidgning.</div>' : ''}
        `;
        container.appendChild(statBox);
    });

    const spreadBox = document.createElement('div');
    spreadBox.className = 'stat-box';
    spreadBox.style.background = '#fffde7';
    spreadBox.innerHTML = `
        <div class="stat-label">Spridning (variabilitet)</div>
        <div class="stat-value" id="tssSpread" style="color: #f9a825;">--</div>
        <div class="stat-note" id="tssSpreadNote"></div>
    `;
    container.appendChild(spreadBox);
}

// Make functions globally available for HTML onclick handlers
window.updateTSSConfig = updateTSSConfig;
window.removeTSSConfig = removeTSSConfig;

// =============================================================================
// WORKOUT CONFIGURATION MANAGEMENT
// =============================================================================

function showWorkoutConfigPanel() {
    renderWorkoutEditor();
    document.getElementById('workoutConfigPanel').style.display = 'block';
}

function hideWorkoutConfigPanel() {
    document.getElementById('workoutConfigPanel').style.display = 'none';
}

function renderWorkoutEditor() {
    if (!currentWorkout) return;

    // Set workout name and description
    document.getElementById('workoutName').value = currentWorkout.name || '';
    document.getElementById('workoutDescription').value = currentWorkout.description || '';

    // Render segments
    const container = document.getElementById('workoutSegmentsList');
    container.innerHTML = '';

    currentWorkout.segments.forEach((segment, index) => {
        const segmentDiv = createSegmentEditor(segment, index);
        container.appendChild(segmentDiv);
    });
}

function createSegmentEditor(segment, index) {
    const div = document.createElement('div');
    div.className = `segment-item ${segment.type}-segment`;

    let segmentHTML = `
        <div class="segment-header">
            <span class="segment-type">${segment.type}</span>
            <button class="remove-btn" onclick="removeWorkoutSegment(${index})">Remove</button>
        </div>
    `;

    if (segment.type === 'interval') {
        segmentHTML += `
            <div class="segment-controls">
                <div class="form-group">
                    <label>Repetitions:</label>
                    <input type="number" min="1" max="20" value="${segment.repeat || 1}"
                           onchange="updateWorkoutSegment(${index}, 'repeat', parseInt(this.value))">
                </div>
                <div class="form-group">
                    <label>Interval Type:</label>
                    <select onchange="toggleIntervalType(${index}, this.value)" style="padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px;">
                        <option value="simple" ${(!segment.subSegments || segment.subSegments.length === 0) ? 'selected' : ''}>Simple Interval</option>
                        <option value="complex" ${(segment.subSegments && segment.subSegments.length > 0) ? 'selected' : ''}>Complex (Multi-Step)</option>
                    </select>
                </div>
            </div>
        `;

        // Simple interval controls (only if no sub-segments)
        if (!segment.subSegments || segment.subSegments.length === 0) {
            segmentHTML += `
                <div class="segment-controls">
                    <div class="form-group">
                        <label>Duration (seconds):</label>
                        <input type="number" min="10" max="7200" value="${segment.duration || 240}"
                               onchange="updateWorkoutSegment(${index}, 'duration', parseInt(this.value))">
                    </div>
                    <div class="form-group">
                        <label>Mål (% av FTP) – ${segmentWatt(segment, currentFTP())} W vid FTP ${currentFTP()}:</label>
                        <input type="number" min="0" max="300" step="1" value="${Math.round(segmentPercent(segment, currentFTP()) * 100)}"
                               onchange="updateWorkoutSegment(${index}, 'targetPercent', parseInt(this.value) / 100)">
                    </div>
                </div>
            `;
        }

        // Sub-segments for complex intervals
        if (segment.subSegments && segment.subSegments.length > 0) {
            segmentHTML += `
                <div class="sub-segments-container">
                    <h5>Sub-segments (repeated ${segment.repeat || 1} times):</h5>
                    <div id="subSegments_${index}">
                        ${segment.subSegments.map((subSeg, subIndex) => `
                            <div class="sub-segment-item">
                                <div class="segment-controls">
                                    <div class="form-group">
                                        <label>Duration (sec):</label>
                                        <input type="number" min="5" max="3600" value="${subSeg.duration}"
                                               onchange="updateWorkoutSubSegment(${index}, ${subIndex}, 'duration', parseInt(this.value))">
                                    </div>
                                    <div class="form-group">
                                        <label>Mål (% av FTP) – ${segmentWatt(subSeg, currentFTP())} W:</label>
                                        <input type="number" min="0" max="300" step="1" value="${Math.round(segmentPercent(subSeg, currentFTP()) * 100)}"
                                               onchange="updateWorkoutSubSegment(${index}, ${subIndex}, 'targetPercent', parseInt(this.value) / 100)">
                                    </div>
                                    <div class="form-group">
                                        <button class="remove-btn" onclick="removeSubSegment(${index}, ${subIndex})">Remove</button>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <button class="config-btn" onclick="addSubSegment(${index})" style="margin-top: 10px;">Add Sub-segment</button>
                </div>
            `;
        }

        // Rest controls
        if (segment.rest) {
            segmentHTML += `
                <div class="rest-controls">
                    <h5>Rest Between Intervals</h5>
                    <div class="segment-controls">
                        <div class="form-group">
                            <label>Rest Duration (seconds):</label>
                            <input type="number" min="10" max="1800" value="${segment.rest.duration}"
                                   onchange="updateWorkoutSegmentRest(${index}, 'duration', parseInt(this.value))">
                        </div>
                        <div class="form-group">
                            <label>Vila (% av FTP):</label>
                            <input type="number" min="0" max="300" step="1" value="${Math.round(segmentPercent(segment.rest, currentFTP()) * 100)}"
                                   onchange="updateWorkoutSegmentRest(${index}, 'targetPercent', parseInt(this.value) / 100)">
                        </div>
                    </div>
                </div>
            `;
        }
    } else {
        // Simple segment (warmup, cooldown)
        segmentHTML += `
            <div class="segment-controls">
                <div class="form-group">
                    <label>Duration (seconds):</label>
                    <input type="number" min="10" max="7200" value="${segment.duration}"
                           onchange="updateWorkoutSegment(${index}, 'duration', parseInt(this.value))">
                </div>
                <div class="form-group">
                    <label>Mål (% av FTP):</label>
                    <input type="number" min="0" max="300" step="1" value="${Math.round(segmentPercent(segment, currentFTP()) * 100)}"
                           onchange="updateWorkoutSegment(${index}, 'targetPercent', parseInt(this.value) / 100)">
                </div>
            </div>
        `;
    }

    div.innerHTML = segmentHTML;
    return div;
}

function updateWorkoutSegment(index, property, value) {
    if (currentWorkout && currentWorkout.segments[index]) {
        currentWorkout.segments[index][property] = value;
        updateWorkoutDisplay();
    }
}

function updateWorkoutSegmentRest(index, property, value) {
    if (currentWorkout && currentWorkout.segments[index] && currentWorkout.segments[index].rest) {
        currentWorkout.segments[index].rest[property] = value;
        updateWorkoutDisplay();
    }
}

function removeWorkoutSegment(index) {
    if (currentWorkout && currentWorkout.segments.length > 1) {
        currentWorkout.segments.splice(index, 1);
        renderWorkoutEditor();
        updateWorkoutDisplay();
    } else {
        alert('Workout must have at least one segment');
    }
}

function addWorkoutSegment(type) {
    if (!currentWorkout) return;

    const newSegment = {
        type: type,
        duration: 300, // 5 minutes default
        targetPercent: 0.75
    };

    if (type === 'interval') {
        newSegment.repeat = 5; // Default to 5 repetitions
        newSegment.subSegments = [
            { duration: 60, targetPercent: 2.0 },  // 1min @ 200 % av FTP
            { duration: 300, targetPercent: 1.0 }, // 5min @ FTP
            { duration: 120, targetPercent: 1.25 } // 2min @ 125 % av FTP
        ];
        newSegment.rest = {
            duration: 180, // 3 minutes rest
            targetPercent: 0.5
        };
        // Remove simple interval properties since we're using sub-segments
        delete newSegment.duration;
        delete newSegment.targetPercent;
    }

    currentWorkout.segments.push(newSegment);
    renderWorkoutEditor();
    updateWorkoutDisplay();
}

function resetWorkoutToDefault() {
    // Reset to the original workout from sample-workout.json
    currentWorkout = {
        "id": "4x4-threshold",
        "name": "4x4 Threshold",
        "description": "Klassiska 4x4min intervaller på tröskel",
        "segments": [
            {
                "type": "warmup",
                "duration": 600,
                "targetPercent": 0.75
            },
            {
                "type": "interval",
                "duration": 240,
                "targetPercent": 0.95,
                "repeat": 4,
                "rest": {
                    "duration": 120,
                    "targetPercent": 0.5
                }
            },
            {
                "type": "cooldown",
                "duration": 300,
                "targetPercent": 0.6
            }
        ]
    };

    renderWorkoutEditor();
    updateWorkoutDisplay();
}

function updateWorkoutDisplay() {
    // Update workout name and description from inputs
    currentWorkout.name = document.getElementById('workoutName').value;
    currentWorkout.description = document.getElementById('workoutDescription').value;

    // Redraw chart and recalculate TSS
    plotWorkoutPlan(currentWorkout);
}

// Sub-segment management functions
function toggleIntervalType(segmentIndex, type) {
    const segment = currentWorkout.segments[segmentIndex];

    if (type === 'complex') {
        // Convert to complex interval with sub-segments
        if (!segment.subSegments) {
            segment.subSegments = [
                { duration: 60, targetPercent: 2.0 },  // 1min @ 200 % av FTP
                { duration: 300, targetPercent: 1.0 }, // 5min @ FTP
                { duration: 120, targetPercent: 1.25 } // 2min @ 125 % av FTP
            ];
        }
        // Remove simple interval properties
        delete segment.duration;
        delete segment.targetPercent;
    } else {
        // Convert to simple interval
        delete segment.subSegments;
        segment.duration = 240; // 4 minutes default
        segment.targetPercent = 1.0; // Default: FTP
    }

    renderWorkoutEditor();
    updateWorkoutDisplay();
}

function updateWorkoutSubSegment(segmentIndex, subIndex, property, value) {
    if (currentWorkout &&
        currentWorkout.segments[segmentIndex] &&
        currentWorkout.segments[segmentIndex].subSegments &&
        currentWorkout.segments[segmentIndex].subSegments[subIndex]) {

        currentWorkout.segments[segmentIndex].subSegments[subIndex][property] = value;
        updateWorkoutDisplay();
    }
}

function addSubSegment(segmentIndex) {
    if (currentWorkout && currentWorkout.segments[segmentIndex]) {
        if (!currentWorkout.segments[segmentIndex].subSegments) {
            currentWorkout.segments[segmentIndex].subSegments = [];
        }

        currentWorkout.segments[segmentIndex].subSegments.push({
            duration: 60,
            targetPercent: 1.0
        });

        renderWorkoutEditor();
        updateWorkoutDisplay();
    }
}

function removeSubSegment(segmentIndex, subIndex) {
    if (currentWorkout &&
        currentWorkout.segments[segmentIndex] &&
        currentWorkout.segments[segmentIndex].subSegments &&
        currentWorkout.segments[segmentIndex].subSegments.length > 1) {

        currentWorkout.segments[segmentIndex].subSegments.splice(subIndex, 1);
        renderWorkoutEditor();
        updateWorkoutDisplay();
    } else {
        alert('Complex intervals must have at least one sub-segment');
    }
}

// JSON Export/Import functions
function exportWorkoutJSON() {
    if (!currentWorkout) {
        alert('No workout to export');
        return;
    }

    // Update workout name and description from inputs before export
    currentWorkout.name = document.getElementById('workoutName').value;
    currentWorkout.description = document.getElementById('workoutDescription').value;

    // Create a clean copy of the workout for export
    const exportData = {
        id: currentWorkout.id || generateWorkoutId(),
        name: currentWorkout.name || 'Custom Workout',
        description: currentWorkout.description || '',
        segments: JSON.parse(JSON.stringify(currentWorkout.segments)) // Deep copy
    };

    // Create and download the JSON file
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `${sanitizeFilename(exportData.name)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('Exported workout:', exportData);
}

function importWorkoutJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const workoutData = JSON.parse(e.target.result);

            // Validate the workout structure
            if (!validateWorkoutStructure(workoutData)) {
                alert('Invalid workout file format');
                return;
            }

            // Load the imported workout
            currentWorkout = workoutData;

            // Update the editor and display
            renderWorkoutEditor();
            updateWorkoutDisplay();

            console.log('Imported workout:', workoutData);
            alert(`Successfully imported workout: "${workoutData.name}"`);

        } catch (error) {
            console.error('Error parsing workout JSON:', error);
            alert('Error parsing workout file. Please check the file format.');
        }
    };

    reader.readAsText(file);

    // Reset the file input
    event.target.value = '';
}

function validateWorkoutStructure(workout) {
    // Check required fields
    if (!workout || typeof workout !== 'object') return false;
    if (!workout.segments || !Array.isArray(workout.segments)) return false;
    if (workout.segments.length === 0) return false;

    // Validate each segment
    for (const segment of workout.segments) {
        if (!segment.type || typeof segment.type !== 'string') return false;

        if (segment.type === 'interval') {
            if (typeof segment.repeat !== 'number' || segment.repeat < 1) return false;

            // Check if it's a complex interval with sub-segments
            if (segment.subSegments && Array.isArray(segment.subSegments)) {
                for (const subSeg of segment.subSegments) {
                    if (typeof subSeg.duration !== 'number' || subSeg.duration < 1) return false;
                    if (!hasValidTarget(subSeg)) return false;
                }
            } else {
                // Simple interval validation
                if (typeof segment.duration !== 'number' || segment.duration < 1) return false;
                if (!hasValidTarget(segment)) return false;
            }

            // Check rest period if present
            if (segment.rest) {
                if (typeof segment.rest.duration !== 'number' || segment.rest.duration < 1) return false;
                if (!hasValidTarget(segment.rest)) return false;
            }
        } else {
            // Simple segment validation (warmup, cooldown)
            if (typeof segment.duration !== 'number' || segment.duration < 1) return false;
            if (!hasValidTarget(segment)) return false;
        }
    }

    return true;
}

// targetPercent: 0 är giltigt - det är så äkta vila uttrycks (FA-6). Äldre filer
// med absoluta watt accepteras fortfarande, med det gamla kravet targetWatt >= 1.
function hasValidTarget(target) {
    if (typeof target.targetPercent === 'number') return target.targetPercent >= 0;
    return typeof target.targetWatt === 'number' && target.targetWatt >= 1;
}

function generateWorkoutId() {
    return 'workout-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function sanitizeFilename(filename) {
    return filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

// Make functions globally available for HTML onclick handlers
window.updateWorkoutSegment = updateWorkoutSegment;
window.updateWorkoutSegmentRest = updateWorkoutSegmentRest;
window.removeWorkoutSegment = removeWorkoutSegment;
window.toggleIntervalType = toggleIntervalType;
window.updateWorkoutSubSegment = updateWorkoutSubSegment;
window.addSubSegment = addSubSegment;
window.removeSubSegment = removeSubSegment;