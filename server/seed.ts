import { db } from "./db";
import { products, inventory, hospitals } from "@shared/schema";

async function seed() {
  console.log("Seeding database...");

  // Sample products
  const sampleProducts = [
    {
      modelNumber: "XT1234",
      name: "Medtronic Azure Pacemaker",
      category: "Device",
      manufacturer: "Medtronic",
      description: "Advanced dual-chamber pacemaker",
      barcode: "123456789012",
    },
    {
      modelNumber: "BS5678",
      name: "Boston Scientific ICD Lead",
      category: "Lead/Electrode",
      manufacturer: "Boston Scientific",
      description: "High-performance ICD lead",
      barcode: "987654321098",
    },
    {
      modelNumber: "AB9012",
      name: "Abbott CRT Device",
      category: "Device",
      manufacturer: "Abbott",
      description: "Cardiac resynchronization therapy device",
      barcode: "456789012345",
    },
    {
      modelNumber: "SG001",
      name: "Surgical Gloves (Size M)",
      category: "Material",
      manufacturer: "Medical Supplies Inc",
      description: "Sterile surgical gloves",
      barcode: "111222333444",
    },
    {
      modelNumber: "AB5555",
      name: "Abbott Endotak Lead",
      category: "Lead/Electrode",
      manufacturer: "Abbott",
      description: "Transvenous defibrillation lead",
      barcode: "555666777888",
    },
  ];

  // Insert products
  for (const product of sampleProducts) {
    const [insertedProduct] = await db.insert(products).values(product).returning();
    
    // Add inventory for home location
    await db.insert(inventory).values({
      productId: insertedProduct.id,
      location: "home",
      quantity: Math.floor(Math.random() * 15) + 5,
      minStockLevel: 3,
    });

    // Add inventory for car location (lower quantities)
    await db.insert(inventory).values({
      productId: insertedProduct.id,
      location: "car",
      quantity: Math.floor(Math.random() * 5) + 1,
      minStockLevel: 2,
    });
  }

  // Sample hospitals
  const sampleHospitals = [
    {
      name: "St. Mary's Medical Center",
      address: "123 Hospital Drive",
      city: "Springfield",
      state: "IL",
      zipCode: "62701",
      primaryPhysician: "Dr. Sarah Johnson",
      contactPhone: "(555) 123-4567",
    },
    {
      name: "Regional Heart Institute",
      address: "456 Cardiac Way",
      city: "Madison",
      state: "WI",
      zipCode: "53703",
      primaryPhysician: "Dr. Michael Chen",
      contactPhone: "(555) 987-6543",
    },
    {
      name: "Community General Hospital",
      address: "789 Health Boulevard",
      city: "Milwaukee",
      state: "WI",
      zipCode: "53202",
      primaryPhysician: "Dr. Emily Rodriguez",
      contactPhone: "(555) 456-7890",
    },
  ];

  for (const hospital of sampleHospitals) {
    await db.insert(hospitals).values(hospital);
  }

  console.log("Database seeded successfully!");
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error seeding database:", error);
    process.exit(1);
  });
