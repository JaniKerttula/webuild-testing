import { createIgrantSandboxAdapter } from './sandboxAdapter.js';
import { createMockLocalAdapter } from './mockLocalAdapter.js';
const adapters = new Map([
    ['mock-local', createMockLocalAdapter()],
    ['igrant-sandbox', createIgrantSandboxAdapter()],
]);
export function listVendorAdapters() {
    return Array.from(adapters.values());
}
export function getVendorAdapter(vendorId) {
    return adapters.get(vendorId);
}
export function hasVendorAdapter(vendorId) {
    return adapters.has(vendorId);
}
