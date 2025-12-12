import sonarjs from "eslint-plugin-sonarjs";

export default [
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: "script",
            globals: {
                document: "readonly",
                window: "readonly",
                console: "readonly",
                Math: "readonly"
            }
        },
        plugins: {
            sonarjs
        },
        rules: {
            // Standard rules
            "no-unused-vars": "warn",
            "no-console": "off",
            "no-undef": "error",
            "prefer-const": "warn",
            "no-var": "warn",
            "eqeqeq": "warn",
            "curly": "warn",
            "no-duplicate-case": "error",
            "no-unreachable": "error",
            "no-redeclare": "error",

            // SonarJS rules for code quality (using compatible rules)
            "sonarjs/cognitive-complexity": ["error", 15],
            "sonarjs/no-all-duplicated-branches": "error",
            "sonarjs/no-collapsible-if": "error",
            "sonarjs/no-duplicate-string": ["error", { "threshold": 3 }],
            "sonarjs/no-duplicated-branches": "error",
            "sonarjs/no-identical-conditions": "error",
            "sonarjs/no-identical-expressions": "error",
            "sonarjs/no-inverted-boolean-check": "error",
            "sonarjs/no-redundant-boolean": "error",
            "sonarjs/no-same-line-conditional": "error",
            "sonarjs/no-small-switch": "error",
            "sonarjs/prefer-immediate-return": "error",
            "sonarjs/prefer-single-boolean-return": "error",
            "sonarjs/prefer-while": "error"
        }
    }
];