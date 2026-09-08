// Mock CommonJS and buffer module for browser compatibility
var exports = {};
var module = { exports: exports };
var moduleCache = {};

// Mock buffer module
moduleCache['buffer'] = { Buffer: window.Buffer || Array };

function require(name) {
    return moduleCache[name] || {};
}

// Module setup functions
function setupMessages() {
    moduleCache['./messages'] = exports;
    exports = {};
    module = { exports: exports };
}

function setupFit() {
    moduleCache['./fit'] = exports;
    exports = {};
    module = { exports: exports };
}

function setupBinary() {
    moduleCache['./binary'] = exports;
    exports = {};
    module = { exports: exports };
}

function setupHelper() {
    moduleCache['./helper'] = exports;
    exports = {};
    module = { exports: exports };
}

function setupFitParser() {
    window.FitParser = exports.default;
}

// Load all dependencies and modules
function loadAllDependencies() {
    // Create script elements for each dependency
    const scripts = [
        'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js',
        'dist/messages.js',
        'dist/fit.js',
        'dist/binary.js',
        'dist/helper.js',
        'dist/fit-parser.js',
        'fit-analysis.js'
    ];

    const setupFunctions = [
        null, // Chart.js doesn't need setup
        setupMessages,
        setupFit,
        setupBinary,
        setupHelper,
        setupFitParser,
        null // fit-analysis.js doesn't need setup
    ];

    let loadedCount = 0;

    function loadNext() {
        if (loadedCount >= scripts.length) return;

        const script = document.createElement('script');
        script.src = scripts[loadedCount];

        script.onload = function() {
            // Run setup function if exists
            if (setupFunctions[loadedCount]) {
                setupFunctions[loadedCount]();
            }
            loadedCount++;
            loadNext();
        };

        script.onerror = function() {
            console.error('Failed to load:', scripts[loadedCount]);
            loadedCount++;
            loadNext();
        };

        document.head.appendChild(script);
    }

    loadNext();
}