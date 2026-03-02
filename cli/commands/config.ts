// cli/commands/config.ts — Interactive environment configuration
// SPDX-License-Identifier: GPL-3.0-only

import { type Command } from 'commander';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { readEnvFile, writeEnvFile, createFromExample, ENV_KEYS, ENV_DESCRIPTIONS } from '../lib/env.js';
import { ENV_FILE } from '../lib/paths.js';

export async function configCommand(): Promise<void> {
  p.intro(pc.cyan('Environment Configuration'));

  while (true) {
    const action = await p.select({
      message: 'What would you like to do?',
      options: [
        { value: 'view', label: 'View current config' },
        { value: 'demo', label: 'Toggle demo mode' },
        { value: 'convex', label: 'Set Convex URL' },
        { value: 'reset', label: 'Reset to defaults', hint: 'from .env.example' },
        { value: 'done', label: 'Done' },
      ],
    });

    if (p.isCancel(action) || action === 'done') {
      p.outro('Configuration saved.');
      return;
    }

    const env = readEnvFile();

    switch (action) {
      case 'view': {
        const lines: string[] = [];
        for (const key of ENV_KEYS) {
          const val = env.get(key);
          const display = val || pc.dim('(not set)');
          lines.push(`${pc.bold(key)}\n  ${ENV_DESCRIPTIONS[key]}\n  Value: ${display}`);
        }
        p.note(lines.join('\n\n'), 'Current Config');
        break;
      }

      case 'demo': {
        const current = env.get('NEXT_PUBLIC_DEMO_MODE') === 'true';
        const newVal = !current;
        if (newVal) {
          env.set('NEXT_PUBLIC_DEMO_MODE', 'true');
        } else {
          env.delete('NEXT_PUBLIC_DEMO_MODE');
        }
        writeEnvFile(ENV_FILE, env);
        p.log.success(`Demo mode ${newVal ? pc.green('enabled') : pc.yellow('disabled')}`);
        break;
      }

      case 'convex': {
        const current = env.get('NEXT_PUBLIC_CONVEX_URL') ?? '';
        const value = await p.text({
          message: 'Enter Convex deployment URL:',
          placeholder: 'https://your-deployment.convex.cloud',
          initialValue: current,
          validate: (v) => {
            if (v && !v.startsWith('https://')) return 'URL must start with https://';
            return undefined;
          },
        });
        if (p.isCancel(value)) break;
        if (value) {
          env.set('NEXT_PUBLIC_CONVEX_URL', value);
        } else {
          env.delete('NEXT_PUBLIC_CONVEX_URL');
        }
        writeEnvFile(ENV_FILE, env);
        p.log.success('Convex URL updated');
        break;
      }

      case 'reset': {
        const confirm = await p.confirm({
          message: 'Reset .env.local to defaults from .env.example?',
        });
        if (p.isCancel(confirm) || !confirm) break;
        // Delete existing and recreate
        const fs = await import('node:fs');
        if (fs.existsSync(ENV_FILE)) fs.unlinkSync(ENV_FILE);
        const created = createFromExample();
        if (created) {
          p.log.success('Reset to defaults');
        } else {
          p.log.error('.env.example not found');
        }
        break;
      }
    }
  }
}

export function registerConfig(program: Command): void {
  program
    .command('config')
    .description('Configure environment (.env.local)')
    .action(async () => {
      await configCommand();
    });
}
