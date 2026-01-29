
import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';

interface TagManagerProps {
  tags: string[];
  currentTag: string;
  setCurrentTag: (tag: string) => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
}

const TagManager: React.FC<TagManagerProps> = ({
  tags,
  currentTag,
  setCurrentTag,
  onAddTag,
  onRemoveTag
}) => {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onAddTag();
    }
  };

  return (
    <div className="space-y-2">
      <Label>Tags</Label>
      <div className="flex gap-2 mb-2">
        <Input
          value={currentTag}
          onChange={(e) => setCurrentTag(e.target.value)}
          placeholder="Add a tag"
          onKeyPress={handleKeyPress}
        />
        <Button type="button" onClick={onAddTag} variant="outline">
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="flex items-center gap-1">
            {tag}
            <X
              className="w-3 h-3 cursor-pointer"
              onClick={() => onRemoveTag(tag)}
            />
          </Badge>
        ))}
      </div>
    </div>
  );
};

export default TagManager;
