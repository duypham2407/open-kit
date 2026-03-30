export class TaskOutputStore {
  constructor() {
    this.outputs = new Map();
  }

  write(runId, output) {
    this.outputs.set(runId, output);
    return output;
  }

  read(runId) {
    return this.outputs.get(runId) ?? null;
  }
}
