// @ts-check

import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import stylistic from '@stylistic/eslint-plugin';
import tseslint from 'typescript-eslint';

export default defineConfig([
    {
        ignores: ['target/**', '_build/**'],
    },
    {
        extends: [stylistic.configs.customize({
            indent: 4,
            semi: true,
            arrowParens: false,
            braceStyle: '1tbs',
            severity: 'warn',
        })],
        rules: {
            '@stylistic/indent': 'off',
            '@stylistic/indent-binary-ops': 'off',
        },
    },
    {
        extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
        rules: {
            'no-case-declarations': 'off',
            '@typescript-eslint/no-namespace': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', {
                args: 'all',
                argsIgnorePattern: '^_',
                caughtErrors: 'all',
                caughtErrorsIgnorePattern: '^_',
                destructuredArrayIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                ignoreRestSiblings: true,
            }],
            'prefer-const': ['warn', {
                destructuring: 'all',
            }],
            '@typescript-eslint/restrict-template-expressions': 'off',
            '@typescript-eslint/prefer-promise-reject-errors': 'off',
            '@typescript-eslint/strict-boolean-expressions': 'error',
        },
        languageOptions: {
            parserOptions: {
                projectService: true,
            },
        },
        ignores: [
            'eslint.config.mjs',
        ],
    },
]);
