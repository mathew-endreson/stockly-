import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { salesAPI } from '@/services/api';
import type { Product } from '@/types';

interface StockTransferDialogProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const StockTransferDialog: React.FC<StockTransferDialogProps> = ({
  product,
  open,
  onClose,
  onSuccess
}) => {
  const { t } = useTranslation();
  const { accessibleStocks, currentStockId } = useAuth();

  const [destinationStockId, setDestinationStockId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const ownedBranchStocks = (accessibleStocks || []).filter(
    (s) => s.isOwnedStock && s.stockId !== currentStockId
  );

  const handleClose = () => {
    if (isTransferring) return;
    setDestinationStockId('');
    setQuantity('');
    setError(null);
    setSuccess(null);
    onClose();
  };

  const handleTransfer = async () => {
    if (!product || !destinationStockId || !quantity) return;
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) {
      setError(t('transfer.invalidQuantity', 'Please enter a valid quantity.'));
      return;
    }
    if (qty > product.quantity) {
      setError(
        t('transfer.exceedsStock', 'Transfer quantity exceeds available stock ({{available}}).', {
          available: product.quantity
        })
      );
      return;
    }
    setError(null);
    setIsTransferring(true);
    try {
      await salesAPI.transferStock({
        destinationStockId,
        items: [{ productId: product._id, quantity: qty }]
      });
      const destStock = ownedBranchStocks.find((s) => s.stockId === destinationStockId);
      setSuccess(
        t('transfer.success', 'Transferred {{qty}} x "{{product}}" to {{stock}}.', {
          qty,
          product: product.name,
          stock: destStock?.stockName ?? destinationStockId
        })
      );
      if (onSuccess) onSuccess();
    } catch (err) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      setError(apiErr?.response?.data?.message ?? t('transfer.failed', 'Transfer failed. Please try again.'));
    } finally {
      setIsTransferring(false);
    }
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="w-5 h-5 text-blue-500" />
            {t('transfer.title', 'Transfer to Stock')}
          </DialogTitle>
          <DialogDescription>
            {t('transfer.desc', 'Move inventory from this stock to another branch.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border bg-muted/40 px-3 py-2">
            <p className="text-xs text-muted-foreground">{t('transfer.product', 'Product')}</p>
            <p className="font-medium">{product.name}</p>
            <p className="text-xs text-muted-foreground">
              {t('transfer.available', 'Available')}: {product.quantity}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>{t('transfer.destination', 'Destination stock')}</Label>
            {ownedBranchStocks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('transfer.noBranches', 'No other branch stocks available. Create a branch first.')}
              </p>
            ) : (
              <Select
                value={destinationStockId}
                onValueChange={(v) => {
                  setDestinationStockId(v);
                  setError(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('transfer.selectDestination', 'Select destination')} />
                </SelectTrigger>
                <SelectContent>
                  {ownedBranchStocks.map((s) => (
                    <SelectItem key={s.stockId} value={s.stockId}>
                      {s.stockName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>{t('transfer.quantity', 'Quantity to transfer')}</Label>
            <Input
              type="number"
              min={0.0001}
              max={product.quantity}
              step="any"
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value);
                setError(null);
              }}
              placeholder={`Max: ${product.quantity}`}
            />
          </div>

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {success && (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {success}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isTransferring}>
            {success ? t('common.close', 'Close') : t('common.cancel', 'Cancel')}
          </Button>
          {!success && (
            <Button
              onClick={() => void handleTransfer()}
              disabled={isTransferring || !destinationStockId || !quantity || ownedBranchStocks.length === 0}
            >
              {isTransferring
                ? t('transfer.transferring', 'Transferring...')
                : t('transfer.confirm', 'Transfer')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StockTransferDialog;
