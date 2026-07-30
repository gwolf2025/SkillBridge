import { describeAdapterContract } from './contract.js';
import { InMemoryTestAdapter } from './adapter.js';
import type { AdapterCapability } from '@skillbridge/adapter-sdk';

const allCaps: AdapterCapability[] = [
  'detect',
  'parse',
  'normalize',
  'compile',
  'install-plan',
  'install',
  'uninstall',
  'verify',
  'invoke',
];

const testManifest = {
  name: 'in-memory-test-adapter',
  version: '1.0.0',
  vendor: 'skillbridge',
  adapterVersion: '0.1.0',
  supports: { sourceFormats: ['markdown'], targetFormats: ['json'] },
  capabilities: allCaps,
};

const adapter = new InMemoryTestAdapter({
  manifest: testManifest,
  trackCalls: true,
  rejectInputs: [''],
});

describeAdapterContract(adapter, {
  detectRejectInput: '',
});
