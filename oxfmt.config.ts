import { defineConfig } from 'oxfmt';

export default defineConfig({
    ignorePatterns: ['target/**', '_build/**', 'packaging/**', 'venv/**', '*.md'],
    tabWidth: 4,
    printWidth: 120,
    singleQuote: true,
    arrowParens: 'avoid',
    experimentalOperatorPosition: 'start',
    sortImports: {
        groups: [
            'type-import',
            ['value-builtin', 'value-external'],
            'type-internal',
            'value-internal',
            ['type-parent', 'type-sibling', 'type-index'],
            ['value-parent', 'value-sibling', 'value-index'],
            'unknown',
        ],
    },
    overrides: [
        {
            files: ['*.yml', '*.yaml'],
            options: {
                tabWidth: 2,
            },
        },
    ],
});
