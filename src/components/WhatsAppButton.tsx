import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle,
  Send,
  Check,
  Phone,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { whatsappAPI } from '@/services/api';
import type { Sale } from '@/types';

interface WhatsAppButtonProps {
  sale: Sale;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'icon';
  className?: string;
}

const WhatsAppButton: React.FC<WhatsAppButtonProps> = ({
  sale,
  variant = 'outline',
  size = 'sm',
  className = '',
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('order_shipped');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const templates = [
    {
      id: 'order_shipped',
      name: t('whatsapp.orderShipped', 'Order Shipped'),
      content: t(
        'whatsapp.orderShippedTemplate',
        'Your order #{{orderNumber}} has been shipped! 🚚\n\nTrack your package: {{tracking}}\n\nThank you for shopping with us!'
      ),
    },
    {
      id: 'order_confirmed',
      name: t('whatsapp.orderConfirmed', 'Order Confirmed'),
      content: t(
        'whatsapp.orderConfirmedTemplate',
        'Hi {{customerName}}, your order #{{orderNumber}} has been confirmed! ✅\n\nTotal: {{total}}\n\nWe will notify you when it ships.'
      ),
    },
    {
      'id': 'order_delivered',
      name: t('whatsapp.orderDelivered', 'Order Delivered'),
      content: t(
        'whatsapp.orderDeliveredTemplate',
        'Great news! Your order #{{orderNumber}} has been delivered! 📦\n\nWe hope you love your purchase. Please leave a review!'
      ),
    },
    {
      id: 'payment_received',
      name: t('whatsapp.paymentReceived', 'Payment Received'),
      content: t(
        'whatsapp.paymentReceivedTemplate',
        'Thank you! Payment of {{total}} for order #{{orderNumber}} has been received. ✅\n\nYour order is being processed.'
      ),
    },
  ];

  const getFormattedMessage = () => {
    const template = templates.find((t) => t.id === selectedTemplate);
    if (!template) return '';

    return template.content
      .replace('{{orderNumber}}', sale.orderNumber)
      .replace('{{customerName}}', sale.customer.name)
      .replace('{{total}}', `$${sale.total.toFixed(2)}`)
      .replace('{{tracking}}', sale.shipping?.trackingNumber || 'N/A');
  };

  const handleSend = async () => {
    if (!sale.customer.whatsapp && !sale.customer.phone) {
      return;
    }

    setSending(true);
    try {
      await whatsappAPI.sendOrderUpdate(sale._id, selectedTemplate);
      setSent(true);
      setTimeout(() => {
        setIsOpen(false);
        setSent(false);
      }, 2000);
    } catch (error) {
      console.error('Error sending WhatsApp:', error);
    } finally {
      setSending(false);
    }
  };

  const hasContact = sale.customer.whatsapp || sale.customer.phone;

  if (!hasContact) {
    return (
      <Button
        variant="ghost"
        size={size}
        disabled
        className={`opacity-50 ${className}`}
        title={t('whatsapp.noContact', 'No contact number available')}
      >
        <MessageCircle className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsOpen(true)}
        className={`${className} ${sale.whatsappSent ? 'text-green-600' : ''}`}
      >
        <MessageCircle className="w-4 h-4 mr-2" />
        {sale.whatsappSent
          ? t('whatsapp.sent', 'Sent')
          : t('whatsapp.sendUpdate', 'WhatsApp')}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-500" />
              {t('whatsapp.sendUpdate', 'Send WhatsApp Update')}
            </DialogTitle>
            <DialogDescription>
              {t('whatsapp.selectTemplate', 'Select a message template to send')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Customer Info */}
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <Phone className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="font-medium text-sm">{sale.customer.name}</p>
                <p className="text-sm text-muted-foreground">
                  {sale.customer.whatsapp || sale.customer.phone}
                </p>
              </div>
            </div>

            {/* Template Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                {t('whatsapp.template', 'Message Template')}
              </label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preview */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                {t('whatsapp.preview', 'Preview')}
              </label>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                <p className="text-sm whitespace-pre-line">{getFormattedMessage()}</p>
              </div>
            </div>

            {/* Send Button */}
            <Button
              onClick={handleSend}
              disabled={sending || sent}
              className="w-full bg-green-500 hover:bg-green-600"
            >
              <AnimatePresence mode="wait">
                {sending ? (
                  <motion.div
                    key="sending"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center"
                  >
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('whatsapp.sending', 'Sending...')}
                  </motion.div>
                ) : sent ? (
                  <motion.div
                    key="sent"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    {t('whatsapp.sentSuccess', 'Sent!')}
                  </motion.div>
                ) : (
                  <motion.div
                    key="send"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {t('whatsapp.send', 'Send via WhatsApp')}
                  </motion.div>
                )}
              </AnimatePresence>
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              {t('whatsapp.whatsappWeb', 'Opens WhatsApp Web or App')}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WhatsAppButton;
