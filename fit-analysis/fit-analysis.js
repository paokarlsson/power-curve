// =============================================================================
// CONFIGURATION
// =============================================================================

// Configuration constants - centralized values
const CONFIG = {
    // Default values
    DEFAULT_FTP: 200,           // Default FTP value in watts
    DEFAULT_MAX_PEAK_POWER: 500, // Default max peak power in watts
    DEFAULT_POWER_EXPONENT: 4, // Power exponent for NP calculations

    // Data processing constants
    MIN_POWER_DROPOUT: 30,      // Minimum power value for dropout replacement
    WINDOW_COVERAGE_THRESHOLD: 0.5 // Minimum coverage ratio for window averaging
};

// Dynamic TSS configurations - can be modified at runtime
let TSS_CONFIGS = {
        SPRINT: {
            seconds: 10,
            displayKey: 'tenSecond',
            elementId: 'tssSprint',
            label: 'TSS (Sprint)',
            chartColor: '#f57c00',
            chartBackground: '#fff3e0'
        },
        VO2_MAX: {
            seconds: 180,
            displayKey: 'threeMinute',
            elementId: 'tssVo2Max',
            label: 'TSS (VO2max)',
            chartColor: '#388e3c',
            chartBackground: '#e8f5e8'
        },
        THRESHOLD: {
            seconds: 600,
            displayKey: 'tenMinute',
            elementId: 'tssThreshold',
            label: 'TSS (Threshold)',
            chartColor: '#1976d2',
            chartBackground: '#e3f2fd'
        },
        STANDARD: {
            seconds: 30, // Fixed 30-second standard
            displayKey: 'standard',
            elementId: 'tssStandard',
            label: 'TSS (Standard)',
            chartColor: '#7b1fa2',
            chartBackground: '#f3e5f5',
            fixed: true // Cannot be edited or removed
        }
};

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
document.getElementById('ftpInput').value = CONFIG.DEFAULT_FTP;
document.getElementById('maxPeakPowerInput').value = CONFIG.DEFAULT_MAX_PEAK_POWER;
document.getElementById('powerRaiseInput').value = CONFIG.DEFAULT_POWER_EXPONENT;

// Load and display workout plan
loadAndDisplayWorkout();

// Add event listeners for real-time recalculation
document.getElementById('ftpInput').addEventListener('input', recalculateWithNewSettings);
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

                const ftp = parseInt(document.getElementById('ftpInput').value) || CONFIG.DEFAULT_FTP;
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

                    const ftp = parseInt(document.getElementById('ftpInput').value) || CONFIG.DEFAULT_FTP;
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

    const ftp = parseInt(document.getElementById('ftpInput').value) || CONFIG.DEFAULT_FTP;
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
        windows: {}
    };

    // Build windows object dynamically from current TSS_CONFIGS
    Object.entries(TSS_CONFIGS).forEach(([windowType, config]) => {
        tssResults.windows[config.displayKey] = getTSSWindowData(tssData, windowType);
    });

    console.log('TSS Results:', tssResults);

    // Update TSS display values for all current configs
    Object.keys(TSS_CONFIGS).forEach(windowType => {
        updateTSSElement(windowType, tssResults);
    });

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
            p: r.power || 0
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

        // Add FTP reference line
        const ftp = parseInt(document.getElementById('ftpInput').value) || CONFIG.DEFAULT_FTP;
        const maxTime = Math.max(...powerData.map(p => p.x));
        datasets.push({
            label: `FTP (${ftp}W)`,
            data: [{ x: 0, y: ftp }, { x: maxTime, y: ftp }],
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

    const ftp = parseInt(document.getElementById('ftpInput').value) || CONFIG.DEFAULT_FTP;
    const maxPeakPower = parseInt(document.getElementById('maxPeakPowerInput').value) || CONFIG.DEFAULT_MAX_PEAK_POWER;

    // Find power data to get max time
    const powerDataset = chart.data.datasets.find(ds => ds.label === 'Power (watts)');
    if (!powerDataset || powerDataset.data.length === 0) return;

    const maxTime = Math.max(...powerDataset.data.map(p => p.x));

    // Update FTP line
    const ftpDataset = chart.data.datasets.find(ds => ds.label.includes('FTP'));
    if (ftpDataset) {
        ftpDataset.label = `FTP (${ftp}W)`;
        ftpDataset.data = [{ x: 0, y: ftp }, { x: maxTime, y: ftp }];
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

    const ftp = parseInt(document.getElementById('ftpInput').value) || CONFIG.DEFAULT_FTP;
    const maxPeakPower = parseInt(document.getElementById('maxPeakPowerInput').value) || CONFIG.DEFAULT_MAX_PEAK_POWER;

    // Find workout data to get max time
    const workoutDataset = workoutChart.data.datasets.find(ds => ds.label === 'Target Power (watts)');
    if (!workoutDataset || workoutDataset.data.length === 0) return;

    const maxTime = Math.max(...workoutDataset.data.map(p => p.x));

    // Update FTP line
    const ftpDataset = workoutChart.data.datasets.find(ds => ds.label.includes('FTP'));
    if (ftpDataset) {
        ftpDataset.label = `FTP (${ftp}W)`;
        ftpDataset.data = [{ x: 0, y: ftp }, { x: maxTime, y: ftp }];
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
                borderWidth: windowType === 'SPRINT' ? 3 : 2,
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
        // Update all TSS values for current configs
        Object.keys(TSS_CONFIGS).forEach(windowType => {
            updateTSSElement(windowType, tssResults);
        });

        document.getElementById('tssStats').style.display = 'grid';
    } else {
        // Clear all TSS values when no results available
        Object.keys(TSS_CONFIGS).forEach(windowType => {
            updateElementText(TSS_CONFIGS[windowType].elementId, '--');
        });
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

    // Generate fallback text for unavailable data
    let fallbackText = '--';
    if (windowType === 'BASE') {
        fallbackText = '--'; // Base TSS always shows simple fallback
    } else if (windowType !== 'SPRINT') {
        fallbackText = `N/A (<${config.seconds / 60}m)`;
    }

    const value = windowData?.available ? windowData.tss.toFixed(1) : fallbackText;
    console.log(`Setting element ${config.elementId} to value: ${value}`);
    updateElementText(config.elementId, value);
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

    // Step 2: Fix sensor dropouts (0W values)
    const cleaned = [];
    let zeroDropouts = 0;

    for (let i = 0; i < deduped.length; i++) {
        const current = deduped[i];

        if (current.p === 0) {
            zeroDropouts++;
            const prevPower = i > 0 ? deduped[i - 1].p : 0;
            const nextPower = i < deduped.length - 1 ? deduped[i + 1].p : 0;

            if (prevPower > 0 && nextPower > 0) {
                // Interpolate isolated zeros
                cleaned.push({ ...current, p: (prevPower + nextPower) / 2 });
            } else {
                // Use minimum viable power for other zeros
                cleaned.push({ ...current, p: CONFIG.MIN_POWER_DROPOUT });
            }
        } else {
            cleaned.push(current);
        }
    }

    console.log(`🔧 Cleaned: ${sortedData.length} → ${deduped.length} → ${cleaned.length} points, fixed ${zeroDropouts} dropouts`);
    return cleaned;
}

function computeNP_by_time(rawPowerData, ftp, windowSecondsList = TSS_WINDOW_SECONDS, exponent = CONFIG.DEFAULT_POWER_EXPONENT) {
    if (!rawPowerData || rawPowerData.length < 2) throw new Error("Behöver minst två datapunkter med tidsstämplar.");

    // Clean the data first
    const powerData = cleanPowerData(rawPowerData);

    // Basic stats
    const firstTs = powerData[0].t;
    const lastTs = powerData[powerData.length - 1].t;
    const duration = lastTs - firstTs;
    const samples = powerData.length;
    const avgSamplingHz = samples / duration;

    console.log('📊 Data stats:', samples, 'points over', duration.toFixed(1), 's, sampling:', avgSamplingHz.toFixed(2), 'Hz');

    // Robust window averaging with fixed step size
    function robustWindowAverages(windowSec) {
        if (windowSec > duration * 0.9) return [];

        const averages = [];
        const stepSize = Math.max(1, Math.floor(windowSec / 60)); // Adaptive step size

        for (let start = firstTs; start + windowSec <= lastTs; start += stepSize) {
            const end = start + windowSec;
            const windowPoints = powerData.filter(p => p.t >= start && p.t < end);

            if (windowPoints.length >= windowSec * CONFIG.WINDOW_COVERAGE_THRESHOLD) { // Need reasonable coverage
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
        avgSamplingHz,
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

// Calculate TSS accumulation over time for multiple time windows
function calculateTSSAccumulation(powerData, ftp, powerExponent) {
    if (!powerData || powerData.length < 2) return null;

    const duration = powerData[powerData.length - 1].t - powerData[0].t;
    const sampleInterval = 30; // Calculate TSS every 30 seconds
    const timestamps = [];
    const tssData = {};

    // Initialize data arrays for each TSS window type
    Object.keys(TSS_CONFIGS).forEach(windowType => {
        const config = TSS_CONFIGS[windowType];
        tssData[config.elementId] = [];
    });

    // Calculate TSS at regular intervals
    for (let t = sampleInterval; t <= duration; t += sampleInterval) {
        timestamps.push(t / 60); // Convert to minutes for chart

        // Get power data up to this point
        const currentData = powerData.filter(p => p.t <= t);

        if (currentData.length > 10) { // Need some data to calculate
            // Calculate TSS for each window type up to this point
            const tssResults = computeNP_by_time(currentData, ftp, getTSSWindowSeconds(), powerExponent);

            Object.entries(TSS_CONFIGS).forEach(([windowType, config]) => {
                const windowData = tssResults.windows[config.seconds];
                const tssValue = windowData && windowData.TSS ? windowData.TSS : null;
                tssData[config.elementId].push(tssValue);
            });
        } else {
            // Not enough data yet
            Object.keys(TSS_CONFIGS).forEach(windowType => {
                const config = TSS_CONFIGS[windowType];
                tssData[config.elementId].push(null);
            });
        }
    }

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

    // Add FTP and Max Peak Power reference lines
    const ftp = parseInt(document.getElementById('ftpInput').value) || CONFIG.DEFAULT_FTP;
    const maxPeakPower = parseInt(document.getElementById('maxPeakPowerInput').value) || CONFIG.DEFAULT_MAX_PEAK_POWER;
    const maxTime = Math.max(...workoutData.map(p => p.x));

    // FTP reference line
    datasets.push({
        label: `FTP (${ftp}W)`,
        data: [{ x: 0, y: ftp }, { x: maxTime, y: ftp }],
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
    let currentTime = 0;

    workout.segments.forEach(segment => {
        currentTime = processSegment(segment, timeline, currentTime);
    });

    return timeline;
}

function processSegment(segment, timeline, currentTime) {
    if (segment.type === 'interval' && segment.repeat) {
        // Handle repeated intervals
        for (let i = 0; i < segment.repeat; i++) {
            if (segment.subSegments && segment.subSegments.length > 0) {
                // Recursive intervals with sub-segments
                segment.subSegments.forEach(subSegment => {
                    timeline.push({ x: currentTime / 60, y: subSegment.targetWatt });
                    currentTime += subSegment.duration;
                    timeline.push({ x: currentTime / 60, y: subSegment.targetWatt });
                });
            } else {
                // Simple interval
                timeline.push({ x: currentTime / 60, y: segment.targetWatt });
                currentTime += segment.duration;
                timeline.push({ x: currentTime / 60, y: segment.targetWatt });
            }

            // Rest period (except after last interval)
            if (i < segment.repeat - 1 && segment.rest) {
                timeline.push({ x: currentTime / 60, y: segment.rest.targetWatt });
                currentTime += segment.rest.duration;
                timeline.push({ x: currentTime / 60, y: segment.rest.targetWatt });
            }
        }
    } else {
        // Simple segment (warmup, cooldown, etc.)
        timeline.push({ x: currentTime / 60, y: segment.targetWatt });
        currentTime += segment.duration;
        timeline.push({ x: currentTime / 60, y: segment.targetWatt });
    }

    return currentTime;
}

function calculateWorkoutTSS(workout) {
    // Convert workout to power data format (1-second intervals)
    const powerData = generateWorkoutPowerData(workout);

    if (powerData.length === 0) return;

    const ftp = parseInt(document.getElementById('ftpInput').value) || CONFIG.DEFAULT_FTP;
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
        windows: {}
    };

    // Build windows object dynamically from current TSS_CONFIGS
    Object.entries(TSS_CONFIGS).forEach(([windowType, config]) => {
        tssResults.windows[config.displayKey] = getTSSWindowData(tssData, windowType);
    });

    // Display workout TSS scores
    displayWorkoutTSS(workout, tssResults);
}

function generateWorkoutPowerData(workout) {
    const powerData = [];
    let currentTime = 0;

    workout.segments.forEach(segment => {
        currentTime = processSegmentPowerData(segment, powerData, currentTime);
    });

    return powerData;
}

function processSegmentPowerData(segment, powerData, currentTime) {
    if (segment.type === 'interval' && segment.repeat) {
        // Handle repeated intervals
        for (let i = 0; i < segment.repeat; i++) {
            if (segment.subSegments && segment.subSegments.length > 0) {
                // Recursive intervals with sub-segments
                segment.subSegments.forEach(subSegment => {
                    for (let t = 0; t < subSegment.duration; t++) {
                        powerData.push({
                            t: currentTime + t,
                            p: subSegment.targetWatt
                        });
                    }
                    currentTime += subSegment.duration;
                });
            } else {
                // Simple interval - add 1-second data points
                for (let t = 0; t < segment.duration; t++) {
                    powerData.push({
                        t: currentTime + t,
                        p: segment.targetWatt
                    });
                }
                currentTime += segment.duration;
            }

            // Rest period (except after last interval)
            if (i < segment.repeat - 1 && segment.rest) {
                for (let t = 0; t < segment.rest.duration; t++) {
                    powerData.push({
                        t: currentTime + t,
                        p: segment.rest.targetWatt
                    });
                }
                currentTime += segment.rest.duration;
            }
        }
    } else {
        // Simple segment - add 1-second data points
        for (let t = 0; t < segment.duration; t++) {
            powerData.push({
                t: currentTime + t,
                p: segment.targetWatt
            });
        }
        currentTime += segment.duration;
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

        // Update display key based on seconds
        if (property === 'seconds') {
            const minutes = Math.round(value / 60);
            const hours = Math.round(value / 3600);
            let displayKey;

            if (value < 60) {
                displayKey = `${value}Second`;
            } else if (value < 3600) {
                displayKey = `${minutes}Minute`;
            } else {
                displayKey = `${hours}Hour`;
            }

            TSS_CONFIGS[key].displayKey = displayKey;
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
        displayKey: '1Minute',
        elementId: `tss${newKey}`,
        label: '1m TSS (Custom)',
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
    TSS_CONFIGS = {
        SPRINT: {
            seconds: 10,
            displayKey: 'tenSecond',
            elementId: 'tssSprint',
            label: 'TSS (Sprint)',
            chartColor: '#f57c00',
            chartBackground: '#fff3e0'
        },
        VO2_MAX: {
            seconds: 180,
            displayKey: 'threeMinute',
            elementId: 'tssVo2Max',
            label: 'TSS (VO2max)',
            chartColor: '#388e3c',
            chartBackground: '#e8f5e8'
        },
        THRESHOLD: {
            seconds: 600,
            displayKey: 'tenMinute',
            elementId: 'tssThreshold',
            label: 'TSS (Threshold)',
            chartColor: '#1976d2',
            chartBackground: '#e3f2fd'
        },
        STANDARD: {
            seconds: 30, // Fixed 30-second standard
            displayKey: 'standard',
            elementId: 'tssStandard',
            label: 'TSS (Standard)',
            chartColor: '#7b1fa2',
            chartBackground: '#f3e5f5',
            fixed: true // Cannot be edited or removed
        }
    };

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
        `;
        container.appendChild(statBox);
    });
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
                        <label>Target Power (watts):</label>
                        <input type="number" min="50" max="1000" value="${segment.targetWatt || 250}"
                               onchange="updateWorkoutSegment(${index}, 'targetWatt', parseInt(this.value))">
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
                                        <label>Power (watts):</label>
                                        <input type="number" min="50" max="1000" value="${subSeg.targetWatt}"
                                               onchange="updateWorkoutSubSegment(${index}, ${subIndex}, 'targetWatt', parseInt(this.value))">
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
                            <label>Rest Power (watts):</label>
                            <input type="number" min="50" max="500" value="${segment.rest.targetWatt}"
                                   onchange="updateWorkoutSegmentRest(${index}, 'targetWatt', parseInt(this.value))">
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
                    <label>Target Power (watts):</label>
                    <input type="number" min="50" max="1000" value="${segment.targetWatt}"
                           onchange="updateWorkoutSegment(${index}, 'targetWatt', parseInt(this.value))">
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
        targetWatt: 150
    };

    if (type === 'interval') {
        newSegment.repeat = 5; // Default to 5 repetitions
        newSegment.subSegments = [
            { duration: 60, targetWatt: 400 },  // 1min @ 400w
            { duration: 300, targetWatt: 200 }, // 5min @ 200w
            { duration: 120, targetWatt: 250 }  // 2min @ 250w
        ];
        newSegment.rest = {
            duration: 180, // 3 minutes rest
            targetWatt: 100
        };
        // Remove simple interval properties since we're using sub-segments
        delete newSegment.duration;
        delete newSegment.targetWatt;
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
                "targetWatt": 150
            },
            {
                "type": "interval",
                "duration": 240,
                "targetWatt": 250,
                "repeat": 4,
                "rest": {
                    "duration": 120,
                    "targetWatt": 100
                }
            },
            {
                "type": "cooldown",
                "duration": 300,
                "targetWatt": 120
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
                { duration: 60, targetWatt: 400 },  // 1min @ 400w
                { duration: 300, targetWatt: 200 }, // 5min @ 200w
                { duration: 120, targetWatt: 250 }  // 2min @ 250w
            ];
        }
        // Remove simple interval properties
        delete segment.duration;
        delete segment.targetWatt;
    } else {
        // Convert to simple interval
        delete segment.subSegments;
        segment.duration = 240; // 4 minutes default
        segment.targetWatt = 250; // Default power
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
            targetWatt: 200
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
                    if (typeof subSeg.targetWatt !== 'number' || subSeg.targetWatt < 1) return false;
                }
            } else {
                // Simple interval validation
                if (typeof segment.duration !== 'number' || segment.duration < 1) return false;
                if (typeof segment.targetWatt !== 'number' || segment.targetWatt < 1) return false;
            }

            // Check rest period if present
            if (segment.rest) {
                if (typeof segment.rest.duration !== 'number' || segment.rest.duration < 1) return false;
                if (typeof segment.rest.targetWatt !== 'number' || segment.rest.targetWatt < 1) return false;
            }
        } else {
            // Simple segment validation (warmup, cooldown)
            if (typeof segment.duration !== 'number' || segment.duration < 1) return false;
            if (typeof segment.targetWatt !== 'number' || segment.targetWatt < 1) return false;
        }
    }

    return true;
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