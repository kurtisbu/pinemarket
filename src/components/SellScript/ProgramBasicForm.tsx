
import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface ProgramBasicFormProps {
  formData: {
    title: string;
    description: string;
    price: string;
    category: string;
    trial_period_days: number;
    offer_trial: boolean;
    pricing_model: string;
  };
  onInputChange: (field: string, value: string | number | boolean) => void;
  categories: string[];
}

const ProgramBasicForm: React.FC<ProgramBasicFormProps> = ({
  formData,
  onInputChange,
  categories
}) => {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="title">Program Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => onInputChange('title', e.target.value)}
            placeholder="Enter program title"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category *</Label>
          <Select onValueChange={(value) => onInputChange('category', value)} required>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Pricing Model *</Label>
        <RadioGroup
          value={formData.pricing_model}
          onValueChange={(value) => onInputChange('pricing_model', value)}
          className="flex flex-col space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="one_time" id="one_time" />
            <Label htmlFor="one_time">One-time Purchase</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="subscription" id="subscription" />
            <Label htmlFor="subscription">Subscription</Label>
          </div>
        </RadioGroup>
      </div>

      {formData.pricing_model === 'one_time' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="price">Price (USD) *</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={formData.price}
              onChange={(e) => onInputChange('price', e.target.value)}
              placeholder="Enter one-time price in USD"
              required
            />
            <p className="text-sm text-muted-foreground">
              One-time payment for lifetime access to your Pine Script
            </p>
          </div>

          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="offer-trial"
                checked={formData.offer_trial}
                onCheckedChange={(checked) => onInputChange('offer_trial', checked)}
              />
              <Label htmlFor="offer-trial" className="text-sm font-medium">
                Offer Free Trial
              </Label>
            </div>
            
            {formData.offer_trial && (
              <div className="space-y-2">
                <Label htmlFor="trial_period_days">Trial Period (Days) *</Label>
                <Input
                  id="trial_period_days"
                  type="number"
                  min="1"
                  max="30"
                  value={formData.trial_period_days}
                  onChange={(e) => onInputChange('trial_period_days', parseInt(e.target.value) || 7)}
                  placeholder="7"
                  required={formData.offer_trial}
                />
                <p className="text-sm text-muted-foreground">
                  Users can try your script for free for this many days before purchasing
                </p>
              </div>
            )}
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor="description">Description *</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => onInputChange('description', e.target.value)}
          placeholder="Describe your Pine Script program, its features, and usage instructions..."
          rows={6}
          required
        />
      </div>
    </>
  );
};

export default ProgramBasicForm;
