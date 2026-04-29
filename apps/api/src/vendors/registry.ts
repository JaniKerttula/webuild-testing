import type { VendorId } from '@we-build/domain';

import { createIgrantSandboxAdapter } from './sandboxAdapter.js';
import { createMockLocalAdapter } from './mockLocalAdapter.js';
import type { VendorAdapter } from './contract.js';

const adapters = new Map<VendorId, VendorAdapter>([
  ['mock-local', createMockLocalAdapter()],
  ['igrant-sandbox', createIgrantSandboxAdapter()],
]);

export function listVendorAdapters(): VendorAdapter[] {
  return Array.from(adapters.values());
}

export function getVendorAdapter(vendorId: string): VendorAdapter | undefined {
  return adapters.get(vendorId as VendorId);
}

export function hasVendorAdapter(vendorId: string): boolean {
  return adapters.has(vendorId as VendorId);
}