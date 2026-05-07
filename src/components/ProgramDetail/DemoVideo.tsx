import React from 'react';
import { Play } from 'lucide-react';
import { parseVideoEmbed } from '@/lib/videoEmbed';

interface DemoVideoProps {
  url?: string | null;
}

const DemoVideo: React.FC<DemoVideoProps> = ({ url }) => {
  const embed = parseVideoEmbed(url);
  if (!embed) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <Play className="w-5 h-5" />
        Demo Video
      </h2>
      <div className="aspect-video w-full overflow-hidden rounded-lg border bg-muted">
        <iframe
          src={embed.embedUrl}
          title="Demo video"
          className="w-full h-full"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    </div>
  );
};

export default DemoVideo;