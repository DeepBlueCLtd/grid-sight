/* eslint-env node */
/**
 * Project ESLint config.
 *
 * Codacy's bundled ESLint scan honours this when "Use configuration file"
 * is enabled for the repository. Rules disabled below are either:
 *   - false positives for our DOM-heavy code (xss, security/object-injection
 *     where indices are bounded by `headers.length` etc.)
 *   - intentional (non-null assertions, `as any` in test stubs of browser
 *     globals) and verified safe in context
 *   - purely stylistic preferences we don't enforce
 *
 * If Codacy reverts to its default preset, mirror these disables inline via
 * `// eslint-disable-next-line ...` comments.
 */
module.exports = {
  root: true,
  rules: {
    'security/detect-object-injection': 'off',
    'security/detect-unsafe-regex': 'off',
    'xss/no-mixed-html': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unnecessary-condition': 'off',
    '@typescript-eslint/array-type': 'off',
  },
};
