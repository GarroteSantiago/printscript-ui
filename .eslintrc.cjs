module.exports = {
    root: true,
    env: {browser: true, es2020: true},
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:react-hooks/recommended',
    ],
    ignorePatterns: ['dist', '.eslintrc.cjs'],
    parser: '@typescript-eslint/parser',
    rules: {
        // Los hooks de queries.tsx ya muestran el error en un snackbar; mutateAsync además rechaza la
        // promesa, y sin catch queda un "Uncaught (in promise)". mutate no rechaza.
        'no-restricted-syntax': ['error', {
            selector: "Identifier[name='mutateAsync']",
            message: 'Usar mutate (con onSuccess por llamada si hace falta): mutateAsync sin catch deja la promesa rechazada sin manejar.',
        }],
    },
}
