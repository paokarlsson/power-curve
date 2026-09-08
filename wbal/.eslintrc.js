module.exports = {
    env: {
        browser: true,
        es2021: true
    },
    extends: ['eslint:recommended'],
    parserOptions: {
        ecmaVersion: 12,
        sourceType: 'script'
    },
    rules: {
        'no-unused-vars': 'warn',
        'no-console': 'off',
        'no-undef': 'error',
        'prefer-const': 'warn',
        'no-var': 'warn',
        'eqeqeq': 'warn',
        'curly': 'warn',
        'no-duplicate-case': 'error',
        'no-unreachable': 'error',
        'no-redeclare': 'error'
    },
    globals: {
        'document': 'readonly',
        'window': 'readonly',
        'console': 'readonly',
        'Math': 'readonly'
    }
};