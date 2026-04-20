export type ClientRecord = {
  folderName: string;
  clientName: string;
  gstin: string;
  clientType: string;
  status: string;
  financialYears: string[];
};

export type MonthPayload = {
  client_name: string;
  gstin: string;
  financial_year: string;
  month: string;
  sales: {
    b2b: SaleRecord[];
    b2c: SaleRecord[];
  };
  purchases: PurchaseRecord[];
  returns: {
    gstr1: string;
    gstr3b: string;
  };
};

export type ReturnStatusValue = "filed" | "pending" | "not-started";

export type ReturnStatusDetail = {
  status: ReturnStatusValue;
  visualStatus: ReturnStatusValue;
  history: Array<{
    filedAt: string;
    month: string;
    financialYear: string;
  }>;
  dueDate: string | null;
  dueInDays: number | null;
  overdue: boolean;
};

export type ClientMonthReturnSnapshot = {
  financialYear: string;
  month: string;
  gstr1: ReturnStatusDetail;
  gstr3b: ReturnStatusDetail;
  pendingCount: number;
  nearestDueInDays: number | null;
  hasOverdue: boolean;
};

export type ClientStatusRow = {
  folderName: string;
  clientName: string;
  gstin: string;
  clientType: string;
  status: string;
  financialYears: string[];
  current: ClientMonthReturnSnapshot;
  previous: ClientMonthReturnSnapshot | null;
};

export type ClientStatusResponse = {
  ok: boolean;
  financialYear: string;
  month: string;
  includePreviousMonth: boolean;
  rows: ClientStatusRow[];
};

export type SaleItem = {
  sr_no: number;
  description: string;
  hsn_sac: string;
  quantity: number;
  rate: number;
  taxable_value: number;
  gst_rate: number;
  igst: number;
  cgst: number;
  sgst: number;
  total_amount: number;
};

export type SaleRecord = {
  id?: string;
  invoice_no: string;
  date: string;
  buyer_gstin?: string;
  buyer_name?: string;
  place_of_supply: string;
  reverse_charge?: "Yes" | "No";
  type?: "B2C Large" | "B2C Small";
  items: SaleItem[];
  taxable_value: number;
  gst_amount: number;
  total_value: number;
};

export type CustomerRecord = {
  gstin: string;
  name: string;
  state: string;
};

export type SupplierRecord = {
  gstin: string;
  name: string;
  state: string;
};

export type MasterPartyResponse = {
  map: Record<string, { name: string; state: string }>;
  entries: Array<{
    gstin: string;
    name: string;
    state: string;
    favorite?: boolean;
    recentRank?: number;
  }>;
  favorites: string[];
  recent: string[];
};

export type PurchaseItem = {
  description: string;
  hsn_sac: string;
  quantity: number;
  rate: number;
  taxable_value: number;
  gst_rate: number;
  igst: number;
  cgst: number;
  sgst: number;
  total: number;
};

export type PurchaseRecord = {
  id?: string;
  type: "B2B";
  supplier_gstin: string;
  supplier_name: string;
  invoice_no: string;
  date: string;
  place_of_supply?: string;
  taxable_value: number;
  igst: number;
  cgst: number;
  sgst: number;
  total: number;
  source: "import" | "manual";
  items?: PurchaseItem[];
  status?: "valid" | "duplicate" | "error";
  message?: string;
};

export type Gstr1Summary = {
  totalB2BSales: number;
  totalB2CSales: number;
  totalTaxableValue: number;
  totalGst: number;
  igst: number;
  cgst: number;
  sgst: number;
};

export type Gstr1DocumentSummary = {
  totalInvoicesIssued: number;
  cancelledInvoices: number;
  netIssued: number;
};

export type Gstr1B2BRow = {
  _saleId: string;
  _itemSrNo: number;
  _warnings?: string[];
  'GSTIN/UIN of Recipient': string;
  'Receiver Name': string;
  'Invoice Number': string;
  'Invoice Date': string;
  'Invoice Value': number;
  'Place Of Supply': string;
  'Reverse Charge': 'Yes' | 'No' | string;
  'Applicable % of Tax Rate': string;
  'Invoice Type': string;
  'E-Commerce GSTIN': string;
  Rate: number;
  'Taxable Value': number;
  'Cess Amount': number;
  IGST: number;
  CGST: number;
  SGST: number;
};

export type Gstr1B2CLRow = {
  _saleId?: string;
  'Invoice Number': string;
  'Invoice Date': string;
  'Invoice Value': number;
  'Place Of Supply': string;
  'Applicable %': string;
  Rate: number;
  'Taxable Value': number;
  Cess: number;
  IGST: number;
  CGST: number;
  SGST: number;
};

export type Gstr1B2CSRow = {
  Type: string;
  'Place Of Supply': string;
  'Applicable %': string;
  Rate: number;
  'Taxable Value': number;
  Cess: number;
  IGST: number;
  CGST: number;
  SGST: number;
};

export type Gstr1HsnRow = {
  HSN: string;
  Description: string;
  UQC: string;
  'Total Quantity': number;
  'Total Value': number;
  'Taxable Value': number;
  IGST: number;
  CGST: number;
  SGST: number;
  Cess: number;
};

export type Gstr1FilingHistoryRow = {
  filedAt: string;
  month: string;
  financialYear: string;
};

export type Gstr1DataResponse = {
  ok: boolean;
  clientName: string;
  gstin: string;
  financialYear: string;
  month: string;
  status: string;
  filingHistory: Gstr1FilingHistoryRow[];
  summary: Gstr1Summary;
  documentSummary: Gstr1DocumentSummary;
  warnings: string[];
  b2bRows: Gstr1B2BRow[];
  b2clRows: Gstr1B2CLRow[];
  b2csRows: Gstr1B2CSRow[];
  hsnRows: Gstr1HsnRow[];
};

export type Gstr3bAdjustments = {
  zeroRatedTaxable: number;
  zeroRatedIgst: number;
  nilExemptTaxable: number;
  nonGstTaxable: number;
  itcReversedIgst: number;
  itcReversedCgst: number;
  itcReversedSgst: number;
  utilizationMode?: "auto" | "manual";
  manualUtilization?: {
    igstToIgst: number;
    igstToCgst: number;
    igstToSgst: number;
    cgstToCgst: number;
    cgstToIgst: number;
    sgstToSgst: number;
    sgstToIgst: number;
  };
  igstCrossUtilizationStrategy?: "auto" | "prefer-cgst" | "prefer-sgst";
};

export type Gstr3bSummary = {
  outputGst: number;
  inputGst: number;
  netPayable: number;
  output: {
    igst: number;
    cgst: number;
    sgst: number;
  };
  input: {
    igst: number;
    cgst: number;
    sgst: number;
  };
};

export type Gstr3bSection31Row = {
  nature: string;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
};

export type Gstr3bSection32Row = {
  state: string;
  taxableValue: number;
  igst: number;
};

export type Gstr3bSection4Row = {
  type: string;
  igst: number;
  cgst: number;
  sgst: number;
};

export type Gstr3bSection5Row = {
  type: string;
  taxableValue: number;
};

export type Gstr3bSection6Row = {
  taxType: string;
  taxPayable: number;
  itcUtilized: number;
  cashPayable: number;
};

export type Gstr3bFilingHistoryRow = {
  filedAt: string;
  month: string;
  financialYear: string;
};

export type Gstr3bDataResponse = {
  ok: boolean;
  clientName: string;
  gstin: string;
  financialYear: string;
  month: string;
  status: string;
  filingHistory: Gstr3bFilingHistoryRow[];
  warnings: string[];
  adjustments: Gstr3bAdjustments;
  /** ITC carried forward from the previous month (old setoff balance) */
  carryForwardITC: { igst: number; cgst: number; sgst: number };
  /** ITC from current month purchases only */
  currentITC: { igst: number; cgst: number; sgst: number };
  /** Total ITC available = carryForwardITC + currentITC */
  finalITC: { igst: number; cgst: number; sgst: number };
  outputGST: { igst: number; cgst: number; sgst: number };
  inputGST: { igst: number; cgst: number; sgst: number };
  netGST: { igst: number; cgst: number; sgst: number };
  payable: { igst: number; cgst: number; sgst: number };
  utilized: { igst: number; cgst: number; sgst: number };
  balance_itc: { igst: number; cgst: number; sgst: number };
  summary: Gstr3bSummary;
  section31Rows: Gstr3bSection31Row[];
  section32Rows: Gstr3bSection32Row[];
  section4Rows: Gstr3bSection4Row[];
  section5Rows: Gstr3bSection5Row[];
  section6Rows: Gstr3bSection6Row[];
};

export type ReportSalesRow = {
  date: string;
  invoiceNo: string;
  type: "B2B" | "B2C";
  partyName: string;
  taxableValue: number;
  gstAmount: number;
  total: number;
};

export type ReportPurchaseRow = {
  date: string;
  invoiceNo: string;
  supplierName: string;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  total: number;
  source: string;
};

export type ReportsDataResponse = {
  ok: boolean;
  clientName: string;
  gstin: string;
  financialYear: string;
  month: string;
  salesRows: ReportSalesRow[];
  purchaseRows: ReportPurchaseRow[];
  summary: {
    totalSales: number;
    totalSalesTaxable: number;
    totalPurchases: number;
    outputGST: { igst: number; cgst: number; sgst: number };
    inputGST: { igst: number; cgst: number; sgst: number };
    outputTotalGst: number;
    inputTotalGst: number;
    netGstPayable: number;
  };
  gstSummary: {
    cards: {
      totalSales: number;
      totalPurchase: number;
      outputGst: number;
      inputGst: number;
      netGstPayable: number;
    };
    taxRows: Array<{ taxType: string; output: number; input: number; net: number }>;
    itcUtilizationRows: Array<{ taxType: string; liability: number; itcUsed: number; cashPayable: number }>;
  };
};

export type YearlyReportMonthRow = {
  month: string;
  sales: number;
  purchases: number;
  outputGST: number;
  inputGST: number;
  netGST: number;
  outputSplit: { igst: number; cgst: number; sgst: number };
  inputSplit: { igst: number; cgst: number; sgst: number };
  margin: number;
  isLoss: boolean;
};

export type YearlyReportDataResponse = {
  ok: boolean;
  clientName: string;
  gstin: string;
  financialYear: string;
  summary: {
    totalTurnover: number;
    totalPurchases: number;
    totalOutputGST: number;
    totalInputGST: number;
    netGstPayable: number;
  };
  monthRows: YearlyReportMonthRow[];
  charts: {
    line: Array<{ month: string; sales: number }>;
    bar: Array<{ month: string; sales: number; purchases: number }>;
  };
  highlights: {
    highestSalesMonth: string;
    lossMonths: string[];
  };
};

declare global {
  interface Window {
    gstAPI: {
      getClients: () => Promise<ClientRecord[]>;
      createClientStructure: (payload: {
        clientName: string;
        gstin: string;
        clientType?: string;
        status?: string;
        financialYear?: string;
      }) => Promise<unknown>;
      loadMonthData: (payload: {
        gstin: string;
        financialYear: string;
        month: string;
      }) => Promise<MonthPayload>;
      loadClientStatus: (payload: {
        financialYear: string;
        month: string;
        includePreviousMonth?: boolean;
      }) => Promise<ClientStatusResponse>;
      saveMonthData: (payload: {
        gstin: string;
        financialYear: string;
        month: string;
        payload: MonthPayload;
      }) => Promise<{ ok: boolean; filePath: string }>;
      updateReturnStatus: (payload: {
        gstin: string;
        financialYear: string;
        month: string;
        returnType: "gstr1" | "gstr3b";
        status: ReturnStatusValue;
      }) => Promise<{
        ok: boolean;
        gstin: string;
        financialYear: string;
        month: string;
        returnType: "gstr1" | "gstr3b";
        status: ReturnStatusValue;
        returns: ClientMonthReturnSnapshot;
      }>;
      loadCustomers: (payload: {
        gstin: string;
        query?: string;
      }) => Promise<MasterPartyResponse>;
      saveCustomer: (payload: {
        gstin: string;
        customer: CustomerRecord;
        touchRecent?: boolean;
      }) => Promise<{ ok: boolean; created: boolean; customer: CustomerRecord }>;
      updateCustomer: (payload: {
        gstin: string;
        customer: CustomerRecord;
      }) => Promise<{ ok: boolean; customer: CustomerRecord }>;
      deleteCustomer: (payload: {
        gstin: string;
        customerGstin: string;
      }) => Promise<{ ok: boolean }>;
      toggleCustomerFavorite: (payload: {
        gstin: string;
        customerGstin: string;
        favorite: boolean;
      }) => Promise<{ ok: boolean }>;
      loadSuppliers: (payload: {
        gstin: string;
        query?: string;
      }) => Promise<MasterPartyResponse>;
      saveSupplier: (payload: {
        gstin: string;
        supplier: SupplierRecord;
        touchRecent?: boolean;
      }) => Promise<{ ok: boolean; created: boolean; supplier: SupplierRecord }>;
      updateSupplier: (payload: {
        gstin: string;
        supplier: SupplierRecord;
      }) => Promise<{ ok: boolean; supplier: SupplierRecord }>;
      deleteSupplier: (payload: {
        gstin: string;
        supplierGstin: string;
      }) => Promise<{ ok: boolean }>;
      toggleSupplierFavorite: (payload: {
        gstin: string;
        supplierGstin: string;
        favorite: boolean;
      }) => Promise<{ ok: boolean }>;
      importPurchase: (payload: {
        gstin: string;
        financialYear: string;
        month: string;
        fileBuffer: number[];
        dryRun?: boolean;
        overwrite?: boolean;
      }) => Promise<{
        ok: boolean;
        requiredMissing?: string[];
        preview?: PurchaseRecord[];
        duplicates?: Array<{ supplier_gstin: string; invoice_no: string }>;
        imported?: number;
        skipped?: number;
      }>;
      previewPurchaseImport: (payload: {
        gstin: string;
        financialYear: string;
        month: string;
        filePath: string;
      }) => Promise<{
        ok: boolean;
        warning?: string;
        requiredMissing?: string[];
        rows: PurchaseRecord[];
        summary: {
          total: number;
          valid: number;
          duplicates: number;
          errors: number;
        };
      }>;
      importPurchaseData: (payload: {
        gstin: string;
        financialYear: string;
        month: string;
        previewData: PurchaseRecord[];
        overwrite?: boolean;
      }) => Promise<{
        total: number;
        imported: number;
        duplicates: number;
        errors: number;
      }>;
      savePurchase: (payload: {
        gstin: string;
        financialYear: string;
        month: string;
        purchase: PurchaseRecord;
      }) => Promise<{ ok: boolean; purchase: PurchaseRecord }>;
      loadPurchase: (payload: {
        gstin: string;
        financialYear: string;
        month: string;
        query?: string;
        fromDate?: string;
        toDate?: string;
      }) => Promise<PurchaseRecord[]>;
      deletePurchase: (payload: {
        gstin: string;
        financialYear: string;
        month: string;
        id: string;
      }) => Promise<{ ok: boolean }>;
      backupDataFolder: () => Promise<{ ok: boolean; zipPath: string }>;
      notifyClientSelected: (client: ClientRecord) => void;
      saveSale: (payload: {
        gstin: string;
        financialYear: string;
        month: string;
        saleType: "b2b" | "b2c";
        sale: SaleRecord;
      }) => Promise<{ ok: boolean; sale: SaleRecord }>;
      updateSale: (payload: {
        gstin: string;
        financialYear: string;
        month: string;
        saleType: "b2b" | "b2c";
        sale: SaleRecord;
      }) => Promise<{ ok: boolean; sale: SaleRecord }>;
      loadSales: (payload: {
        gstin: string;
        financialYear: string;
        month: string;
        invoiceQuery?: string;
        fromDate?: string;
        toDate?: string;
      }) => Promise<{ b2b: SaleRecord[]; b2c: SaleRecord[] }>;
      deleteSale: (payload: {
        gstin: string;
        financialYear: string;
        month: string;
        saleType: "b2b" | "b2c";
        id?: string;
        invoiceNo?: string;
      }) => Promise<{ ok: boolean }>;
      exportSales: (payload: {
        gstin: string;
        financialYear: string;
        month: string;
        openFile?: boolean;
      }) => Promise<{ ok: boolean; filePath: string; b2bCount: number; b2cCount: number; isEmpty?: boolean }>;
      loadGstr1Data: (payload: {
        gstin: string;
        financialYear: string;
        month: string;
      }) => Promise<Gstr1DataResponse>;
      saveGstr1Data: (payload: {
        gstin: string;
        financialYear: string;
        month: string;
        b2bRows: Gstr1B2BRow[];
      }) => Promise<Gstr1DataResponse>;
      exportGstr1: (payload: {
        gstin: string;
        financialYear: string;
        month: string;
        openFile?: boolean;
      }) => Promise<{
        ok: boolean;
        filePath: string;
        warnings: string[];
        counts: { b2b: number; b2cl: number; b2cs: number; hsn: number };
      }>;
      exportGstr1Offline: (payload: {
        gstin: string;
        financialYear: string;
        month: string;
        openFile?: boolean;
      }) => Promise<{
        ok: boolean;
        filePath: string;
        warnings: string[];
        counts: { b2b: number; b2cl: number; b2cs: number; hsn: number };
      }>;
      markGstr1Filed: (payload: {
        gstin: string;
        financialYear: string;
        month: string;
      }) => Promise<{ ok: boolean; status: string; history: Gstr1FilingHistoryRow[] }>;
      loadGstr3bData: (payload: {
        gstin?: string;
        client?: string;
        financialYear?: string;
        fy?: string;
        month: string;
      }) => Promise<Gstr3bDataResponse>;
      saveGstr3bData: (payload: {
        gstin?: string;
        client?: string;
        financialYear?: string;
        fy?: string;
        month: string;
        adjustments: Gstr3bAdjustments;
      }) => Promise<Gstr3bDataResponse>;
      exportGstr3b: (payload: {
        gstin?: string;
        client?: string;
        financialYear?: string;
        fy?: string;
        month: string;
        openFile?: boolean;
      }) => Promise<{ ok: boolean; filePath: string; warnings: string[] }>;
      markGstr3bFiled: (payload: {
        gstin?: string;
        client?: string;
        financialYear?: string;
        fy?: string;
        month: string;
      }) => Promise<{ ok: boolean; status: string; history: Gstr3bFilingHistoryRow[] }>;
      /** Load carry-forward ITC balance that was stored for a given FY/month */
      loadCarryForward: (payload: {
        gstin?: string;
        client?: string;
        financialYear?: string;
        fy?: string;
        month: string;
      }) => Promise<{ ok: boolean; financialYear: string; month: string; igst: number; cgst: number; sgst: number }>;
      /** Persist a remaining ITC balance as carry-forward for the given FY/month */
      saveCarryForward: (payload: {
        gstin?: string;
        client?: string;
        financialYear?: string;
        fy?: string;
        month: string;
        igst: number;
        cgst: number;
        sgst: number;
      }) => Promise<{ ok: boolean; financialYear: string; month: string; igst: number; cgst: number; sgst: number }>;
      loadReportsData: (payload: {
        gstin?: string;
        client?: string;
        financialYear?: string;
        fy?: string;
        month: string;
      }) => Promise<ReportsDataResponse>;
      exportMonthlyReport: (payload: {
        gstin?: string;
        client?: string;
        financialYear?: string;
        fy?: string;
        month: string;
        openFile?: boolean;
      }) => Promise<{ ok: boolean; filePath: string }>;
      exportGstSummaryPdf: (payload: {
        gstin?: string;
        client?: string;
        financialYear?: string;
        fy?: string;
        month: string;
        openFile?: boolean;
      }) => Promise<{ ok: boolean; filePath: string }>;
      loadYearlyReportData: (payload: {
        gstin?: string;
        client?: string;
        financialYear?: string;
        fy?: string;
      }) => Promise<YearlyReportDataResponse>;
      exportYearlyReport: (payload: {
        gstin?: string;
        client?: string;
        financialYear?: string;
        fy?: string;
        openFile?: boolean;
      }) => Promise<{ ok: boolean; filePath: string }>;
      exportYearlySummaryPdf: (payload: {
        gstin?: string;
        client?: string;
        financialYear?: string;
        fy?: string;
        openFile?: boolean;
      }) => Promise<{ ok: boolean; filePath: string }>;
      calculateGst: (payload: {
        amount: number;
        rate: number;
        mode: "exclusive" | "inclusive";
      }) => Promise<{
        mode: "exclusive" | "inclusive";
        amount: number;
        rate: number;
        taxableValue: number;
        gstAmount: number;
        totalAmount: number;
      }>;
      generateInvoice: (payload: {
        financialYear: string;
        month: string;
      }) => Promise<{
        ok: boolean;
        invoiceNo: string;
        sequence: number;
        period: string;
      }>;
      backupData: () => Promise<{ ok: boolean; zipPath: string }>;
      restoreData: (payload: {
        zipBuffer: number[];
      }) => Promise<{
        ok: boolean;
        restoredTo: string;
        previousBackupPath: string;
      }>;
      generateMockData: (payload: {
        client: ClientRecord;
        financialYear: string;
        month: string;
      }) => Promise<{
        ok: boolean;
        b2bCreated: number;
        b2cCreated: number;
        purchasesCreated: number;
        message: string;
      }>;
      generatePurchaseMock: (payload: {
        client: ClientRecord;
        financialYear: string;
        month: string;
      }) => Promise<{
        total_generated: number;
      }>;
      getAppSettings: () => Promise<{ dataDirectory: string; appVersion: string }>;
      changeDataDirectory: () => Promise<{ changed: boolean; newPath: string; needsRestart: boolean }>;
      checkForUpdates: () => Promise<{
        ok: boolean;
        currentVersion: string;
        latestVersion: string;
        hasUpdate: boolean;
        releaseUrl: string;
        releaseNotes: string;
      }>;
      openExternalUrl: (url: string) => void;
      restartApp: () => void;
      /** Get saved GST portal credentials (password never returned — has_password flag only) */
      getGstCredentials: () => Promise<{ gst_username: string; has_password: boolean }>;
      /** Save GST portal credentials to local app settings */
      saveGstCredentials: (payload: { gst_username: string; gst_password?: string }) => Promise<{ ok: boolean }>;
      /** Open the GST portal in a new Electron window with auto-fill */
      openGstPortal: (payload?: { targetUrl?: string }) => void;
    };
    windowControls: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      isMaximized: () => Promise<boolean>;
      onStateChange: (callback: (isMaximized: boolean) => void) => () => void;
    };
  }
}

export {};
