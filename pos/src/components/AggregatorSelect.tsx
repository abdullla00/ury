import { useEffect, useState } from 'react';
import { usePOSStore } from '../store/pos-store';
import { Select, SelectItem } from './ui/select';
import { getAggregators, type Aggregator } from '../lib/aggregator-api';
import { t } from '../i18n';
import { Truck } from 'lucide-react';

interface AggregatorSelectProps {
  disabled?: boolean;
}

export function AggregatorSelect({ disabled }: AggregatorSelectProps) {
  const { selectedAggregator, setSelectedAggregator, fetchAggregatorMenu } = usePOSStore();
  const [aggregators, setAggregators] = useState<Aggregator[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchAggregatorsList = async () => {
      setLoading(true);
      try {
        const data = await getAggregators();
        setAggregators(data);
      } catch (error) {
        console.error('Failed to fetch aggregators:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchAggregatorsList();
  }, []);

  const handleAggregatorChange = async (value: string) => {
    const aggregator = aggregators.find((a) => a.customer === value);
    setSelectedAggregator(aggregator || null);

    if (aggregator) {
      await fetchAggregatorMenu(aggregator.customer);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <Truck className="h-4 w-4 text-primary" />
        {t('aggregator.title')}
      </div>
      <Select
        value={selectedAggregator?.customer || ''}
        onValueChange={(value) => void handleAggregatorChange(value)}
        disabled={disabled || loading}
        placeholder={loading ? t('aggregator.loading') : t('aggregator.select_placeholder')}
      >
        {aggregators.map((aggregator) => (
          <SelectItem key={aggregator.customer} value={aggregator.customer} className="capitalize">
            {aggregator.customer}
          </SelectItem>
        ))}
      </Select>
      {selectedAggregator && (
        <p className="text-xs text-gray-500">{t('aggregator.menu_loaded')}</p>
      )}
    </div>
  );
}
