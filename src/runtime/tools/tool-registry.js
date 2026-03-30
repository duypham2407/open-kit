import { createAstReplaceTool } from './ast/ast-replace.js';
import { createAstSearchTool } from './ast/ast-search.js';
import { createLookAtTool } from './analysis/look-at.js';
import { createBackgroundCancelTool } from './delegation/background-cancel.js';
import { createBackgroundOutputTool } from './delegation/background-output.js';
import { createDelegationTaskTool } from './delegation/task.js';
import { createHashlineEditTool } from './edit/hashline-edit.js';
import { createInteractiveBashTool } from './interactive/interactive-bash.js';
import { createLspDiagnosticsTool } from './lsp/lsp-diagnostics.js';
import { createLspFindReferencesTool } from './lsp/lsp-find-references.js';
import { createLspGotoDefinitionTool } from './lsp/lsp-goto-definition.js';
import { createLspPrepareRenameTool } from './lsp/lsp-prepare-rename.js';
import { createLspRenameTool } from './lsp/lsp-rename.js';
import { createLspSymbolsTool } from './lsp/lsp-symbols.js';
import { createSessionListTool } from './session/session-list.js';
import { createSessionReadTool } from './session/session-read.js';
import { createSessionSearchTool } from './session/session-search.js';
import { createEvidenceCaptureTool } from './workflow/evidence-capture.js';
import { createRuntimeSummaryTool } from './workflow/runtime-summary.js';
import { createWorkflowStateTool } from './workflow/workflow-state.js';

export function createToolRegistry({ projectRoot, managers, config }) {
  const disabledTools = new Set(config?.disabled?.tools ?? []);
  const definitions = [
    createWorkflowStateTool({ projectRoot }),
    createRuntimeSummaryTool({ projectRoot }),
    createEvidenceCaptureTool(),
    createSessionListTool({ sessionStateManager: managers.sessionStateManager }),
    createSessionReadTool({ sessionStateManager: managers.sessionStateManager }),
    createSessionSearchTool({ sessionStateManager: managers.sessionStateManager }),
    createDelegationTaskTool({ backgroundManager: managers.backgroundManager }),
    createBackgroundOutputTool({ backgroundManager: managers.backgroundManager }),
    createBackgroundCancelTool({ backgroundManager: managers.backgroundManager }),
    createInteractiveBashTool(),
    createHashlineEditTool(),
    createLookAtTool(),
    createLspSymbolsTool(),
    createLspDiagnosticsTool(),
    createLspGotoDefinitionTool(),
    createLspFindReferencesTool(),
    createLspPrepareRenameTool(),
    createLspRenameTool(),
    createAstSearchTool(),
    createAstReplaceTool(),
  ];

  const enabledTools = definitions.filter((tool) => !disabledTools.has(tool.id));

  return {
    toolList: enabledTools,
    tools: Object.fromEntries(enabledTools.map((tool) => [tool.id, tool])),
  };
}
