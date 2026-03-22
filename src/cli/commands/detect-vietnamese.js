import { detectVietnameseInventory, renderVietnameseInventoryReport } from '../../audit/vietnamese-detection.js';

function detectVietnameseHelp() {
  return [
    'Usage: openkit internal-audit-vietnamese',
    '',
    'Run the maintainer audit helper for heuristic Vietnamese detection across repo-wide checked-in files.',
    'This helper uses heuristics and still requires review for false positives and false negatives.',
  ].join('\n');
}

export const detectVietnameseCommand = {
  name: 'internal-audit-vietnamese',
  async run(args = [], io) {
    if (args.includes('--help') || args.includes('-h')) {
      io.stdout.write(`${detectVietnameseHelp()}\n`);
      return 0;
    }

    const inventory = detectVietnameseInventory(process.cwd());
    io.stdout.write(renderVietnameseInventoryReport(inventory));
    return 0;
  },
};
