import { handleUpload } from '@vercel/blob/client';

// Lets the browser upload the video straight to Vercel Blob storage (bypasses the 4.5 MB function limit).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const json = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const pw = process.env.ADMIN_PASSWORD;
        if (!pw || clientPayload !== pw) throw new Error('Wrong password');
        return {
          allowedContentTypes: ['video/mp4', 'video/quicktime'],
          maximumSizeInBytes: 1024 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });
    res.status(200).json(json);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}
