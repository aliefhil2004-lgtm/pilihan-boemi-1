import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '../server/firebaseAdmin';

type ServiceType = 'ambulance' | 'fire' | 'police';
type ReportStatus = 'pending' | 'responding' | 'arrived' | 'resolved';

interface VercelRequest {
  method?: string;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

const services: ServiceType[] = ['ambulance', 'fire', 'police'];
const statuses: ReportStatus[] = ['pending', 'responding', 'arrived', 'resolved'];
const allowedTransitions: Record<ReportStatus, ReportStatus[]> = {
  pending: ['responding'],
  responding: ['arrived'],
  arrived: ['resolved'],
  resolved: []
};

function parseBody(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') return JSON.parse(value);
  if (value && typeof value === 'object') return value as Record<string, unknown>;
  return {};
}

function sanitizeReport(report: Record<string, unknown>) {
  if (typeof report.id !== 'string' || !report.id) throw new Error('Report id is required');
  if (typeof report.location !== 'string' || !report.location) throw new Error('Location is required');
  if (typeof report.injuryScale !== 'number' || report.injuryScale < 1 || report.injuryScale > 10) {
    throw new Error('Injury scale must be between 1 and 10');
  }
  if (!Array.isArray(report.services) || !report.services.every(service => services.includes(service))) {
    throw new Error('At least one valid emergency service is required');
  }
  return JSON.parse(JSON.stringify(report));
}

function createAudit(service: ServiceType, action: string, label: string) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    service,
    action,
    label,
    timestamp: new Date().toISOString()
  };
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Content-Type', 'application/json');

  try {
    const db = getAdminFirestore();

    if (request.method === 'GET') {
      const id = String(request.query?.id ?? '');
      if (id) {
        const snapshot = await db.collection('reports').doc(id).get();
        response.status(snapshot.exists ? 200 : 404).json(snapshot.exists ? snapshot.data() : { error: 'Report not found' });
        return;
      }
      const snapshot = await db.collection('reports').orderBy('timestamp', 'desc').limit(100).get();
      response.status(200).json({ reports: snapshot.docs.map(item => item.data()) });
      return;
    }

    if (request.method === 'POST') {
      const body = parseBody(request.body);
      const report = sanitizeReport((body.report ?? body) as Record<string, unknown>);
      await db.collection('reports').doc(report.id).set({
        ...report,
        serverUpdatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      response.status(201).json({ ok: true, report });
      return;
    }

    if (request.method === 'PATCH') {
      const body = parseBody(request.body);
      const reportId = String(body.reportId ?? '');
      const service = body.service as ServiceType;
      const status = body.status as ReportStatus;
      if (!reportId || !services.includes(service) || !statuses.includes(status)) {
        response.status(400).json({ error: 'Valid reportId, service, and status are required' });
        return;
      }

      const reportRef = db.collection('reports').doc(reportId);
      const result = await db.runTransaction(async transaction => {
        const snapshot = await transaction.get(reportRef);
        if (!snapshot.exists) throw new Error('Report not found');
        const report = snapshot.data() as Record<string, any>;
        const currentStatus = (report.serviceStatuses?.[service] ?? report.status ?? 'pending') as ReportStatus;
        if (currentStatus !== status && !allowedTransitions[currentStatus].includes(status)) {
          throw new Error(`Invalid status transition: ${currentStatus} to ${status}`);
        }
        const assignment = body.assignment && typeof body.assignment === 'object' ? body.assignment : undefined;
        const label =
          status === 'responding' ? `${assignment?.unit ?? service} dispatched` :
          status === 'arrived' ? `${assignment?.unit ?? service} arrived on scene` :
          `${service} response resolved`;
        const audit = createAudit(
          service,
          status === 'responding' ? 'unit_dispatched' : status === 'arrived' ? 'unit_arrived' : 'report_resolved',
          label
        );
        const serviceStatuses = { ...(report.serviceStatuses ?? {}), [service]: status };
        const values = Object.values(serviceStatuses) as ReportStatus[];
        const overallStatus =
          values.every(value => value === 'resolved') ? 'resolved' :
          values.some(value => value === 'arrived') && values.every(value => ['arrived', 'resolved'].includes(value)) ? 'arrived' :
          values.some(value => ['responding', 'arrived', 'resolved'].includes(value)) ? 'responding' :
          'pending';
        const update = {
          serviceStatuses,
          status: overallStatus,
          assignedUnits: assignment
            ? { ...(report.assignedUnits ?? {}), [service]: assignment }
            : report.assignedUnits ?? {},
          auditTrail: [...(report.auditTrail ?? []), audit],
          serverUpdatedAt: FieldValue.serverTimestamp()
        };
        transaction.set(reportRef, update, { merge: true });
        return update;
      });
      response.status(200).json({ ok: true, update: result });
      return;
    }

    if (request.method === 'DELETE') {
      const body = parseBody(request.body);
      const reportIds = Array.isArray(body.reportIds) ? body.reportIds.filter(id => typeof id === 'string') : [];
      if (!reportIds.length) {
        response.status(400).json({ error: 'reportIds are required' });
        return;
      }
      await Promise.all(reportIds.map(id => db.collection('reports').doc(id).delete()));
      response.status(200).json({ ok: true });
      return;
    }

    response.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Incident API failed';
    response.status(message === 'Report not found' ? 404 : 500).json({ error: message });
  }
}
