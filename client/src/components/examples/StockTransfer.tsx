import StockTransfer from '../StockTransfer';

export default function StockTransferExample() {
  const handleTransfer = (transfer: any) => {
    console.log('Stock transfer completed:', transfer);
  };

  const handleCancel = () => {
    console.log('Transfer cancelled');
  };

  return (
    <div className="p-4">
      <StockTransfer 
        onTransfer={handleTransfer}
        onCancel={handleCancel}
      />
    </div>
  );
}