
import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Upload } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface ScriptUploadSectionProps {
  scriptType: 'file' | 'link';
  setScriptType: (type: 'file' | 'link') => void;
  scriptFile: File | null;
  setScriptFile: (file: File | null) => void;
  tradingViewUrl: string;
  onUrlChange: (url: string) => void;
}

const ScriptUploadSection: React.FC<ScriptUploadSectionProps> = ({
  scriptType,
  setScriptType,
  scriptFile,
  setScriptFile,
  tradingViewUrl,
  onUrlChange
}) => {
  const { toast } = useToast();

  const handleScriptFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.txt')) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload a .txt file containing your Pine Script.',
          variant: 'destructive',
        });
        return;
      }
      setScriptFile(file);
    }
  };

  return (
    <div className="space-y-4">
      <Label>Pine Script *</Label>
      <RadioGroup value={scriptType} onValueChange={(value: 'file' | 'link') => setScriptType(value)}>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="link" id="link" />
          <Label htmlFor="link">TradingView publication link</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="file" id="file" />
          <Label htmlFor="file">Upload .txt file</Label>
        </div>
      </RadioGroup>

      {scriptType === 'link' ? (
        <div className="space-y-2">
          <Input
            value={tradingViewUrl}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://www.tradingview.com/script/..."
          />
          <p className="text-sm text-muted-foreground">
            Provide a link to your published Pine Script on TradingView
          </p>
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
          <div className="text-center">
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <div className="mt-4">
              <Label htmlFor="script" className="cursor-pointer">
                <span className="mt-2 block text-sm font-medium text-gray-900">
                  {scriptFile ? scriptFile.name : 'Upload your .txt file containing Pine Script'}
                </span>
              </Label>
              <Input
                id="script"
                type="file"
                accept=".txt"
                onChange={handleScriptFileChange}
                className="hidden"
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              .txt files are delivered as downloadable files to buyers after purchase
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScriptUploadSection;
