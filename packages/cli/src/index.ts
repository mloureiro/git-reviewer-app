#!/usr/bin/env node
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Command } from 'commander';
import open from 'open';
import { createApp, createGitClient, validateRefs, createAutoSession } from '@git-reviewer/server';

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
  .option('--no-open', 'Do not automatically open the browser after starting')
  .action(
    async (options: {
      base?: string;
      head?: string;
      uncommitted: boolean;
      repo: string;
      port: string;
      open: boolean;
    }) => {
      const repoPath = path.resolve(options.repo);
      const port = parseInt(options.port, 10);

      const git = createGitClient(repoPath);

      // Validate refs (or uncommitted state) before starting the server.
      // Exits with a clear error message if validation fails.
      let baseCommit: string;
      let headCommit: string;

      try {
        const result = await validateRefs(git, {
          base: options.base,
          head: options.head,
          uncommitted: options.uncommitted,
        });
        baseCommit = result.baseCommit;
        headCommit = result.headCommit;
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }

      // Auto-create the review session in git-notes so the server can find it on load.
      let sessionCommit: string;

      try {
        const session = await createAutoSession(git, {
          base: options.base,
          head: options.head,
          uncommitted: options.uncommitted,
          baseCommit,
          headCommit,
        });
        sessionCommit = session.session.headCommit;
        console.log(`Review session created: ${session.session.title} (${session.session.id})`);
      } catch (err) {
        console.error(
          `Error creating review session: ${err instanceof Error ? err.message : String(err)}`,
        );
        process.exit(1);
      }

      // Resolve the built client assets relative to this file.
      // In production: packages/cli/dist/index.js -> ../../client/dist
      const thisDir = path.dirname(fileURLToPath(import.meta.url));
      const candidateStaticDir = path.resolve(thisDir, '../../client/dist');
      const staticDir = existsSync(candidateStaticDir) ? candidateStaticDir : undefined;

      const app = createApp({ repoPath, staticDir });

      const sessionUrl = `http://localhost:${port}/session/${sessionCommit}`;

      app.listen(port, () => {
        console.log(`git-reviewer running at http://localhost:${port}`);
        console.log(`Reviewing repo: ${repoPath}`);
        console.log(`Review session: ${sessionUrl}`);
        if (staticDir) {
          console.log(`Serving client from: ${staticDir}`);
        }

        if (options.open) {
          open(sessionUrl).catch((err: unknown) => {
            console.warn(
              `Could not open browser: ${err instanceof Error ? err.message : String(err)}`,
            );
          });
        }
      });
    },
  );

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
