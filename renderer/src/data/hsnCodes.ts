export type HsnRow = {
  code: string;
  description: string;
  rate: number;
};

export const hsnCodes: HsnRow[] = [
  { code: "1001", description: "Wheat and meslin", rate: 5 },
  { code: "1006", description: "Rice", rate: 5 },
  { code: "1701", description: "Cane or beet sugar", rate: 5 },
  { code: "1905", description: "Bread and pastry products", rate: 12 },
  { code: "2106", description: "Food preparations not elsewhere specified", rate: 18 },
  { code: "3004", description: "Medicaments", rate: 12 },
  { code: "3304", description: "Beauty or make-up preparations", rate: 18 },
  { code: "3923", description: "Articles for packing of goods, of plastics", rate: 18 },
  { code: "4819", description: "Cartons, boxes and cases of paper", rate: 12 },
  { code: "6109", description: "T-shirts, singlets and other vests", rate: 12 },
  { code: "6403", description: "Footwear with outer soles of rubber/plastic", rate: 18 },
  { code: "7214", description: "Bars and rods of iron or non-alloy steel", rate: 18 },
  { code: "7308", description: "Structures and parts of structures, of iron/steel", rate: 18 },
  { code: "8414", description: "Air or vacuum pumps, compressors", rate: 18 },
  { code: "8471", description: "Automatic data processing machines", rate: 18 },
  { code: "8483", description: "Transmission shafts, gears and gearing", rate: 18 },
  { code: "8504", description: "Electrical transformers", rate: 18 },
  { code: "8517", description: "Telephone sets and communication equipment", rate: 18 },
  { code: "9403", description: "Other furniture and parts", rate: 18 },
  { code: "9983", description: "Other professional, technical and business services", rate: 18 },
];
