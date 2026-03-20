# Severity Levels

## Levels

- `critical`: blocks release or risks security/data loss
- `high`: breaks required behavior or approval criteria
- `medium`: partial degradation or incorrect edge-case handling
- `low`: minor quality issue that does not block workflow completion

## Rule

Critical and high issues block `qa_to_done` approval.
