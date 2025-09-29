import AppHeader from '../AppHeader';

export default function AppHeaderExample() {
  const handleMenuClick = () => {
    console.log('Menu clicked');
  };

  return (
    <div className="w-full">
      <AppHeader onMenuClick={handleMenuClick} lowStockCount={3} />
    </div>
  );
}