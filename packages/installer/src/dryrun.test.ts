import { describe, it, expect } from 'vitest';
import { formatDryRun } from './dryrun.js';
import type { ResolvedInstallPlan } from './dryrun.js';

describe('formatDryRun', () => {
  it('includes scope and steps in output', () => {
    const plan: ResolvedInstallPlan = {
      steps: ['Copy SKILL.md', 'Register hooks'],
      scope: 'project',
      destinationPaths: ['/tmp/.agents/skills/my-skill'],
    };
    const output = formatDryRun({ plan, adapterName: 'adapter-test' });
    expect(output).toContain('adapter-test');
    expect(output).toContain('project');
    expect(output).toContain('Copy SKILL.md');
    expect(output).toContain('/tmp/.agents/skills/my-skill');
  });

  it('includes conflicts when present', () => {
    const plan: ResolvedInstallPlan = {
      steps: ['Install'],
      scope: 'project',
      destinationPaths: ['/tmp/dest'],
      conflicts: [{ targetPath: '/tmp/dest/SKILL.md', severity: 'warning' }],
    };
    const output = formatDryRun({ plan, adapterName: 'test' });
    expect(output).toContain('Conflicts');
    expect(output).toContain('/tmp/dest/SKILL.md');
  });

  it('includes backup plan when present', () => {
    const plan: ResolvedInstallPlan = {
      steps: ['Install'],
      scope: 'user',
      destinationPaths: ['/home/user/.agents'],
      backupPlan: [
        {
          sourcePath: '/home/user/.agents/SKILL.md',
          backupPath: '/home/user/.agents/SKILL.md.backup',
          checksum: 'abc123',
        },
      ],
    };
    const output = formatDryRun({ plan, adapterName: 'test' });
    expect(output).toContain('Backup Plan');
    expect(output).toContain('abc123');
  });

  it('includes integrity manifest when present', () => {
    const plan: ResolvedInstallPlan = {
      steps: ['Install'],
      scope: 'project',
      destinationPaths: ['/tmp/dest'],
      manifest: {
        files: { 'SKILL.md': 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' },
      },
    };
    const output = formatDryRun({ plan, adapterName: 'test' });
    expect(output).toContain('Integrity Manifest');
    expect(output).toContain('SKILL.md');
  });

  it('includes warnings when present', () => {
    const plan: ResolvedInstallPlan = {
      steps: ['Install'],
      scope: 'project',
      destinationPaths: ['/tmp/dest'],
      warnings: [{ severity: 'warning', message: 'test warning', code: 'WARN-001' }],
    };
    const output = formatDryRun({ plan, adapterName: 'test' });
    expect(output).toContain('Warnings');
    expect(output).toContain('test warning');
  });
});
