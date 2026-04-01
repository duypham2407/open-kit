/**
 * console-to-logger transform
 *
 * Replaces `console.log(...)` calls with `logger.info(...)`.
 * A seed codemod demonstrating API migration patterns.
 *
 * Usage:
 *   tool.codemod-preview.execute({ transform: 'assets/codemods/console-to-logger.js', files: ['src/app.js'] })
 *   tool.codemod-apply.execute({ transform: 'assets/codemods/console-to-logger.js', files: ['src/app.js'] })
 */
export default function transformer(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  root
    .find(j.CallExpression, {
      callee: {
        type: 'MemberExpression',
        object: { type: 'Identifier', name: 'console' },
        property: { type: 'Identifier', name: 'log' },
      },
    })
    .forEach((path) => {
      path.node.callee = j.memberExpression(
        j.identifier('logger'),
        j.identifier('info'),
      );
    });

  const output = root.toSource();
  return output === fileInfo.source ? undefined : output;
}
