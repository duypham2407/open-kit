import { strict as assert } from 'node:assert';

const stableValue = 1;
let mutableValue = 2;

function updateValue(nextValue) {
  mutableValue = nextValue;
  return stableValue + mutableValue;
}

assert.equal(updateValue(3), 4);

export { updateValue };
