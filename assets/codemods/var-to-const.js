/**
 * var-to-const transform
 *
 * Converts `var` declarations to `const`.
 * This is a simple seed codemod to demonstrate the preview/apply workflow.
 *
 * Usage:
 *   tool.codemod-preview.execute({ transform: 'assets/codemods/var-to-const.js', files: ['src/app.js'] })
 *   tool.codemod-apply.execute({ transform: 'assets/codemods/var-to-const.js', files: ['src/app.js'] })
 */
export default function transformer(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  root
    .find(j.VariableDeclaration, { kind: 'var' })
    .forEach((path) => {
      path.node.kind = 'const';
    });

  const output = root.toSource();
  return output === fileInfo.source ? undefined : output;
}
