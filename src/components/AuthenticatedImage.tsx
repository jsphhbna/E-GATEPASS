import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { ImageOff } from 'lucide-react';

interface AuthenticatedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  publicId: string;
  fallbackText?: string;
}

export function AuthenticatedImage({ publicId, fallbackText = 'Image unavailable', className = '', ...props }: AuthenticatedImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let url: string | null = null;

    async function fetchImage() {
      try {
        setLoading(true);
        setError(false);
        
        const user = auth.currentUser;
        if (!user) {
          throw new Error('User not authenticated');
        }

        const token = await user.getIdToken();
        const response = await fetch(`/api/image?publicId=${encodeURIComponent(publicId)}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }

        const blob = await response.blob();
        
        if (active) {
          url = URL.createObjectURL(blob);
          setObjectUrl(url);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load authenticated image:', err);
        if (active) {
          setError(true);
          setLoading(false);
        }
      }
    }

    if (publicId) {
      fetchImage();
    } else {
      setLoading(false);
      setError(true);
    }

    return () => {
      active = false;
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [publicId]);

  if (loading) {
    return (
      <div 
        className={`flex items-center justify-center animate-pulse ${className}`}
        style={{ backgroundColor: 'var(--color-overlay)' }}
        role="img"
        aria-label="Loading image..."
      />
    );
  }

  if (error || !objectUrl) {
    return (
      <div 
        className={`flex flex-col items-center justify-center text-center p-4 ${className}`}
        style={{ 
          backgroundColor: 'var(--color-overlay)',
          color: 'var(--color-text-muted)',
          border: '1px dashed var(--color-border-strong)',
          borderRadius: 'var(--radius-sm)'
        }}
      >
        <ImageOff className="h-6 w-6 mb-2" />
        <span className="text-xs font-medium">{fallbackText}</span>
      </div>
    );
  }

  return (
    <img 
      src={objectUrl} 
      className={className}
      {...props} 
    />
  );
}
