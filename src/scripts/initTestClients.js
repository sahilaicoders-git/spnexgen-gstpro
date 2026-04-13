const { getCurrentFinancialYearLabel } = require('../services/clientDataService');

const TEST_CLIENTS = [
  { clientName: 'ABC Traders', gstin: '27ABCDE1234F1Z5' },
  { clientName: 'Shree Ganesh Enterprises', gstin: '27AABCG1234M1Z9' },
  { clientName: 'Om Sai Distributors', gstin: '27AAACS5678K1Z2' },
  { clientName: 'Mahalakshmi Sales', gstin: '27AADCM4321L1Z7' },
  { clientName: 'Ramesh & Co', gstin: '27AAAFR6789P1Z3' },
  { clientName: 'Sai Krupa Agency', gstin: '27AAKFS2345Q1Z8' },
  { clientName: 'Balaji Wholesalers', gstin: '27AAGFB9876H1Z4' },
  { clientName: 'Krishna Traders', gstin: '27AATPK1122D1Z6' },
  { clientName: 'Vinayak Enterprises', gstin: '27AAHFV5566N1Z1' },
  { clientName: 'Durga Suppliers', gstin: '27AABFD3344C1Z0' }
];

function initTestClients(clientService) {
  clientService.ensureClientsRoot();

  const existing = clientService.getClients();
  if (existing.length > 0) {
    return { created: 0, skipped: existing.length };
  }

  const financialYear = getCurrentFinancialYearLabel();
  let created = 0;

  TEST_CLIENTS.forEach((client) => {
    if (!clientService.findFolderByGstin(client.gstin)) {
      clientService.createClientStructure({
        clientName: client.clientName,
        gstin: client.gstin,
        clientType: 'Regular',
        status: 'Active',
        financialYear
      });
      created += 1;
    }
  });

  return { created, skipped: TEST_CLIENTS.length - created };
}

module.exports = {
  initTestClients,
  TEST_CLIENTS
};
