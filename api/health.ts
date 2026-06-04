interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
}

export default function handler(_: unknown, response: VercelResponse) {
  response.status(200).json({
    ok: true,
    service: 'EmergencyConnect API',
    firebaseAdminConfigured: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
    timestamp: new Date().toISOString()
  });
}
