import { auth } from '@/lib/firebase';

interface SignatureResponse {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
}

/**
 * Compresses an image to WebP format using an off-screen canvas.
 * Max dimension: 1024px. Quality: 0.8
 */
export async function compressImageToWebP(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Calculate new dimensions (max 1024)
        const MAX_SIZE = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height *= MAX_SIZE / width));
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width *= MAX_SIZE / height));
            height = MAX_SIZE;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas to Blob failed'));
            }
          },
          'image/webp',
          0.8
        );
      };
      img.onerror = () => reject(new Error('Image load error'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a file directly to Cloudinary using a signed request from our Netlify Function.
 */
export async function uploadToCloudinary(fileOrBlob: File | Blob, folder = 'e-gatepass'): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Must be authenticated to upload images');
  }

  const token = await user.getIdToken();

  // 1. Get signature from our secure backend
  const signRes = await fetch('/api/cloudinary-sign', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ folder }),
  });

  if (!signRes.ok) {
    const errorText = await signRes.text().catch(() => 'No response body');
    console.error('Cloudinary sign failed. Status:', signRes.status, 'Response:', errorText);
    throw new Error('Failed to get upload signature: ' + errorText);
  }

  const { timestamp, signature, apiKey, cloudName }: SignatureResponse = await signRes.json();

  // 2. Upload directly to Cloudinary
  const formData = new FormData();
  formData.append('file', fileOrBlob);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp.toString());
  formData.append('signature', signature);
  formData.append('folder', folder);

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!uploadRes.ok) {
    const errorData = await uploadRes.json().catch(() => null);
    console.error('Cloudinary upload error:', errorData);
    throw new Error('Failed to upload image to Cloudinary');
  }

  const data = await uploadRes.json();
  return data.public_id; // Return the public_id to store in Firestore
}
