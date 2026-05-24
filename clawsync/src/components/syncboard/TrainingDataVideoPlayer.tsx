import { useEffect, useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { base64ToVideoObjectUrl } from '../../lib/trainingVideo';

type Props = {
  purchasedId: Id<'purchasedTrainingData'>;
  skillName: string;
  videoMime?: string;
};

export function TrainingDataVideoPlayer({ purchasedId, skillName, videoMime = 'video/webm' }: Props) {
  const getVideo = useAction(api.trainingDataPurchaseActions.getPurchasedVideo);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let objectUrl: string | null = null;
    void getVideo({ id: purchasedId })
      .then((res) => {
        if (!res.found || !res.base64) {
          setError('Video file not found in purchased bundle.');
          return;
        }
        objectUrl = base64ToVideoObjectUrl(res.base64, res.videoMime ?? videoMime);
        setSrc(objectUrl);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [getVideo, purchasedId, videoMime]);

  if (error) {
    return <p className="purchase-error">{error}</p>;
  }
  if (!src) {
    return <p className="purchase-hint">Loading video for {skillName}…</p>;
  }
  return (
    <video
      className="training-data-video-player"
      controls
      playsInline
      src={src}
      style={{ width: '100%', maxHeight: '480px', borderRadius: '8px' }}
    />
  );
}
