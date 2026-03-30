export function spawnTmuxPane(tmuxSessionManager, title) {
  return tmuxSessionManager.createSession(title);
}
