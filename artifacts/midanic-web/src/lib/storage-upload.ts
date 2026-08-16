function getToken(): string {
  return localStorage.getItem('accessToken') ?? '';
}

/** Upload a file to the configured object storage and return its public API URL. */
export async function uploadFileToStorage(file: File): Promise<string> {
  const contentType = file.type || 'application/octet-stream';
  const metaRes = await fetch('/api/storage/uploads/request-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      contentType,
    }),
  });
  if (!metaRes.ok) {
    const error = await metaRes.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to get upload URL');
  }

  const { uploadURL, objectPath } = await metaRes.json() as {
    uploadURL: string;
    objectPath: string;
  };
  const uploadRes = await fetch(uploadURL, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': contentType },
  });
  if (!uploadRes.ok) throw new Error('Failed to upload file to storage');

  const confirmRes = await fetch('/api/storage/uploads/confirm-public', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ objectPath }),
  });
  if (!confirmRes.ok) {
    const error = await confirmRes.json().catch(() => ({})) as { error?: string };
    throw new Error(error.error || 'Failed to publish uploaded file');
  }

  return `/api/storage${objectPath}`;
}