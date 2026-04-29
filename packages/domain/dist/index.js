export const vendorCatalog = [
    {
        id: 'mock-local',
        label: 'Local Mock Vendor',
        description: 'Local mock flow that keeps all steps self-contained on localhost.',
        badge: 'Local demo',
        walletInteraction: {
            personal: 'local-mock-wallet',
            company: 'local-mock-wallet',
        },
        capabilities: {
            mockWalletSeeding: true,
            personalWalletPid: true,
            personalWalletPoa: true,
            companyWalletEucc: true,
            reviewAssembly: true,
            vatIssuance: true,
            issuanceTracking: true,
        },
    },
    {
        id: 'igrant-sandbox',
        label: 'iGrant Sandbox Shape',
        description: 'Preview profile for a future adapter-backed vendor integration.',
        badge: 'Adapter-ready',
        walletInteraction: {
            personal: 'external-wallet-app',
            company: 'external-wallet-app',
        },
        capabilities: {
            mockWalletSeeding: true,
            personalWalletPid: true,
            personalWalletPoa: true,
            companyWalletEucc: true,
            reviewAssembly: true,
            vatIssuance: true,
            issuanceTracking: true,
        },
    },
];
export const workflowStepDefinitions = [
    {
        key: 'pid',
        title: 'PID identification',
        summary: 'Request a normalized PID record from the personal wallet.',
        walletRole: 'personal',
        dependsOn: [],
    },
    {
        key: 'poa',
        title: 'PoA collection',
        summary: 'Request normalized power-of-attorney evidence from the personal wallet.',
        walletRole: 'personal',
        dependsOn: ['pid'],
    },
    {
        key: 'eucc',
        title: 'EUCC collection',
        summary: 'Request normalized organization evidence from the company wallet.',
        walletRole: 'company',
        dependsOn: ['pid'],
    },
    {
        key: 'review',
        title: 'Review payload',
        summary: 'Assemble PID, company, PoA, and EUCC into one review object.',
        walletRole: 'operator',
        dependsOn: ['poa', 'eucc'],
    },
    {
        key: 'vatIssuance',
        title: 'VAT issuance',
        summary: 'Submit the request and track the normalized issuance result.',
        walletRole: 'company',
        dependsOn: ['review'],
    },
];
export const workflowStatusLabels = {
    'not-started': 'Not started',
    ready: 'Ready',
    blocked: 'Blocked',
    pending: 'Pending',
    succeeded: 'Succeeded',
    failed: 'Failed',
};
export function createWorkflowStep(key, walletRole, status) {
    return {
        key,
        walletRole,
        status,
    };
}
export function createInitialSession(vendorId, now = new Date().toISOString()) {
    return {
        sessionId: `session-${vendorId}`,
        vendorId,
        lifecycle: 'draft',
        createdAt: now,
        updatedAt: now,
        wallets: {
            personal: {
                walletRole: 'personal',
                loadedCredentials: [],
            },
            company: {
                walletRole: 'company',
                loadedCredentials: [],
            },
        },
        pid: createWorkflowStep('pid', 'personal', 'ready'),
        poa: createWorkflowStep('poa', 'personal', 'blocked'),
        eucc: createWorkflowStep('eucc', 'company', 'blocked'),
        review: createWorkflowStep('review', 'operator', 'blocked'),
        vatIssuance: createWorkflowStep('vatIssuance', 'company', 'blocked'),
        eventLog: [
            {
                step: 'pid',
                status: 'ready',
                timestamp: now,
                message: 'Session created and ready for PID collection.',
            },
        ],
    };
}
export function isSeedableWalletRole(value) {
    return value === 'personal' || value === 'company';
}
export function isWalletCredentialType(value) {
    return value === 'pid' || value === 'poa' || value === 'eucc' || value === 'vat';
}
function getWalletCredentialStep(credentialType) {
    if (credentialType === 'vat') {
        return 'vatIssuance';
    }
    return credentialType;
}
export function isAdapterSimulationMode(value) {
    return value === 'success' || value === 'failure' || value === 'pending';
}
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
export function upsertWalletCredential(session, walletRole, credential) {
    const existingCredentials = session.wallets[walletRole].loadedCredentials.filter((item) => item.credentialType !== credential.credentialType);
    return {
        ...session,
        updatedAt: credential.seededAt,
        wallets: {
            ...session.wallets,
            [walletRole]: {
                ...session.wallets[walletRole],
                loadedCredentials: [...existingCredentials, credential],
            },
        },
        eventLog: [
            ...session.eventLog,
            {
                step: getWalletCredentialStep(credential.credentialType),
                status: 'ready',
                timestamp: credential.seededAt,
                message: `Seeded ${credential.label} into the ${walletRole} wallet.`,
            },
        ],
    };
}
export function isVendorId(value) {
    return vendorCatalog.some((vendor) => vendor.id === value);
}
export function isWorkflowStepKey(value) {
    return workflowStepDefinitions.some((definition) => definition.key === value);
}
function areStepDependenciesSatisfied(session, stepKey) {
    const definition = workflowStepDefinitions.find((item) => item.key === stepKey);
    if (!definition) {
        return false;
    }
    return definition.dependsOn.every((dependencyKey) => session[dependencyKey].status === 'succeeded');
}
function reconcileDependentStatuses(session) {
    const nextSession = {
        ...session,
    };
    for (const definition of workflowStepDefinitions) {
        const stepKey = definition.key;
        const currentStep = nextSession[stepKey];
        const hasLockedState = currentStep.status === 'blocked' || currentStep.status === 'ready' || currentStep.status === 'not-started';
        if (!hasLockedState) {
            continue;
        }
        const nextStatus = areStepDependenciesSatisfied(nextSession, stepKey) ? 'ready' : definition.dependsOn.length === 0 ? 'ready' : 'blocked';
        switch (stepKey) {
            case 'pid':
                nextSession.pid = {
                    ...nextSession.pid,
                    status: nextStatus,
                };
                break;
            case 'poa':
                nextSession.poa = {
                    ...nextSession.poa,
                    status: nextStatus,
                };
                break;
            case 'eucc':
                nextSession.eucc = {
                    ...nextSession.eucc,
                    status: nextStatus,
                };
                break;
            case 'review':
                nextSession.review = {
                    ...nextSession.review,
                    status: nextStatus,
                };
                break;
            case 'vatIssuance':
                nextSession.vatIssuance = {
                    ...nextSession.vatIssuance,
                    status: nextStatus,
                };
                break;
        }
    }
    return nextSession;
}
function createCompanyContextFromEucc(euccRecord) {
    return {
        companyId: euccRecord.companyId,
        companyName: euccRecord.companyName,
        legalForm: euccRecord.legalForm,
        jurisdiction: euccRecord.registrationMemberState,
        registeredOffice: euccRecord.registeredAddress,
    };
}
export function updateSessionStep(session, mutation, now = mutation.updatedAt ?? new Date().toISOString()) {
    const nextSession = {
        ...session,
        updatedAt: now,
        [mutation.step]: {
            ...session[mutation.step],
            status: mutation.status,
            data: mutation.data,
            error: mutation.error,
            updatedAt: now,
        },
        lastError: mutation.error,
        eventLog: [
            ...session.eventLog,
            {
                step: mutation.step,
                status: mutation.status,
                timestamp: now,
                message: mutation.message ?? `Session step ${mutation.step} updated to ${mutation.status}.`,
            },
        ],
    };
    if (mutation.step === 'eucc') {
        const euccData = mutation.data;
        if (euccData?.record) {
            nextSession.companyContext = createCompanyContextFromEucc(euccData.record);
        }
    }
    const reconciledSession = reconcileDependentStatuses(nextSession);
    reconciledSession.lifecycle = deriveLifecycle(reconciledSession);
    return reconciledSession;
}
export function getWorkflowStepSnapshots(session) {
    return workflowStepDefinitions.map((definition) => {
        const step = session[definition.key];
        return {
            ...definition,
            status: step.status,
            data: step.data,
            error: step.error,
            updatedAt: step.updatedAt,
        };
    });
}
export function deriveLifecycle(session) {
    if (session.vatIssuance.status === 'failed' || session.review.status === 'failed') {
        return 'failed';
    }
    if (session.vatIssuance.status === 'succeeded') {
        return 'completed';
    }
    if (session.vatIssuance.status === 'pending') {
        return 'submitting';
    }
    if (session.review.status === 'succeeded') {
        return 'ready-for-review';
    }
    if (session.pid.status === 'succeeded' ||
        session.poa.status === 'succeeded' ||
        session.eucc.status === 'succeeded') {
        return 'in-progress';
    }
    return 'draft';
}
//# sourceMappingURL=index.js.map