export function recoverSessionState(session = null) {
  return {
    status: session ? 'recovered' : 'empty',
    session,
  };
}
