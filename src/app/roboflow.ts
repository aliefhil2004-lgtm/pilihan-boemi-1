export async function analyzeEmergencyImage(imageBase64: string, reportText = '') {
  const cleanBase64 = imageBase64.includes(',')
    ? imageBase64.split(',')[1]
    : imageBase64;

  const response = await fetch(
    '/api/roboflow',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {
          image: {
            type: 'base64',
            value: cleanBase64,
          },
          report_text: reportText,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Roboflow request failed with status ${response.status}`);
  }

  return await response.json();
}
