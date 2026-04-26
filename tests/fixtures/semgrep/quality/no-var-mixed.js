const metadata = {
  var: 'object key only',
  variant: 'fixture text',
  MY_VAR_NAME: 'environment-style text',
};

var legacyValue = 1;

const docsText = 'The token var appears in a string but should not be reported.';

function readLegacyValue() {
  return legacyValue + docsText.length + metadata.variant.length;
}

export { metadata, readLegacyValue };
