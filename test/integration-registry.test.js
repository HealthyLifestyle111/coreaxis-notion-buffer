import test from 'node:test';
import assert from 'node:assert/strict';
import { integrationStatus, productionReadiness } from '../orchestrator/integration-registry.js';

test('integration registry reports every external connection without exposing secret values', () => {
  const status = integrationStatus();
  assert.ok(status.length >= 10);
  assert.ok(status.every((item) => typeof item.connected === 'boolean'));
  assert.ok(status.every((item) => !('value' in item)));
});

test('production readiness isolates blocked external systems', () => {
  const report = productionReadiness();
  assert.equal(report.connectedCount + report.blocked.length, report.totalCount);
  assert.ok(Array.isArray(report.blocked));
  assert.ok(report.blocked.every((item) => item.action));
});
