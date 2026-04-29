import { randomUUID } from 'node:crypto';

import cors from 'cors';
import express from 'express';
import {
  createInitialSession,
  isAdapterSimulationMode,
  isSeedableWalletRole,
  isWalletCredentialType,
  isWorkflowStepKey,
  upsertWalletCredential,
  updateSessionStep,
  type AdapterSimulationMode,
  type CreateSessionRequest,
  type OrchestrationSession,
  type SeedWalletCredentialRequest,
  type SessionActionKey,
  type TriggerSessionActionRequest,
  type UpdateSessionStepRequest,
  type WorkflowStepKey,
} from '@we-build/domain';

import { createLogger, type Logger } from './logger.js';
import { executeVendorOperation, type VendorExecutionConfig } from './vendorExecutor.js';
import { getVendorAdapter, hasVendorAdapter, listVendorAdapters } from './vendors/registry.js';
import type { AdapterOperationResult, VendorAdapter } from './vendors/contract.js';

export type AppDependencies = {
  sessions?: Map<string, OrchestrationSession>;
  getAdapter?: (vendorId: string) => VendorAdapter | undefined;
  hasAdapter?: (vendorId: string) => boolean;
  listAdapters?: typeof listVendorAdapters;
  logger?: Logger;
  executionConfig?: VendorExecutionConfig;
  apiPort?: number;
  corsOrigin?: string;
};

function normalizeStepStatus(result: AdapterOperationResult<unknown>): 'succeeded' | 'pending' | 'failed' {
  return result.status;
}

function isSessionActionKey(value: string): value is SessionActionKey {
  return value === 'issuanceStatus' || isWorkflowStepKey(value);
}

function applyActionResult(
  session: OrchestrationSession,
  actionKey: SessionActionKey,
  result: AdapterOperationResult<unknown>,
) {
  switch (actionKey) {
    case 'pid':
      return updateSessionStep(session, {
        step: 'pid',
        status: normalizeStepStatus(result),
        data: result.data as OrchestrationSession['pid']['data'],
        error: result.error,
        message: result.message,
      });
    case 'poa':
      return updateSessionStep(session, {
        step: 'poa',
        status: normalizeStepStatus(result),
        data: result.data as OrchestrationSession['poa']['data'],
        error: result.error,
        message: result.message,
      });
    case 'eucc':
      return updateSessionStep(session, {
        step: 'eucc',
        status: normalizeStepStatus(result),
        data: result.data as OrchestrationSession['eucc']['data'],
        error: result.error,
        message: result.message,
      });
    case 'review':
      return updateSessionStep(session, {
        step: 'review',
        status: normalizeStepStatus(result),
        data: result.data as OrchestrationSession['review']['data'],
        error: result.error,
        message: result.message,
      });
    case 'vatIssuance':
    case 'issuanceStatus':
      return updateSessionStep(session, {
        step: 'vatIssuance',
        status: normalizeStepStatus(result),
        data: result.data as OrchestrationSession['vatIssuance']['data'],
        error: result.error,
        message: result.message,
      });
  }
}

function getWalletCredentialFromActionResult(
  actionKey: SessionActionKey,
  result: AdapterOperationResult<unknown>,
) {
  if ((actionKey !== 'vatIssuance' && actionKey !== 'issuanceStatus') || !result.data || typeof result.data !== 'object') {
    return undefined;
  }

  const vatResult = result.data as OrchestrationSession['vatIssuance']['data'];
  return vatResult?.walletCredential;
}

function readExecutionConfig(): VendorExecutionConfig {
  const timeoutMs = Number(process.env.VENDOR_OPERATION_TIMEOUT_MS ?? '5000');
  const retryCount = Number(process.env.VENDOR_OPERATION_RETRY_COUNT ?? '1');

  return {
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 5000,
    retryCount: Number.isFinite(retryCount) && retryCount >= 0 ? retryCount : 1,
  };
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();
  const sessions = dependencies.sessions ?? new Map<string, OrchestrationSession>();
  const logger = dependencies.logger ?? createLogger();
  const getAdapter = dependencies.getAdapter ?? getVendorAdapter;
  const hasAdapter = dependencies.hasAdapter ?? hasVendorAdapter;
  const listAdapters = dependencies.listAdapters ?? listVendorAdapters;
  const corsOrigin = dependencies.corsOrigin ?? process.env.CORS_ORIGIN ?? 'http://localhost:5173';
  const apiPort = dependencies.apiPort ?? Number(process.env.API_PORT ?? '4000');
  const executionConfig = dependencies.executionConfig ?? readExecutionConfig();

  app.use(cors({ origin: corsOrigin }));
  app.use(express.json());
  app.use((request, response, next) => {
    const startedAt = Date.now();

    response.on('finish', () => {
      logger.info('http.request.completed', {
        method: request.method,
        path: request.path,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
      });
    });

    next();
  });

  app.get('/health', (_request, response) => {
    response.json({
      status: 'ok',
      service: 'local-api',
      port: apiPort,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/meta', (_request, response) => {
    response.json({
      name: 'we-build-testing',
      mode: 'localhost',
      version: 'step-14',
    });
  });

  app.get('/api/vendors', (_request, response) => {
    response.json(listAdapters().map((adapter: ReturnType<typeof listVendorAdapters>[number]) => adapter.definition));
  });

  app.post('/api/sessions', (request, response) => {
    const body = request.body as CreateSessionRequest;

    if (!body?.vendorId || !hasAdapter(body.vendorId)) {
      response.status(400).json({ error: 'Invalid vendorId supplied when creating session.' });
      return;
    }

    const adapter = getAdapter(body.vendorId);

    if (!adapter) {
      response.status(500).json({ error: 'Vendor adapter was not found for the supplied vendorId.' });
      return;
    }

    const createdAt = new Date().toISOString();
    const session = createInitialSession(adapter.definition.id, createdAt);
    session.sessionId = randomUUID();
    sessions.set(session.sessionId, session);

    logger.info('session.created', {
      sessionId: session.sessionId,
      vendorId: session.vendorId,
    });

    response.status(201).json(session);
  });

  app.get('/api/sessions/:sessionId', (request, response) => {
    const session = sessions.get(request.params.sessionId);

    if (!session) {
      response.status(404).json({ error: 'Session not found.' });
      return;
    }

    response.json(session);
  });

  app.post('/api/sessions/:sessionId/wallets/:walletRole/credentials', async (request, response) => {
    const session = sessions.get(request.params.sessionId);

    if (!session) {
      response.status(404).json({ error: 'Session not found.' });
      return;
    }

    const { walletRole } = request.params;

    if (!isSeedableWalletRole(walletRole)) {
      response.status(400).json({ error: 'Invalid wallet role.' });
      return;
    }

    const body = request.body as SeedWalletCredentialRequest;

    if (!body?.credentialType || !isWalletCredentialType(body.credentialType)) {
      response.status(400).json({ error: 'Invalid credentialType for wallet seeding.' });
      return;
    }

    const adapter = getAdapter(session.vendorId);

    if (!adapter) {
      response.status(500).json({ error: 'No adapter registered for the session vendor.' });
      return;
    }

    const result = await executeVendorOperation(
      () => adapter.seedWalletCredential(session, walletRole, body.credentialType),
      {
        sessionId: session.sessionId,
        vendorId: session.vendorId,
        operationName: `wallet-seed:${walletRole}:${body.credentialType}`,
      },
      executionConfig,
      logger,
    );

    if (!result.data) {
      response.status(400).json({
        error: result.error?.detail ?? result.error?.message ?? 'Wallet credential seeding failed.',
      });
      return;
    }

    const nextSession = upsertWalletCredential(session, walletRole, result.data);
    sessions.set(nextSession.sessionId, nextSession);
    response.json(nextSession);
  });

  app.patch('/api/sessions/:sessionId/steps/:stepKey', (request, response) => {
    const session = sessions.get(request.params.sessionId);

    if (!session) {
      response.status(404).json({ error: 'Session not found.' });
      return;
    }

    const { stepKey } = request.params;

    if (!isWorkflowStepKey(stepKey)) {
      response.status(400).json({ error: 'Invalid workflow step key.' });
      return;
    }

    const body = request.body as UpdateSessionStepRequest<WorkflowStepKey>;

    if (!body?.status) {
      response.status(400).json({ error: 'Missing status in step update payload.' });
      return;
    }

    const updatedSession = updateSessionStep(session, {
      ...body,
      step: stepKey,
    });

    sessions.set(updatedSession.sessionId, updatedSession);
    response.json(updatedSession);
  });

  app.delete('/api/sessions/:sessionId/steps/:stepKey/history', async (request, response) => {
    const session = sessions.get(request.params.sessionId);

    if (!session) {
      response.status(404).json({ error: 'Session not found.' });
      return;
    }

    const { stepKey } = request.params;

    if (!isWorkflowStepKey(stepKey)) {
      response.status(400).json({ error: 'Invalid workflow step key.' });
      return;
    }

    const adapter = getAdapter(session.vendorId);

    if (!adapter) {
      response.status(500).json({ error: 'No adapter registered for the session vendor.' });
      return;
    }

    const result = await executeVendorOperation(
      () => adapter.cleanupStepHistory(session, stepKey),
      {
        sessionId: session.sessionId,
        vendorId: session.vendorId,
        operationName: `${stepKey}:history:delete`,
      },
      executionConfig,
      logger,
    );

    if (result.status === 'failed' || result.error) {
      response.status(400).json({
        error: result.error?.detail ?? result.error?.message ?? 'Step history cleanup failed.',
      });
      return;
    }

    response.status(204).end();
  });

  app.post('/api/sessions/:sessionId/actions/:actionKey', async (request, response) => {
    const session = sessions.get(request.params.sessionId);

    if (!session) {
      response.status(404).json({ error: 'Session not found.' });
      return;
    }

    const { actionKey } = request.params;

    if (!isSessionActionKey(actionKey)) {
      response.status(400).json({ error: 'Invalid session action key.' });
      return;
    }

    const adapter = getAdapter(session.vendorId);

    if (!adapter) {
      response.status(500).json({ error: 'No adapter registered for the session vendor.' });
      return;
    }

    const body = (request.body ?? {}) as TriggerSessionActionRequest;
    const simulationMode = body.simulationMode;

    if (simulationMode && !isAdapterSimulationMode(simulationMode)) {
      response.status(400).json({ error: 'Invalid simulationMode supplied for session action.' });
      return;
    }

    const options = {
      simulationMode: simulationMode as AdapterSimulationMode | undefined,
    };

    const operationMap: Record<SessionActionKey, () => Promise<AdapterOperationResult<unknown>>> = {
      pid: () => adapter.requestPid(session, options),
      poa: () => adapter.requestPoa(session, options),
      eucc: () => adapter.requestEucc(session, options),
      review: () => adapter.assembleReview(session, options),
      vatIssuance: () => adapter.submitVatIssuance(session, options),
      issuanceStatus: () => adapter.readIssuanceStatus(session, options),
    };

    const result = await executeVendorOperation(
      operationMap[actionKey],
      {
        sessionId: session.sessionId,
        vendorId: session.vendorId,
        operationName: actionKey,
      },
      executionConfig,
      logger,
    );

    let nextSession = applyActionResult(session, actionKey, result);
    const walletCredential = getWalletCredentialFromActionResult(actionKey, result);

    if (walletCredential) {
      nextSession = upsertWalletCredential(nextSession, 'company', walletCredential);
    }

    sessions.set(nextSession.sessionId, nextSession);
    response.json(nextSession);
  });

  return app;
}