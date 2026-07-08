import PaymentDialog from './PaymentDialog';

interface PaymentScreenProps {
  onClose: () => void;
  grandTotal: number;
  roundedTotal: number;
  invoice: string;
  customer: string;
  posProfile: string;
  table: string | null;
  cashier: string;
  owner: string;
  fetchOrders?: () => Promise<void>;
  clearSelectedOrder: () => void;
}

const PaymentScreen = (props: PaymentScreenProps) => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex-1 overflow-hidden">
        <PaymentDialog
          {...props}
          fullscreen
          fetchOrders={props.fetchOrders ?? (async () => {})}
        />
      </div>
    </div>
  );
};

export default PaymentScreen;
