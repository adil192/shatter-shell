import { defineConfig } from 'oxlint';

export default defineConfig({
    categories: {
        correctness: 'error',
        // "pedantic": "warn",
        perf: 'warn',
        // "style": "warn",
        suspicious: 'warn',
    },
    ignorePatterns: ['target/**', '_build/**', 'packaging/**', 'venv/**'],
    options: {
        typeAware: true,
    },
    rules: {
        curly: 'off', // I like single-line if statements
        'eslint/no-underscore-dangle': 'off', // gnome-shell uses lots of underscore-prefixed names
        'one-var': 'off', // Why!
        'no-shadow': 'off', // Typically done on purpose
        'typescript/consistent-return': 'off', // prefer TypeScript's noImplicitReturns
        'typescript/no-confusing-void-expression': 'off', // Forbids void-returning functions in expressions for no reason
        'typescript/prefer-readonly-parameter-types': 'off', // Overly verbose
        'typescript/restrict-template-expressions': [
            'warn',
            {
                allowArray: true,
                allowAny: true,
                allowNullish: true,
                allow: [{ from: 'lib', name: 'unknown' }],
            },
        ],
        'unicorn/consistent-function-scoping': 'off', // Unnecessary fragmentation of code
        'unicorn/no-array-sort': 'off', // It's usually preferable to mutate the array in-place rather than creating a new one
    },
    overrides: [
        {
            // Code in src/core/ is unit-tested under Node, so it mustn't load GNOME libraries, nor
            // the extension's other modules, which do
            files: ['src/core/**'],
            rules: {
                'no-restricted-imports': [
                    'error',
                    {
                        patterns: [
                            {
                                // `*` stops at a `/`, so `**` is needed for paths like resource:///org/gnome/…
                                group: ['gi://**', 'resource://**', '../**'],
                                allowTypeImports: true,
                                message: 'src/core/ must load under Node: import only types from here',
                            },
                        ],
                    },
                ],
            },
        },
        {
            files: ['tests/**'],
            rules: {
                'typescript/no-floating-promises': 'off', // node:test runs the promises that test() returns
            },
        },
    ],
});
