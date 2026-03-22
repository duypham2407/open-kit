function formatConflict(conflict) {
  const details = [conflict.path];

  if (conflict.reason) {
    details.push(`reason=${conflict.reason}`);
  }

  if (conflict.resolution) {
    details.push(`resolution=${conflict.resolution}`);
  }

  return `- ${details.join(' | ')}`;
}

export function writeConflictReport(io, commandName, conflicts) {
  io.stderr.write(
    `${commandName} aborted due to conflicts.\n${conflicts.map((conflict) => formatConflict(conflict)).join('\n')}\n`
  );
}
