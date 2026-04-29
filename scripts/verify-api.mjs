const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:4000';

function log(message) {
  process.stdout.write(`${message}\n`);
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function assertCondition(condition, message) {
  if (!condition) {
    fail(`Verification failed: ${message}`);
  }
}

async function requestJson(path, init) {
  const response = await fetch(`${apiBaseUrl}${path}`, init);
  const text = await response.text();

  let payload;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    fail(`Expected JSON from ${path}, received: ${text}`);
  }

  if (!response.ok) {
    fail(`Request to ${path} failed with ${response.status}: ${JSON.stringify(payload)}`);
  }

  return payload;
}

async function main() {
  log(`Using API base URL: ${apiBaseUrl}`);

  const health = await requestJson('/health');
  assertCondition(health.status === 'ok', 'health endpoint should return status ok');
  log('Health endpoint verified.');

  const vendors = await requestJson('/api/vendors');
  assertCondition(Array.isArray(vendors), 'vendors endpoint should return an array');
  assertCondition(vendors.length >= 2, 'vendors endpoint should return at least two vendors');
  assertCondition(vendors.some((vendor) => vendor.id === 'mock-local'), 'vendors should include mock-local');
  assertCondition(vendors.some((vendor) => vendor.id === 'igrant-sandbox'), 'vendors should include igrant-sandbox');
  log('Vendor registry endpoint verified.');

  const session = await requestJson('/api/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ vendorId: 'mock-local' }),
  });

  assertCondition(typeof session.sessionId === 'string' && session.sessionId.length > 0, 'session creation should return a sessionId');
  assertCondition(session.pid?.status === 'ready', 'new session should have pid ready');
  assertCondition(session.companyInitiation?.status === 'blocked', 'new session should block company initiation initially');
  log(`Session creation verified for ${session.sessionId}.`);

  const reloadedSession = await requestJson(`/api/sessions/${session.sessionId}`);
  assertCondition(reloadedSession.sessionId === session.sessionId, 'session reload should return the same session');
  log('Session reload verified.');

  const seededPidWalletSession = await requestJson(`/api/sessions/${session.sessionId}/wallets/personal/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      credentialType: 'pid',
    }),
  });

  assertCondition(seededPidWalletSession.wallets.personal.loadedCredentials.some((credential) => credential.credentialType === 'pid'), 'personal wallet should contain seeded pid credential');

  const seededPoaWalletSession = await requestJson(`/api/sessions/${session.sessionId}/wallets/personal/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      credentialType: 'poa',
    }),
  });

  assertCondition(seededPoaWalletSession.wallets.personal.loadedCredentials.some((credential) => credential.credentialType === 'poa'), 'personal wallet should contain seeded poa credential');

  const seededEuccWalletSession = await requestJson(`/api/sessions/${session.sessionId}/wallets/company/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      credentialType: 'eucc',
    }),
  });

  assertCondition(seededEuccWalletSession.wallets.company.loadedCredentials.some((credential) => credential.credentialType === 'eucc'), 'company wallet should contain seeded eucc credential');
  assertCondition(
    seededEuccWalletSession.eventLog.some(
      (entry) => entry.step === 'eucc' && entry.status === 'ready' && entry.message.includes('company wallet'),
    ),
    'wallet seeding should append an event log entry',
  );
  log('Wallet seeding verified.');

  const updatedSession = await requestJson(`/api/sessions/${session.sessionId}/actions/pid`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      simulationMode: 'success',
    }),
  });

  assertCondition(updatedSession.pid?.status === 'succeeded', 'pid step should update to succeeded');
  assertCondition(updatedSession.lifecycle === 'in-progress', 'session lifecycle should become in-progress after pid succeeds');
  assertCondition(updatedSession.companyInitiation?.status === 'ready', 'company initiation should unlock after pid succeeds');
  assertCondition(updatedSession.eventLog.some((entry) => entry.step === 'pid' && entry.status === 'succeeded'), 'pid success should be recorded in the event log');
  log('Session update and dependency unlock verified.');

  const companySession = await requestJson(`/api/sessions/${session.sessionId}/actions/companyInitiation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      simulationMode: 'success',
    }),
  });

  assertCondition(companySession.companyInitiation?.status === 'succeeded', 'company initiation should succeed through adapter action');
  assertCondition(companySession.poa?.status === 'ready', 'poa should unlock after company initiation succeeds');
  assertCondition(companySession.eucc?.status === 'ready', 'eucc should unlock after company initiation succeeds');
  log('Company initiation adapter action verified.');

  const pendingVatSession = await requestJson(`/api/sessions/${session.sessionId}/actions/vatIssuance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      simulationMode: 'pending',
    }),
  });

  assertCondition(pendingVatSession.vatIssuance?.status === 'pending', 'vat issuance should support pending state');
  log('VAT issuance pending state verified.');

  log('API verification completed successfully.');
}

main().catch((error) => {
  fail(`Verification failed with an unexpected error: ${error instanceof Error ? error.message : String(error)}`);
});