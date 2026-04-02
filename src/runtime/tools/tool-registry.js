import { createRuleScanTool } from './audit/rule-scan.js';
import { createSecurityScanTool } from './audit/security-scan.js';
import { createAstGrepSearchTool } from './ast/ast-grep-search.js';
import { createAstReplaceTool } from './ast/ast-replace.js';
import { createAstSearchTool } from './ast/ast-search.js';
import { createCodemodApplyTool } from './codemod/codemod-apply.js';
import { createCodemodPreviewTool } from './codemod/codemod-preview.js';
import { createLookAtTool } from './analysis/look-at.js';
import { createEmbeddingIndexTool } from './analysis/embedding-index.js';
import { createBrowserVerifyTool } from './browser/browser-verify.js';
import { createContinuationHandoffTool } from './continuation/continuation-handoff.js';
import { createContinuationStartTool } from './continuation/continuation-start.js';
import { createContinuationStatusTool } from './continuation/continuation-status.js';
import { createContinuationStopTool } from './continuation/continuation-stop.js';
import { createBackgroundCancelTool } from './delegation/background-cancel.js';
import { createBackgroundOutputTool } from './delegation/background-output.js';
import { createDelegationTaskTool } from './delegation/task.js';
import { createHashlineEditTool } from './edit/hashline-edit.js';
import { createFindDependenciesTool } from './graph/find-dependencies.js';
import { createFindDependentsTool } from './graph/find-dependents.js';
import { createFindSymbolTool } from './graph/find-symbol.js';
import { createImportGraphTool } from './graph/import-graph.js';
import { createGotoDefinitionTool } from './graph/goto-definition.js';
import { createGraphFindReferencesTool } from './graph/find-references.js';
import { createCallHierarchyTool } from './graph/call-hierarchy.js';
import { createRenamePreviewTool } from './graph/rename-preview.js';
import { createSemanticSearchTool } from './graph/semantic-search.js';
import { createInteractiveBashTool } from './interactive/interactive-bash.js';
import { createLspDiagnosticsTool } from './lsp/lsp-diagnostics.js';
import { createLspFindReferencesTool } from './lsp/lsp-find-references.js';
import { createLspGotoDefinitionTool } from './lsp/lsp-goto-definition.js';
import { createLspPrepareRenameTool } from './lsp/lsp-prepare-rename.js';
import { createLspRenameTool } from './lsp/lsp-rename.js';
import { createLspSymbolsTool } from './lsp/lsp-symbols.js';
import { createMcpDispatchTool } from './mcp/mcp-dispatch.js';
import { createProfileSwitchTool } from './models/profile-switch.js';
import { createSessionListTool } from './session/session-list.js';
import { createSessionReadTool } from './session/session-read.js';
import { createSessionSearchTool } from './session/session-search.js';
import { createSyntaxContextTool } from './syntax/syntax-context.js';
import { createSyntaxLocateTool } from './syntax/syntax-locate.js';
import { createSyntaxOutlineTool } from './syntax/syntax-outline.js';
import { createEvidenceCaptureTool } from './workflow/evidence-capture.js';
import { createRuntimeSummaryTool } from './workflow/runtime-summary.js';
import { createWorkflowStateTool } from './workflow/workflow-state.js';
import { wrapToolExecution } from './wrap-tool-execution.js';

export function createToolRegistry({ projectRoot, managers, config, mcpPlatform, modelRuntime, invocationLogger = null, guardHooks = null, env = process.env }) {
  const disabledTools = new Set(config?.disabled?.tools ?? []);
  const definitions = [
    createWorkflowStateTool({ projectRoot, workflowKernel: managers.workflowKernel }),
    createRuntimeSummaryTool({ workflowKernel: managers.workflowKernel }),
    createEvidenceCaptureTool({ workflowKernel: managers.workflowKernel }),
    createSessionListTool({ sessionStateManager: managers.sessionStateManager }),
    createSessionReadTool({ sessionStateManager: managers.sessionStateManager }),
    createSessionSearchTool({ sessionStateManager: managers.sessionStateManager }),
    createContinuationStatusTool({
      continuationStateManager: managers.continuationStateManager,
      workflowKernel: managers.workflowKernel,
      sessionStateManager: managers.sessionStateManager,
    }),
    createContinuationStartTool({
      continuationStateManager: managers.continuationStateManager,
      workflowKernel: managers.workflowKernel,
    }),
    createContinuationStopTool({ continuationStateManager: managers.continuationStateManager }),
    createContinuationHandoffTool({ continuationStateManager: managers.continuationStateManager }),
    createDelegationTaskTool({ backgroundManager: managers.backgroundManager, delegationSupervisor: managers.delegationSupervisor }),
    createBackgroundOutputTool({ backgroundManager: managers.backgroundManager }),
    createBackgroundCancelTool({ backgroundManager: managers.backgroundManager }),
    createMcpDispatchTool({ mcpPlatform }),
    createProfileSwitchTool({
      specialists: managers.delegationSupervisor?.specialists ?? [],
      modelRuntime: modelRuntime ?? { resolutions: [] },
      agentProfileSwitchManager: managers.agentProfileSwitchManager,
    }),
    createInteractiveBashTool(),
    createHashlineEditTool({ projectRoot }),
    createLookAtTool({ projectRoot }),
    createEmbeddingIndexTool({ embeddingIndexer: managers.embeddingIndexer }),
    createRuleScanTool({ projectRoot }),
    createSecurityScanTool({ projectRoot }),
    createCodemodPreviewTool({ projectRoot }),
    createCodemodApplyTool({ projectRoot }),
    createSyntaxOutlineTool({ syntaxIndexManager: managers.syntaxIndexManager }),
    createSyntaxContextTool({ syntaxIndexManager: managers.syntaxIndexManager }),
    createSyntaxLocateTool({ syntaxIndexManager: managers.syntaxIndexManager }),
    createBrowserVerifyTool({ config, env }),
    createLspSymbolsTool({ projectRoot, projectGraphManager: managers.projectGraphManager }),
    createLspDiagnosticsTool({ projectRoot, projectGraphManager: managers.projectGraphManager }),
    createLspGotoDefinitionTool({ projectRoot, projectGraphManager: managers.projectGraphManager }),
    createLspFindReferencesTool({ projectRoot, projectGraphManager: managers.projectGraphManager }),
    createLspPrepareRenameTool({ projectRoot, projectGraphManager: managers.projectGraphManager }),
    createLspRenameTool({ projectRoot, projectGraphManager: managers.projectGraphManager }),
    createAstSearchTool({ projectRoot, syntaxIndexManager: managers.syntaxIndexManager }),
    createAstGrepSearchTool({ projectRoot }),
    createAstReplaceTool({ projectRoot }),
    createImportGraphTool({ projectGraphManager: managers.projectGraphManager }),
    createFindDependenciesTool({ projectGraphManager: managers.projectGraphManager }),
    createFindDependentsTool({ projectGraphManager: managers.projectGraphManager }),
    createFindSymbolTool({ projectGraphManager: managers.projectGraphManager }),
    createGotoDefinitionTool({ projectGraphManager: managers.projectGraphManager }),
    createGraphFindReferencesTool({ projectGraphManager: managers.projectGraphManager }),
    createCallHierarchyTool({ projectGraphManager: managers.projectGraphManager }),
    createRenamePreviewTool({ projectGraphManager: managers.projectGraphManager }),
    createSemanticSearchTool({ projectGraphManager: managers.projectGraphManager, sessionMemoryManager: managers.sessionMemoryManager }),
  ];

  const enabledTools = definitions
    .filter((tool) => !disabledTools.has(tool.id))
    .map((tool) => wrapToolExecution(tool, { actionModelStateManager: managers.actionModelStateManager, invocationLogger, guardHooks }));

  return {
    toolList: enabledTools,
    tools: Object.fromEntries(enabledTools.map((tool) => [tool.id, tool])),
  };
}
