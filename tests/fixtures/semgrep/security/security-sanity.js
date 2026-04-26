function compileTemplate(source) {
  return new Function('context', source);
}

export { compileTemplate };
