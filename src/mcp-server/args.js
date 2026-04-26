export function parseServerArgs(argv = process.argv.slice(2), env = process.env, cwd = process.cwd()) {
  let projectRoot = env.OPENKIT_PROJECT_ROOT ?? cwd;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--project-root' && argv[i + 1]) {
      projectRoot = argv[i + 1];
      i++;
    }
  }
  return { projectRoot };
}
