#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();

program
  .name('git-reviewer')
  .description('Local code review tool with a GitHub PR-like web experience')
  .version('0.1.0');

program
  .command('serve')
  .description('Start the git-reviewer web server for the given repository')
  .option('--base <ref>', 'Base ref for the diff (branch, tag, or commit SHA)')
  .option('--head <ref>', 'Head ref for the diff (defaults to HEAD)')
  .option('--uncommitted', 'Review uncommitted (working tree) changes', false)
  .option('--repo <path>', 'Path to the git repository to review', process.cwd())
  .option('--port <number>', 'Port to listen on', '3847')
  .action(
    (_options: {
      base?: string;
      head?: string;
      uncommitted: boolean;
      repo: string;
      port: string;
    }) => {
      // TODO: implement in 7.4
      console.log('serve command — not yet implemented');
      process.exit(0);
    },
  );

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
