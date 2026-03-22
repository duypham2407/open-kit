function formatList(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return 'none';
  }

  return values.join(', ');
}

export function renderManagedDoctorSummary(result) {
  const lines = [
    `Status: ${result.status}`,
    `Summary: ${result.summary}`,
    `Can run cleanly: ${result.canRunCleanly ? 'yes' : 'no'}`,
    `Owned by OpenKit: ${formatList(result.ownedAssets?.managed)}`,
    `Adopted by OpenKit: ${formatList(result.ownedAssets?.adopted)}`,
    `Drifted assets: ${formatList(result.driftedAssets)}`,
  ];

  if (Array.isArray(result.issues) && result.issues.length > 0) {
    lines.push('Issues:');
    for (const issue of result.issues) {
      lines.push(`- ${issue}`);
    }
  }

  return `${lines.join('\n')}\n`;
}
