export class StateTransitionError extends Error {
  constructor({ currentStage, targetStage, validNextStages = [] }) {
    super(`Invalid transition from ${currentStage} to ${targetStage}. Valid next stages: ${validNextStages.join(', ') || 'none'}`);
    this.name = 'StateTransitionError';
    this.currentStage = currentStage;
    this.targetStage = targetStage;
    this.validNextStages = validNextStages;
  }

  toJSON() {
    return {
      type: this.name,
      message: this.message,
      currentStage: this.currentStage,
      targetStage: this.targetStage,
      validNextStages: this.validNextStages
    };
  }
}

export class GateNotMetError extends Error {
  constructor({ currentStage, targetStage, missingGates = [] }) {
    const gateNames = missingGates.map(g => g.gate).join(', ') || 'none';
    super(`Cannot advance from ${currentStage} to ${targetStage}: required gates not met: ${gateNames}`);
    this.name = 'GateNotMetError';
    this.currentStage = currentStage;
    this.targetStage = targetStage;
    this.missingGates = missingGates;
  }

  toJSON() {
    return {
      type: this.name,
      message: this.message,
      currentStage: this.currentStage,
      targetStage: this.targetStage,
      blockedBy: this.missingGates,
      recommendations: this.missingGates.map(g =>
        `Set gate '${g.gate}' via tool.set-approval with authority '${g.authority}'`
      )
    };
  }
}

export class InsufficientAuthorityError extends Error {
  constructor({ gateName, requiredAuthority, actualCaller }) {
    super(`Cannot set gate '${gateName}': requires authority '${requiredAuthority}', but caller is '${actualCaller}'`);
    this.name = 'InsufficientAuthorityError';
    this.gateName = gateName;
    this.requiredAuthority = requiredAuthority;
    this.actualCaller = actualCaller;
  }

  toJSON() {
    return {
      type: this.name,
      message: this.message,
      gateName: this.gateName,
      requiredAuthority: this.requiredAuthority,
      actualCaller: this.actualCaller
    };
  }
}

export class StateCorruptionError extends Error {
  constructor({ reason, state }) {
    super(`State corruption detected: ${reason}`);
    this.name = 'StateCorruptionError';
    this.reason = reason;
    this.state = state;
  }

  toJSON() {
    return {
      type: this.name,
      message: this.message,
      reason: this.reason,
      state: this.state
    };
  }
}
