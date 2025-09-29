import HospitalManager from '../HospitalManager';

export default function HospitalManagerExample() {
  const handleAddHospital = (hospital: any) => {
    console.log('Adding hospital:', hospital);
  };

  const handleEditHospital = (id: string, hospital: any) => {
    console.log('Editing hospital:', id, hospital);
  };

  return (
    <div className="p-4">
      <HospitalManager 
        onAddHospital={handleAddHospital}
        onEditHospital={handleEditHospital}
      />
    </div>
  );
}