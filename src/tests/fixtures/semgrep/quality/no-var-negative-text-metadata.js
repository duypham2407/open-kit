const metadata = {
  var: 'metadata key, not a declaration',
  variant: 'modern-js',
  vars: ['documented text only'],
  MY_VAR_NAME: 'placeholder environment variable name',
  description: 'Documentation mentions var as a word inside a string.',
  frontmatter: {
    'env-var': 'MY_VAR_NAME',
    'rule-id': 'openkit.quality.no-var-declaration',
  },
};

const docsText = `
# Maintainer note

The word var can appear in docs, comments, fixture strings, and metadata without
being a JavaScript declaration.
`;

function testTitle(name, callback) {
  return { name, callback };
}

const documentationCase = testTitle('test title mentions var text only', () => docsText);

export { documentationCase, metadata };
