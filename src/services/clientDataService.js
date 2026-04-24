const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');

const MONTHS = [
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
  'January',
  'February',
  'March'
];

const QUARTERS = [
  'Apr-Jun',
  'Jul-Sep',
  'Oct-Dec',
  'Jan-Mar'
];

const GST_RATES = [5, 12, 18, 28];

const INDIAN_STATES = [
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '24', name: 'Gujarat' },
  { code: '07', name: 'Delhi' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '32', name: 'Kerala' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '19', name: 'West Bengal' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '30', name: 'Goa' },
  { code: '08', name: 'Rajasthan' }
];

const BUSINESS_NAMES = [
  'Shree Traders',
  'Om Enterprises',
  'Balaji Distributors',
  'Sai Agencies',
  'Mahalaxmi Sales',
  'Apex Industrial Supply',
  'Rudra Wholesale Mart',
  'Krishna Trading Company',
  'Nova Tech Solutions',
  'Pragati Impex'
];

const PURCHASE_SUPPLIER_NAMES = [
  'Shree Traders',
  'Om Enterprises',
  'Balaji Suppliers',
  'Sai Distributors',
  'Mahalakshmi Traders'
];

const PURCHASE_STATES = [
  { code: '27', name: 'Maharashtra' },
  { code: '24', name: 'Gujarat' },
  { code: '29', name: 'Karnataka' },
  { code: '23', name: 'Madhya Pradesh' }
];

const ITEM_DESCRIPTIONS = [
  'Wheat Flour Pack',
  'Industrial Cleaning Service',
  'Accounting Software License',
  'Electrical Cable Roll',
  'Office Chair',
  'Safety Gloves Box',
  'LED Panel Light',
  'Packaging Material Bundle',
  'Desktop Maintenance Service',
  'POS Printer'
];

const HSN_CODES = ['1001', '9983', '8471', '9403', '3923', '8536', '4819'];

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GSTR1_INVOICE_LIMIT = 250000;

const STATE_CODE_TO_NAME = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman and Diu',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory'
};

const STATE_NAME_TO_CODE = Object.entries(STATE_CODE_TO_NAME).reduce((acc, [code, name]) => {
  acc[String(name || '').trim().toLowerCase()] = code;
  return acc;
}, {});

function sanitizeName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_&-]/g, '');
}

function getCurrentFinancialYearLabel(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const startYear = month >= 3 ? year : year - 1;
  const endShort = String((startYear + 1) % 100).padStart(2, '0');
  return `FY_${startYear}-${endShort}`;
}

function getClientMonthTemplate(clientName, gstin, financialYear, month) {
  return {
    client_name: clientName,
    gstin,
    financial_year: financialYear,
    month,
    sales: {
      b2b: [],
      b2c: []
    },
    purchases: [],
    returns: {
      gstr1: 'pending',
      gstr3b: 'pending'
    }
  };
}

function ensureSalesShape(payload) {
  if (!payload.sales || Array.isArray(payload.sales)) {
    payload.sales = {
      b2b: Array.isArray(payload.sales) ? payload.sales : [],
      b2c: []
    };
  }

  if (!Array.isArray(payload.sales.b2b)) payload.sales.b2b = [];
  if (!Array.isArray(payload.sales.b2c)) payload.sales.b2c = [];

  return payload;
}

function ensurePurchasesShape(payload) {
  if (!Array.isArray(payload.purchases)) {
    payload.purchases = [];
  }
  return payload;
}

function normalizeMonthPayload(payload) {
  ensureSalesShape(payload);
  ensurePurchasesShape(payload);
  payload.returns = payload.returns && typeof payload.returns === 'object' ? payload.returns : {};
  if (!payload.returns.gstr1) payload.returns.gstr1 = 'pending';
  if (!payload.returns.gstr3b) payload.returns.gstr3b = 'pending';
  return payload;
}

function normalizeReturnStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  if (status === 'filed') return 'filed';
  if (status === 'not-started') return 'not-started';
  return 'pending';
}

function getDueDateForReturn(financialYear, month, returnType) {
  const idx = MONTHS.indexOf(String(month || '').trim());
  if (idx < 0) {
    return null;
  }

  const year = getCalendarYearForMonth(financialYear, MONTHS[idx]);
  const calendarMonthIndex = (idx + 3) % 12;
  const dueDay = returnType === 'gstr1' ? 11 : 20;
  return new Date(year, calendarMonthIndex + 1, dueDay);
}

function getReturnDueMeta(financialYear, month, returnType) {
  const dueDate = getDueDateForReturn(financialYear, month, returnType);
  if (!dueDate) {
    return {
      dueDate: null,
      dueInDays: null,
      overdue: false
    };
  }

  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startDue = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const diffMs = startDue.getTime() - startToday.getTime();
  const dueInDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return {
    dueDate: dueDate.toISOString(),
    dueInDays,
    overdue: dueInDays < 0
  };
}

function getPreviousFinancialPeriod(financialYear, month) {
  const normalizedMonth = String(month || '').trim();
  const idx = MONTHS.indexOf(normalizedMonth);
  if (idx < 0) {
    throw new Error('Invalid month supplied');
  }

  if (idx > 0) {
    return {
      financialYear,
      month: MONTHS[idx - 1]
    };
  }

  const fyMatch = String(financialYear || '').match(/^FY_(\d{4})-(\d{2})$/);
  if (!fyMatch) {
    throw new Error('Invalid financial year format. Expected FY_YYYY-YY');
  }

  const startYear = Number(fyMatch[1]) - 1;
  const endShort = String((startYear + 1) % 100).padStart(2, '0');
  return {
    financialYear: `FY_${startYear}-${endShort}`,
    month: 'March'
  };
}

function inferVisualStatus(rawStatus, payload) {
  const normalized = normalizeReturnStatus(rawStatus);
  if (normalized !== 'pending') return normalized;

  const b2b = Array.isArray(payload?.sales?.b2b) ? payload.sales.b2b.length : 0;
  const b2c = Array.isArray(payload?.sales?.b2c) ? payload.sales.b2c.length : 0;
  const purchases = Array.isArray(payload?.purchases) ? payload.purchases.length : 0;
  if (b2b + b2c + purchases === 0) {
    return 'not-started';
  }

  return 'pending';
}

function normalizeHeaderName(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max, decimals = 2) {
  const factor = Math.pow(10, decimals);
  const value = Math.random() * (max - min) + min;
  return Math.round(value * factor) / factor;
}

function pickRandom(list) {
  return list[randomInt(0, list.length - 1)];
}

function to2(value) {
  return Number(Number(value || 0).toFixed(2));
}

function toNum(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function normalizeGstin(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeInvoice(value) {
  return String(value || '').trim().toUpperCase();
}

function formatDateDDMMYYYY(value) {
  const text = String(value || '').trim();
  if (!text) return '';

  const parts = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return text;
  return `${parts[3]}-${parts[2]}-${parts[1]}`;
}

function getStateCodeFromValue(value) {
  const text = String(value || '').trim();
  if (!text) return '';

  const prefixedCode = text.match(/^(\d{2})\s*[-:]/);
  if (prefixedCode) {
    return prefixedCode[1];
  }

  const directCode = text.match(/^(\d{2})$/);
  if (directCode) {
    return directCode[1];
  }

  const key = text.toLowerCase();
  return STATE_NAME_TO_CODE[key] || '';
}

function formatPos(code) {
  const normalized = String(code || '').padStart(2, '0');
  const name = STATE_CODE_TO_NAME[normalized];
  return name ? `${normalized}-${name}` : normalized;
}

function calculateSaleTaxes(items) {
  return (Array.isArray(items) ? items : []).reduce(
    (acc, item) => {
      acc.igst += toNum(item.igst);
      acc.cgst += toNum(item.cgst);
      acc.sgst += toNum(item.sgst);
      return acc;
    },
    { igst: 0, cgst: 0, sgst: 0 }
  );
}

function buildB2csGroups() {
  return new Map();
}

function buildGstr1Snapshot(payload, sellerGstin) {
  const warnings = [];
  const b2bRows = [];
  const b2clRows = [];
  const b2csGroups = buildB2csGroups();
  const hsnMap = new Map();

  const b2bInvoices = Array.isArray(payload?.sales?.b2b) ? payload.sales.b2b : [];
  const b2cInvoices = Array.isArray(payload?.sales?.b2c) ? payload.sales.b2c : [];
  const sellerStateCode = String(sellerGstin || '').slice(0, 2);
  const uniqueInvoiceKeys = new Set();

  const addHsn = (item, invoiceValue) => {
    const hsn = String(item.hsn_sac || item.hsn_code || '').trim() || 'NA';
    const rate = toNum(item.gst_rate);
    const key = `${hsn.toUpperCase()}::${rate}`;
    const current = hsnMap.get(key) || {
      HSN: hsn,
      Description: String(item.description || '').trim() || 'NA',
      UQC: 'NOS',
      Rate: rate,
      'Total Quantity': 0,
      'Total Value': 0,
      'Taxable Value': 0,
      IGST: 0,
      CGST: 0,
      SGST: 0,
      Cess: 0
    };

    current['Total Quantity'] = to2(toNum(current['Total Quantity']) + toNum(item.quantity || 0));
    current['Total Value'] = to2(toNum(current['Total Value']) + toNum(invoiceValue));
    current['Taxable Value'] = to2(toNum(current['Taxable Value']) + toNum(item.taxable_value));
    current.IGST = to2(toNum(current.IGST) + toNum(item.igst));
    current.CGST = to2(toNum(current.CGST) + toNum(item.cgst));
    current.SGST = to2(toNum(current.SGST) + toNum(item.sgst));
    hsnMap.set(key, current);
  };

  const markDuplicate = (invoiceNo, bucket) => {
    if (!invoiceNo) return false;
    const key = `${bucket}::${normalizeInvoice(invoiceNo)}`;
    if (uniqueInvoiceKeys.has(key)) {
      warnings.push(`Duplicate invoice skipped: ${invoiceNo}`);
      return true;
    }
    uniqueInvoiceKeys.add(key);
    return false;
  };

  b2bInvoices.forEach((sale) => {
    const buyerGstin = normalizeGstin(sale.buyer_gstin);
    if (!GSTIN_REGEX.test(buyerGstin)) {
      warnings.push(`B2B invoice skipped due to invalid GSTIN: ${sale.invoice_no || 'NA'}`);
      return;
    }

    if (markDuplicate(sale.invoice_no, 'b2b')) {
      return;
    }

    const posCode = getStateCodeFromValue(sale.place_of_supply) || buyerGstin.slice(0, 2);
    const invoiceValue = to2(toNum(sale.total_value));
    const items = Array.isArray(sale.items) ? sale.items : [];

    items.forEach((item) => {
      const taxable = to2(toNum(item.taxable_value));
      if (taxable <= 0) return;

      b2bRows.push({
        _saleId: String(sale.id || ''),
        _itemSrNo: Number(item.sr_no || 0),
        _warnings: [],
        'GSTIN/UIN of Recipient': buyerGstin,
        'Receiver Name': String(sale.buyer_name || '').trim(),
        'Invoice Number': String(sale.invoice_no || '').trim(),
        'Invoice Date': formatDateDDMMYYYY(sale.date),
        'Invoice Value': invoiceValue,
        'Place Of Supply': formatPos(posCode),
        'Reverse Charge': sale.reverse_charge || 'No',
        'Applicable % of Tax Rate': '',
        'Invoice Type': 'Regular B2B',
        'E-Commerce GSTIN': '',
        Rate: toNum(item.gst_rate),
        'Taxable Value': taxable,
        'Cess Amount': 0,
        IGST: to2(toNum(item.igst)),
        CGST: to2(toNum(item.cgst)),
        SGST: to2(toNum(item.sgst))
      });

      addHsn(item, invoiceValue);
    });
  });

  b2cInvoices.forEach((sale) => {
    if (markDuplicate(sale.invoice_no, 'b2c')) {
      return;
    }

    const posCode = getStateCodeFromValue(sale.place_of_supply);
    if (!posCode) {
      warnings.push(`B2C invoice missing POS state: ${sale.invoice_no || 'NA'}`);
      return;
    }

    const invoiceValue = to2(toNum(sale.total_value));
    const isInterstate = posCode !== sellerStateCode;
    const items = Array.isArray(sale.items) ? sale.items : [];

    items.forEach((item) => {
      const taxable = to2(toNum(item.taxable_value));
      if (taxable <= 0) return;

      const row = {
        _saleId: String(sale.id || ''),
        'Invoice Number': String(sale.invoice_no || '').trim(),
        'Invoice Date': formatDateDDMMYYYY(sale.date),
        'Invoice Value': invoiceValue,
        'Place Of Supply': formatPos(posCode),
        'Applicable %': '',
        Rate: toNum(item.gst_rate),
        'Taxable Value': taxable,
        Cess: 0,
        IGST: to2(toNum(item.igst)),
        CGST: to2(toNum(item.cgst)),
        SGST: to2(toNum(item.sgst))
      };

      if (isInterstate && invoiceValue > GSTR1_INVOICE_LIMIT) {
        b2clRows.push(row);
      } else {
        const groupKey = `${posCode}::${toNum(item.gst_rate)}`;
        const existing = b2csGroups.get(groupKey) || {
          Type: 'OE',
          'Place Of Supply': formatPos(posCode),
          'Applicable %': '',
          Rate: toNum(item.gst_rate),
          'Taxable Value': 0,
          Cess: 0,
          IGST: 0,
          CGST: 0,
          SGST: 0
        };

        existing['Taxable Value'] = to2(toNum(existing['Taxable Value']) + taxable);
        existing.IGST = to2(toNum(existing.IGST) + toNum(item.igst));
        existing.CGST = to2(toNum(existing.CGST) + toNum(item.cgst));
        existing.SGST = to2(toNum(existing.SGST) + toNum(item.sgst));
        b2csGroups.set(groupKey, existing);
      }

      addHsn(item, invoiceValue);
    });
  });

  const b2csRows = Array.from(b2csGroups.values()).filter((row) => toNum(row['Taxable Value']) > 0);
  const hsnRows = Array.from(hsnMap.values()).filter((row) => toNum(row['Taxable Value']) > 0);

  const b2bTotal = to2(b2bRows.reduce((sum, row) => sum + toNum(row['Taxable Value']), 0));
  const b2cTotal = to2(
    b2clRows.reduce((sum, row) => sum + toNum(row['Taxable Value']), 0) +
      b2csRows.reduce((sum, row) => sum + toNum(row['Taxable Value']), 0)
  );

  const allSales = [...b2bInvoices, ...b2cInvoices];
  const gstTotals = allSales.reduce(
    (acc, sale) => {
      const tax = calculateSaleTaxes(sale.items);
      if (sale.reverse_charge === 'Yes') {
        acc.rcIgst += tax.igst;
        acc.rcCgst += tax.cgst;
        acc.rcSgst += tax.sgst;
      } else {
        acc.igst += tax.igst;
        acc.cgst += tax.cgst;
        acc.sgst += tax.sgst;
      }
      return acc;
    },
    { igst: 0, cgst: 0, sgst: 0, rcIgst: 0, rcCgst: 0, rcSgst: 0 }
  );

  const invalidGstRows = [];
  b2bRows.forEach((row) => {
    const rate = toNum(row.Rate);
    const expected = to2((toNum(row['Taxable Value']) * rate) / 100);
    const actual = to2(toNum(row.IGST) + toNum(row.CGST) + toNum(row.SGST));
    if (Math.abs(expected - actual) > 1) {
      invalidGstRows.push(String(row['Invoice Number'] || 'NA'));
    }
  });

  if (invalidGstRows.length > 0) {
    warnings.push(`GST mismatch detected in invoices: ${Array.from(new Set(invalidGstRows)).join(', ')}`);
  }

  const cancelledInvoices = 0;
  const totalInvoicesIssued = allSales.length;

  return {
    status: payload?.returns?.gstr1 || 'pending',
    filingHistory: Array.isArray(payload?.returns?.gstr1_history) ? payload.returns.gstr1_history : [],
    summary: {
      totalB2BSales: b2bTotal,
      totalB2CSales: b2cTotal,
      totalTaxableValue: to2(b2bTotal + b2cTotal),
      totalGst: to2(gstTotals.igst + gstTotals.cgst + gstTotals.sgst),
      igst: to2(gstTotals.igst),
      cgst: to2(gstTotals.cgst),
      sgst: to2(gstTotals.sgst),
      reverseChargeGst: to2(gstTotals.rcIgst + gstTotals.rcCgst + gstTotals.rcSgst),
      rcIgst: to2(gstTotals.rcIgst),
      rcCgst: to2(gstTotals.rcCgst),
      rcSgst: to2(gstTotals.rcSgst)
    },
    documentSummary: {
      totalInvoicesIssued,
      cancelledInvoices,
      netIssued: totalInvoicesIssued - cancelledInvoices
    },
    warnings,
    b2bRows,
    b2clRows,
    b2csRows,
    hsnRows
  };
}

function monthNumber(month) {
  const idx = MONTHS.indexOf(String(month || '').trim());
  if (idx < 0) {
    throw new Error('Invalid month supplied for mock data generation');
  }
  return idx + 1;
}

function parseFinancialYearStart(financialYear) {
  const match = String(financialYear || '').match(/^FY_(\d{4})-\d{2}$/);
  if (!match) {
    throw new Error('Invalid financial year format. Expected FY_YYYY-YY');
  }
  return Number(match[1]);
}

function getCalendarYearForMonth(financialYear, month) {
  const startYear = parseFinancialYearStart(financialYear);
  const idx = MONTHS.indexOf(month);
  if (idx < 0) {
    throw new Error('Invalid month supplied for mock data generation');
  }
  return idx <= 8 ? startYear : startYear + 1;
}

function randomDateInMonth(financialYear, month) {
  const year = getCalendarYearForMonth(financialYear, month);
  const m = monthNumber(month);
  const lastDay = new Date(year, m, 0).getDate();
  const day = randomInt(1, lastDay);
  return `${year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function randomAlpha(len) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += chars[randomInt(0, chars.length - 1)];
  }
  return out;
}

function randomDigits(len) {
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += String(randomInt(0, 9));
  }
  return out;
}

function randomAlphaNum() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return chars[randomInt(0, chars.length - 1)];
}

function generateGstin(stateCode) {
  const code = String(stateCode || pickRandom(INDIAN_STATES).code).padStart(2, '0');
  const gstin = `${code}${randomAlpha(5)}${randomDigits(4)}${randomAlpha(1)}${randomAlphaNum()}Z${randomAlphaNum()}`;
  if (!GSTIN_REGEX.test(gstin)) {
    return generateGstin(stateCode);
  }
  return gstin;
}

function splitTax(taxableValue, gstRate, isInterstate) {
  const taxAmount = to2((taxableValue * gstRate) / 100);
  if (isInterstate) {
    return {
      igst: taxAmount,
      cgst: 0,
      sgst: 0,
      total: to2(taxableValue + taxAmount)
    };
  }

  const half = to2(taxAmount / 2);
  return {
    igst: 0,
    cgst: half,
    sgst: half,
    total: to2(taxableValue + half + half)
  };
}

function createClientDataService(baseDataDir) {
  const clientsRoot = path.join(baseDataDir, 'clients');
  const customersCache = new Map();
  const suppliersCache = new Map();
  const yearlyReportCache = new Map();

  function yearlyCacheKey(gstin, financialYear) {
    return `${String(gstin || '').toUpperCase()}::${String(financialYear || '').toUpperCase()}`;
  }

  function invalidateYearlyCache(gstin, financialYear) {
    if (gstin && financialYear) {
      yearlyReportCache.delete(yearlyCacheKey(gstin, financialYear));
      return;
    }

    yearlyReportCache.clear();
  }

  function ensureClientsRoot() {
    fs.mkdirSync(clientsRoot, { recursive: true });
  }

  // ── Carry-forward ITC helpers ──────────────────────────────────────────────

  function getCarryForwardFilePath(folderName) {
    return path.join(clientsRoot, folderName, 'carry_forward.json');
  }

  function readCarryForwardFromDisk(folderName) {
    const filePath = getCarryForwardFilePath(folderName);
    if (!fs.existsSync(filePath)) return {};
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeCarryForwardToDisk(folderName, data) {
    const filePath = getCarryForwardFilePath(folderName);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  /**
   * Returns the ITC balance stored for a specific FY + month.
   * Used to get the PREVIOUS month's leftover before building the snapshot.
   */
  function getStoredCarryForward(folderName, financialYear, month) {
    const data = readCarryForwardFromDisk(folderName);
    const fyData = data[financialYear];
    if (!fyData || typeof fyData !== 'object') return { igst: 0, cgst: 0, sgst: 0 };
    const entry = fyData[month];
    if (!entry || typeof entry !== 'object') return { igst: 0, cgst: 0, sgst: 0 };
    return {
      igst: Math.max(0, to2(toNum(entry.igst))),
      cgst: Math.max(0, to2(toNum(entry.cgst))),
      sgst: Math.max(0, to2(toNum(entry.sgst)))
    };
  }

  /**
   * Saves remaining ITC for a FY + month (the next-month carry-forward).
   * Clamps values to >= 0. Never allows negative carry-forward.
   */
  function setStoredCarryForward(folderName, financialYear, month, igst, cgst, sgst) {
    const safeIgst = Math.max(0, to2(toNum(igst)));
    const safeCgst = Math.max(0, to2(toNum(cgst)));
    const safeSgst = Math.max(0, to2(toNum(sgst)));
    const data = readCarryForwardFromDisk(folderName);
    if (!data[financialYear] || typeof data[financialYear] !== 'object') {
      data[financialYear] = {};
    }
    data[financialYear][month] = { igst: safeIgst, cgst: safeCgst, sgst: safeSgst };
    writeCarryForwardToDisk(folderName, data);
  }

  /**
   * IPC service: load the previous month's carry-forward balance.
   * Accepts { gstin, fy, month } or { client, fy, month }.
   */
  function loadCarryForward(input) {
    const normalized = normalizeGstr3bInput(input || {});
    const ctx = getClientFolderContextByGstin(normalized.gstin);
    // We want the carry-forward that was stored *for* this month
    // (i.e. the leftover from the previous month that rolls into this month)
    const stored = getStoredCarryForward(ctx.folderName, normalized.financialYear, normalized.month);
    return {
      ok: true,
      financialYear: normalized.financialYear,
      month: normalized.month,
      igst: stored.igst,
      cgst: stored.cgst,
      sgst: stored.sgst
    };
  }

  /**
   * IPC service: save remaining ITC as the next month's carry-forward.
   * Accepts { gstin, fy, month, igst, cgst, sgst }.
   */
  function saveCarryForward(input) {
    const normalized = normalizeGstr3bInput(input || {});
    const ctx = getClientFolderContextByGstin(normalized.gstin);
    setStoredCarryForward(
      ctx.folderName,
      normalized.financialYear,
      normalized.month,
      toNum(input.igst),
      toNum(input.cgst),
      toNum(input.sgst)
    );
    return {
      ok: true,
      financialYear: normalized.financialYear,
      month: normalized.month,
      igst: Math.max(0, to2(toNum(input.igst))),
      cgst: Math.max(0, to2(toNum(input.cgst))),
      sgst: Math.max(0, to2(toNum(input.sgst)))
    };
  }

  function getClientFolders() {
    ensureClientsRoot();
    return fs.readdirSync(clientsRoot, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  }

  function findFolderByGstin(gstin) {
    return getClientFolders().find((name) => name.endsWith(`_${gstin}`));
  }

  function getClientFolderContextByGstin(gstinInput) {
    const gstin = String(gstinInput || '').trim().toUpperCase();
    if (!gstin) {
      throw new Error('Client GSTIN is required');
    }

    const folderName = findFolderByGstin(gstin);
    if (!folderName) {
      throw new Error('Client not found for GSTIN');
    }

    return {
      gstin,
      folderName,
      folderPath: path.join(clientsRoot, folderName)
    };
  }

  function getPartyFilePath(folderName, kind) {
    return path.join(clientsRoot, folderName, kind === 'customer' ? 'customers.json' : 'suppliers.json');
  }

  function getPartyMetaFilePath(folderName, kind) {
    return path.join(clientsRoot, folderName, kind === 'customer' ? 'customers.meta.json' : 'suppliers.meta.json');
  }

  function readPartyMapFromDisk(folderName, kind) {
    const filePath = getPartyFilePath(folderName, kind);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify({}, null, 2), 'utf8');
      return {};
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);

      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const legacyList = Array.isArray(parsed.customers) ? parsed.customers : null;
        if (!legacyList) {
          return parsed;
        }

        const migrated = {};
        legacyList.forEach((row) => {
          const gstin = String(row?.gstin || '').trim().toUpperCase();
          if (!gstin) return;
          migrated[gstin] = {
            name: String(row?.name || '').trim(),
            state: String(row?.state || '').trim()
          };
        });

        fs.writeFileSync(filePath, JSON.stringify(migrated, null, 2), 'utf8');
        return migrated;
      }
    } catch {
      return {};
    }

    return {};
  }

  function writePartyMapToDisk(folderName, kind, partyMap) {
    const filePath = getPartyFilePath(folderName, kind);
    fs.writeFileSync(filePath, JSON.stringify(partyMap, null, 2), 'utf8');
  }

  function readPartyMetaFromDisk(folderName, kind) {
    const filePath = getPartyMetaFilePath(folderName, kind);
    if (!fs.existsSync(filePath)) {
      const meta = { favorites: [], recent: [] };
      fs.writeFileSync(filePath, JSON.stringify(meta, null, 2), 'utf8');
      return meta;
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        favorites: Array.isArray(parsed?.favorites) ? parsed.favorites.map((v) => String(v || '').toUpperCase()) : [],
        recent: Array.isArray(parsed?.recent) ? parsed.recent.map((v) => String(v || '').toUpperCase()) : []
      };
    } catch {
      return { favorites: [], recent: [] };
    }
  }

  function writePartyMetaToDisk(folderName, kind, meta) {
    const filePath = getPartyMetaFilePath(folderName, kind);
    fs.writeFileSync(filePath, JSON.stringify(meta, null, 2), 'utf8');
  }

  function getPartyStore(context, kind) {
    const cache = kind === 'customer' ? customersCache : suppliersCache;
    const cacheKey = context.folderName;

    if (!cache.has(cacheKey)) {
      cache.set(cacheKey, {
        map: readPartyMapFromDisk(context.folderName, kind),
        meta: readPartyMetaFromDisk(context.folderName, kind)
      });
    }

    return cache.get(cacheKey) || { map: {}, meta: { favorites: [], recent: [] } };
  }

  function persistPartyStore(context, kind, store) {
    const cache = kind === 'customer' ? customersCache : suppliersCache;
    writePartyMapToDisk(context.folderName, kind, store.map);
    writePartyMetaToDisk(context.folderName, kind, store.meta);
    cache.set(context.folderName, store);
  }

  function normalizePartyInput(row) {
    return {
      gstin: String(row?.gstin || '').trim().toUpperCase(),
      name: String(row?.name || '').trim(),
      state: String(row?.state || '').trim()
    };
  }

  function touchRecent(meta, gstin) {
    const nextRecent = [gstin, ...meta.recent.filter((value) => value !== gstin)].slice(0, 20);
    return {
      ...meta,
      recent: nextRecent
    };
  }

  function listParties(input, kind) {
    const context = getClientFolderContextByGstin(input.gstin);
    const store = getPartyStore(context, kind);
    const query = String(input.query || '').trim().toLowerCase();

    const recentRank = new Map();
    store.meta.recent.forEach((gstin, idx) => {
      recentRank.set(gstin, idx);
    });

    const entries = Object.entries(store.map)
      .map(([gstin, data]) => ({
        gstin,
        name: String(data?.name || ''),
        state: String(data?.state || ''),
        favorite: store.meta.favorites.includes(gstin),
        recentRank: recentRank.has(gstin) ? recentRank.get(gstin) : undefined
      }))
      .filter((row) => {
        if (!query) return true;
        return row.gstin.toLowerCase().includes(query) || row.name.toLowerCase().includes(query);
      })
      .sort((a, b) => {
        if (Boolean(a.favorite) !== Boolean(b.favorite)) return a.favorite ? -1 : 1;
        const aRecent = typeof a.recentRank === 'number' ? a.recentRank : Number.MAX_SAFE_INTEGER;
        const bRecent = typeof b.recentRank === 'number' ? b.recentRank : Number.MAX_SAFE_INTEGER;
        if (aRecent !== bRecent) return aRecent - bRecent;
        return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
      });

    return {
      map: store.map,
      entries,
      favorites: store.meta.favorites,
      recent: store.meta.recent
    };
  }

  function saveParty(input, kind) {
    const context = getClientFolderContextByGstin(input.gstin);
    const payload = kind === 'customer' ? input.customer || {} : input.supplier || {};
    const normalized = normalizePartyInput(payload);

    if (!normalized.gstin || !normalized.name) {
      throw new Error(`${kind === 'customer' ? 'Customer' : 'Supplier'} GSTIN and name are required`);
    }

    const store = getPartyStore(context, kind);
    const exists = Boolean(store.map[normalized.gstin]);

    store.map = {
      ...store.map,
      [normalized.gstin]: {
        name: normalized.name,
        state: normalized.state
      }
    };

    if (input.touchRecent !== false) {
      store.meta = touchRecent(store.meta, normalized.gstin);
    }

    persistPartyStore(context, kind, store);

    return { ok: true, created: !exists, party: normalized };
  }

  function updateParty(input, kind) {
    return saveParty({ ...input, touchRecent: false }, kind);
  }

  function deleteParty(input, kind) {
    const context = getClientFolderContextByGstin(input.gstin);
    const gstin = String(kind === 'customer' ? input.customerGstin : input.supplierGstin || '').trim().toUpperCase();
    if (!gstin) {
      throw new Error(`${kind === 'customer' ? 'Customer' : 'Supplier'} GSTIN is required`);
    }

    const store = getPartyStore(context, kind);
    if (!store.map[gstin]) {
      return { ok: true };
    }

    const nextMap = { ...store.map };
    delete nextMap[gstin];

    store.map = nextMap;
    store.meta = {
      favorites: store.meta.favorites.filter((value) => value !== gstin),
      recent: store.meta.recent.filter((value) => value !== gstin)
    };

    persistPartyStore(context, kind, store);
    return { ok: true };
  }

  function togglePartyFavorite(input, kind) {
    const context = getClientFolderContextByGstin(input.gstin);
    const gstin = String(kind === 'customer' ? input.customerGstin : input.supplierGstin || '').trim().toUpperCase();
    const favorite = Boolean(input.favorite);
    if (!gstin) {
      throw new Error(`${kind === 'customer' ? 'Customer' : 'Supplier'} GSTIN is required`);
    }

    const store = getPartyStore(context, kind);
    if (!store.map[gstin]) {
      throw new Error(`${kind === 'customer' ? 'Customer' : 'Supplier'} not found`);
    }

    if (favorite) {
      store.meta = {
        ...store.meta,
        favorites: [gstin, ...store.meta.favorites.filter((value) => value !== gstin)]
      };
    } else {
      store.meta = {
        ...store.meta,
        favorites: store.meta.favorites.filter((value) => value !== gstin)
      };
    }

    persistPartyStore(context, kind, store);
    return { ok: true };
  }

  function loadCustomers(input) {
    return listParties(input, 'customer');
  }

  function saveCustomer(input) {
    const result = saveParty(input, 'customer');
    return { ok: true, created: result.created, customer: result.party };
  }

  function updateCustomer(input) {
    const result = updateParty(input, 'customer');
    return { ok: true, customer: result.party };
  }

  function deleteCustomer(input) {
    return deleteParty(input, 'customer');
  }

  function toggleCustomerFavorite(input) {
    return togglePartyFavorite(input, 'customer');
  }

  function ensureFyMonthFiles(folderName, financialYear, clientName, gstin) {
    const fyPath = path.join(clientsRoot, folderName, financialYear);
    fs.mkdirSync(fyPath, { recursive: true });

    const meta = readClientMeta(folderName);
    const frequency = meta?.returnFrequency || "Monthly";
    const periods = frequency === "Quarterly" ? QUARTERS : MONTHS;

    periods.forEach((period) => {
      const filePath = path.join(fyPath, `${period}.json`);
      if (!fs.existsSync(filePath)) {
        const payload = getClientMonthTemplate(clientName, gstin, financialYear, period);
        fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
      }
    });
  }

  function writeClientMeta(folderName, meta) {
    const metaPath = path.join(clientsRoot, folderName, 'client.json');
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
  }

  function readClientMeta(folderName) {
    const metaPath = path.join(clientsRoot, folderName, 'client.json');
    if (!fs.existsSync(metaPath)) return null;

    try {
      const raw = fs.readFileSync(metaPath, 'utf8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function getClients() {
    ensureClientsRoot();

    return getClientFolders().map((folderName) => {
      const meta = readClientMeta(folderName);
      const gstin = meta?.gstin || folderName.split('_').pop() || '';
      const clientName = meta?.clientName || folderName.replace(`_${gstin}`, '').replace(/_/g, ' ');

      return {
        folderName,
        clientName,
        gstin,
        clientType: meta?.clientType || 'Regular',
        status: meta?.status || 'Active',
        returnFrequency: meta?.returnFrequency || 'Monthly',
        invoicePrefix: meta?.invoicePrefix || 'INV',
        financialYears: fs.readdirSync(path.join(clientsRoot, folderName), { withFileTypes: true })
          .filter((d) => d.isDirectory() && d.name.startsWith('FY_'))
          .map((d) => d.name)
      };
    });
  }

  function createClientStructure(input) {
    ensureClientsRoot();

    const clientName = String(input.clientName || '').trim();
    const gstin = String(input.gstin || '').trim().toUpperCase();
    const clientType = String(input.clientType || 'Regular');
    const status = String(input.status || 'Active');
    const financialYear = String(input.financialYear || getCurrentFinancialYearLabel());

    if (!clientName || !gstin) {
      throw new Error('clientName and gstin are required');
    }

    const existingFolder = findFolderByGstin(gstin);
    const folderName = existingFolder || `${sanitizeName(clientName)}_${gstin}`;
    const folderPath = path.join(clientsRoot, folderName);
    
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const existingMeta = readClientMeta(folderName) || {};

    writeClientMeta(folderName, {
      ...existingMeta,
      clientName,
      gstin,
      clientType,
      status,
      returnFrequency: input.returnFrequency || existingMeta.returnFrequency || 'Monthly',
      invoicePrefix: input.invoicePrefix !== undefined ? input.invoicePrefix : (existingMeta.invoicePrefix || 'INV'),
      updatedAt: new Date().toISOString(),
      createdAt: existingMeta.createdAt || new Date().toISOString()
    });

    ensureFyMonthFiles(folderName, financialYear, clientName, gstin);

    return {
      folderName,
      clientName,
      gstin,
      clientType,
      status,
      financialYear
    };
  }

  function loadMonthData(input) {
    ensureClientsRoot();

    const gstin = String(input.gstin || '').trim().toUpperCase();
    const month = String(input.month || '').trim();
    const financialYear = String(input.financialYear || getCurrentFinancialYearLabel());

    if (!gstin || !month) {
      throw new Error('gstin and month are required');
    }

    const folderName = findFolderByGstin(gstin);
    if (!folderName) {
      throw new Error('Client not found for GSTIN');
    }

    const meta = readClientMeta(folderName);
    const clientName = meta?.clientName || folderName.replace(`_${gstin}`, '').replace(/_/g, ' ');

    ensureFyMonthFiles(folderName, financialYear, clientName, gstin);

    const filePath = path.join(clientsRoot, folderName, financialYear, `${month}.json`);
    const raw = fs.readFileSync(filePath, 'utf8');
    return normalizeMonthPayload(JSON.parse(raw));
  }

  function saveMonthData(input) {
    ensureClientsRoot();

    const gstin = String(input.gstin || '').trim().toUpperCase();
    const month = String(input.month || '').trim();
    const financialYear = String(input.financialYear || getCurrentFinancialYearLabel());
    const payload = input.payload;

    if (!gstin || !month || !payload) {
      throw new Error('gstin, month and payload are required');
    }

    const folderName = findFolderByGstin(gstin);
    if (!folderName) {
      throw new Error('Client not found for GSTIN');
    }

    const meta = readClientMeta(folderName);
    const clientName = meta?.clientName || folderName.replace(`_${gstin}`, '').replace(/_/g, ' ');

    ensureFyMonthFiles(folderName, financialYear, clientName, gstin);

    const filePath = path.join(clientsRoot, folderName, financialYear, `${month}.json`);
    fs.writeFileSync(filePath, JSON.stringify(normalizeMonthPayload(payload), null, 2), 'utf8');
    invalidateYearlyCache(gstin, financialYear);

    return { ok: true, filePath };
  }

  function getMonthFileContext(gstin, financialYear, month) {
    const normalizedGstin = String(gstin || '').trim().toUpperCase();
    const normalizedMonth = String(month || '').trim();
    const normalizedFy = String(financialYear || getCurrentFinancialYearLabel());

    if (!normalizedGstin || !normalizedMonth) {
      throw new Error('gstin and month are required');
    }

    const folderName = findFolderByGstin(normalizedGstin);
    if (!folderName) {
      throw new Error('Client not found for GSTIN');
    }

    const meta = readClientMeta(folderName);
    const clientName = meta?.clientName || folderName.replace(`_${normalizedGstin}`, '').replace(/_/g, ' ');

    ensureFyMonthFiles(folderName, normalizedFy, clientName, normalizedGstin);

    return {
      folderName,
      clientName,
      gstin: normalizedGstin,
      financialYear: normalizedFy,
      month: normalizedMonth,
      filePath: path.join(clientsRoot, folderName, normalizedFy, `${normalizedMonth}.json`)
    };
  }

  function readMonthPayload(context) {
    if (!fs.existsSync(context.filePath)) {
      return getClientMonthTemplate(context.clientName, context.gstin, context.financialYear, context.month);
    }
    try {
      const raw = fs.readFileSync(context.filePath, 'utf8');
      return normalizeMonthPayload(JSON.parse(raw));
    } catch (err) {
      console.error(`Error reading month payload at ${context.filePath}:`, err);
      return getClientMonthTemplate(context.clientName, context.gstin, context.financialYear, context.month);
    }
  }

  function writeMonthPayload(context, payload) {
    fs.writeFileSync(context.filePath, JSON.stringify(normalizeMonthPayload(payload), null, 2), 'utf8');
    invalidateYearlyCache(context.gstin, context.financialYear);
  }

  function buildReturnStatusDetail(payload, financialYear, month, returnType) {
    const normalizedType = returnType === 'gstr3b' ? 'gstr3b' : 'gstr1';
    const historyKey = `${normalizedType}_history`;
    const rawStatus = payload?.returns?.[normalizedType];
    const visualStatus = inferVisualStatus(rawStatus, payload);
    const normalizedStatus = normalizeReturnStatus(rawStatus);
    const history = Array.isArray(payload?.returns?.[historyKey]) ? payload.returns[historyKey] : [];
    const dueMeta = normalizedStatus === 'filed' ? { dueDate: null, dueInDays: null, overdue: false } : getReturnDueMeta(financialYear, month, normalizedType);

    return {
      status: normalizedStatus,
      visualStatus,
      history,
      dueDate: dueMeta.dueDate,
      dueInDays: dueMeta.dueInDays,
      overdue: dueMeta.overdue
    };
  }

  function buildClientMonthReturnSnapshot(payload, financialYear, month) {
    const gstr1 = buildReturnStatusDetail(payload, financialYear, month, 'gstr1');
    const gstr3b = buildReturnStatusDetail(payload, financialYear, month, 'gstr3b');
    const pendingCount = [gstr1.visualStatus, gstr3b.visualStatus].filter((value) => value !== 'filed').length;
    const nearestDueDays = [gstr1.dueInDays, gstr3b.dueInDays].filter((value) => Number.isFinite(value));

    return {
      financialYear,
      month,
      gstr1,
      gstr3b,
      pendingCount,
      nearestDueInDays: nearestDueDays.length > 0 ? Math.min(...nearestDueDays) : null,
      hasOverdue: Boolean(gstr1.overdue || gstr3b.overdue)
    };
  }

  function loadClientStatus(input) {
    const financialYear = String(input.financialYear || getCurrentFinancialYearLabel());
    const month = String(input.month || '').trim();
    const includePreviousMonth = Boolean(input.includePreviousMonth);

    if (!month) {
      throw new Error('month is required');
    }

    const rows = getClients().map((client) => {
      const currentContext = getMonthFileContext(client.gstin, financialYear, month);
      const currentPayload = readMonthPayload(currentContext);
      const current = buildClientMonthReturnSnapshot(currentPayload, currentContext.financialYear, currentContext.month);

      let previous = null;
      if (includePreviousMonth) {
        const previousPeriod = getPreviousFinancialPeriod(financialYear, month);
        const previousContext = getMonthFileContext(client.gstin, previousPeriod.financialYear, previousPeriod.month);
        const previousPayload = readMonthPayload(previousContext);
        previous = buildClientMonthReturnSnapshot(previousPayload, previousContext.financialYear, previousContext.month);
      }

      return {
        folderName: client.folderName,
        clientName: client.clientName,
        gstin: client.gstin,
        clientType: client.clientType,
        status: client.status,
        financialYears: client.financialYears,
        current,
        previous
      };
    });

    return {
      ok: true,
      financialYear,
      month,
      includePreviousMonth,
      rows
    };
  }

  function updateReturnStatus(input) {
    const gstin = String(input.gstin || '').trim().toUpperCase();
    const month = String(input.month || '').trim();
    const financialYear = String(input.financialYear || getCurrentFinancialYearLabel());
    const returnType = String(input.returnType || '').trim().toLowerCase();
    const nextStatus = normalizeReturnStatus(input.status || 'filed');

    if (!gstin || !month) {
      throw new Error('gstin and month are required');
    }

    if (!['gstr1', 'gstr3b'].includes(returnType)) {
      throw new Error('returnType must be either gstr1 or gstr3b');
    }

    const context = getMonthFileContext(gstin, financialYear, month);
    const payload = readMonthPayload(context);

    payload.returns = payload.returns || {};
    payload.returns[returnType] = nextStatus;

    if (nextStatus === 'filed') {
      const historyKey = `${returnType}_history`;
      const history = Array.isArray(payload.returns[historyKey]) ? payload.returns[historyKey] : [];
      history.unshift({
        filedAt: new Date().toISOString(),
        month: context.month,
        financialYear: context.financialYear
      });
      payload.returns[historyKey] = history.slice(0, 24);
    }

    writeMonthPayload(context, payload);

    return {
      ok: true,
      gstin: context.gstin,
      financialYear: context.financialYear,
      month: context.month,
      returnType,
      status: nextStatus,
      returns: buildClientMonthReturnSnapshot(payload, context.financialYear, context.month)
    };
  }

  function loadSuppliers(input) {
    return listParties(input, 'supplier');
  }

  function saveSupplier(input) {
    const result = saveParty(input, 'supplier');
    return { ok: true, created: result.created, supplier: result.party };
  }

  function updateSupplier(input) {
    const result = updateParty(input, 'supplier');
    return { ok: true, supplier: result.party };
  }

  function deleteSupplier(input) {
    return deleteParty(input, 'supplier');
  }

  function toggleSupplierFavorite(input) {
    return togglePartyFavorite(input, 'supplier');
  }

  function purchaseDuplicateExists(purchases, supplierGstin, invoiceNo, exceptId) {
    const gstin = String(supplierGstin || '').trim().toUpperCase();
    const invoice = String(invoiceNo || '').trim().toUpperCase();
    return purchases.some((row) => {
      if (exceptId && String(row.id || '') === String(exceptId)) return false;
      return (
        String(row.supplier_gstin || '').trim().toUpperCase() === gstin &&
        String(row.invoice_no || '').trim().toUpperCase() === invoice
      );
    });
  }

  function validatePurchaseInput(input) {
    const purchase = input.purchase || {};
    const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
    const supplierGstin = String(purchase.supplier_gstin || '').trim().toUpperCase();
    const invoiceNo = String(purchase.invoice_no || '').trim();

    if (!GSTIN_REGEX.test(supplierGstin)) {
      throw new Error('Valid supplier GSTIN is required');
    }
    if (!invoiceNo) {
      throw new Error('Invoice number is required');
    }
  }

  function savePurchase(input) {
    validatePurchaseInput(input);

    const context = getMonthFileContext(input.gstin, input.financialYear, input.month);
    const payload = readMonthPayload(context);
    const purchase = input.purchase || {};
    const id = purchase.id || `${purchase.invoice_no}-${Date.now()}`;

    if (purchaseDuplicateExists(payload.purchases, purchase.supplier_gstin, purchase.invoice_no, purchase.id)) {
      throw new Error('Duplicate purchase: supplier GSTIN + invoice number already exists');
    }

    const record = {
      ...purchase,
      id,
      source: purchase.source || 'manual'
    };

    payload.purchases.push(record);
    writeMonthPayload(context, payload);

    if (record.supplier_gstin && record.supplier_name) {
      saveSupplier({
        gstin: input.gstin,
        supplier: {
          gstin: record.supplier_gstin,
          name: record.supplier_name,
          state: record.place_of_supply || ''
        }
      });
    }

    return { ok: true, purchase: record };
  }

  function loadPurchase(input) {
    const context = getMonthFileContext(input.gstin, input.financialYear, input.month);
    const payload = readMonthPayload(context);

    const query = String(input.query || '').trim().toLowerCase();
    const fromDate = String(input.fromDate || '').trim();
    const toDate = String(input.toDate || '').trim();

    const rows = payload.purchases.filter((row) => {
      const date = String(row.date || '');
      const gstin = String(row.supplier_gstin || '').toLowerCase();
      const supplierName = String(row.supplier_name || '').toLowerCase();
      const invoice = String(row.invoice_no || '').toLowerCase();

      if (query && !gstin.includes(query) && !supplierName.includes(query) && !invoice.includes(query)) {
        return false;
      }
      if (fromDate && date < fromDate) return false;
      if (toDate && date > toDate) return false;
      return true;
    });

    return rows;
  }

  function deletePurchase(input) {
    const context = getMonthFileContext(input.gstin, input.financialYear, input.month);
    const payload = readMonthPayload(context);
    const id = String(input.id || '').trim();

    if (!id) {
      throw new Error('Purchase id is required');
    }

    const before = payload.purchases.length;
    payload.purchases = payload.purchases.filter((row) => String(row.id || '') !== id);

    if (payload.purchases.length === before) {
      throw new Error('Purchase record not found');
    }

    writeMonthPayload(context, payload);
    return { ok: true };
  }

  function parseImportedPurchaseRows(sheetRows) {
    if (!Array.isArray(sheetRows) || sheetRows.length === 0) {
      return { requiredMissing: ['No data rows found'], mappedRows: [] };
    }

    const aliases = {
      supplierGstin: ['gstinofsupplier', 'suppliergstin', 'ctingstin', 'gstin'],
      invoiceNo: ['invoicenumber', 'invoice no', 'invoiceno'],
      invoiceDate: ['invoicedate', 'invoice date', 'date'],
      invoiceValue: ['invoicevalue', 'invoice value', 'totalvalue'],
      taxableValue: ['taxablevalue', 'taxable value', 'taxable'],
      igst: ['igst', 'igstamount'],
      cgst: ['cgst', 'cgstamount'],
      sgst: ['sgst', 'sgstamount']
    };

    const firstRow = sheetRows[0];
    const keyMap = {};

    Object.keys(firstRow).forEach((header) => {
      const normalizedHeader = normalizeHeaderName(header);
      Object.entries(aliases).forEach(([field, list]) => {
        if (!keyMap[field] && list.includes(normalizedHeader)) {
          keyMap[field] = header;
        }
      });
    });

    const requiredFields = ['supplierGstin', 'invoiceNo', 'invoiceDate', 'taxableValue'];
    const requiredMissing = requiredFields.filter((field) => !keyMap[field]);
    if (requiredMissing.length > 0) {
      return {
        requiredMissing,
        mappedRows: []
      };
    }

    const mappedRows = sheetRows.map((row, idx) => {
      const supplierGstin = String(row[keyMap.supplierGstin] || '').trim().toUpperCase();
      const invoiceNo = String(row[keyMap.invoiceNo] || '').trim();
      const date = String(row[keyMap.invoiceDate] || '').trim();
      const taxableValue = Number(row[keyMap.taxableValue] || 0);
      const igst = Number(row[keyMap.igst] || 0);
      const cgst = Number(row[keyMap.cgst] || 0);
      const sgst = Number(row[keyMap.sgst] || 0);
      const invoiceValue = Number(row[keyMap.invoiceValue] || taxableValue + igst + cgst + sgst);

      return {
        id: `import-${idx + 1}-${Date.now()}`,
        type: 'B2B',
        supplier_gstin: supplierGstin,
        supplier_name: '',
        invoice_no: invoiceNo,
        date,
        taxable_value: Number(taxableValue || 0),
        igst: Number(igst || 0),
        cgst: Number(cgst || 0),
        sgst: Number(sgst || 0),
        total: Number(invoiceValue || 0),
        source: 'import'
      };
    });

    return { requiredMissing: [], mappedRows };
  }

  function previewPurchaseImport(input) {
    const context = getMonthFileContext(input.gstin, input.financialYear, input.month);
    const payload = readMonthPayload(context);
    const filePath = String(input.filePath || '').trim();

    if (!filePath) {
      throw new Error('File path is required for preview');
    }

    if (!fs.existsSync(filePath)) {
      throw new Error('Selected file not found');
    }

    if (!filePath.toLowerCase().endsWith('.xlsx')) {
      throw new Error('Invalid file format. Please upload .xlsx');
    }

    const workbook = XLSX.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('No worksheet found in Excel file');
    }

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: '' });
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('Excel file is empty');
    }

    const parsed = parseImportedPurchaseRows(rows);
    if (parsed.requiredMissing.length > 0) {
      return {
        ok: false,
        warning: 'Required columns missing',
        requiredMissing: parsed.requiredMissing,
        rows: [],
        summary: {
          total: 0,
          valid: 0,
          duplicates: 0,
          errors: 0
        }
      };
    }

    const previewRows = [];
    const seenKeys = new Set();
    let valid = 0;
    let duplicates = 0;
    let errors = 0;

    parsed.mappedRows.forEach((row, index) => {
      if (index >= 100) return;

      const statusErrors = [];
      if (!String(row.supplier_gstin || '').trim()) statusErrors.push('GSTIN missing');
      if (!String(row.invoice_no || '').trim()) statusErrors.push('Invoice number missing');
      if (Number(row.taxable_value || 0) <= 0) statusErrors.push('Taxable value must be greater than 0');

      const key = `${String(row.supplier_gstin || '').toUpperCase()}::${String(row.invoice_no || '').toUpperCase()}`;
      const existsInJson = purchaseDuplicateExists(payload.purchases, row.supplier_gstin, row.invoice_no);
      const existsInFile = seenKeys.has(key);
      if (!statusErrors.length) {
        seenKeys.add(key);
      }

      let status = 'valid';
      let message = '';

      if (statusErrors.length > 0) {
        status = 'error';
        message = statusErrors.join(', ');
        errors += 1;
      } else if (existsInJson || existsInFile) {
        status = 'duplicate';
        message = 'Duplicate supplier GSTIN + invoice number';
        duplicates += 1;
      } else {
        valid += 1;
      }

      previewRows.push({
        ...row,
        status,
        message
      });
    });

    return {
      ok: true,
      warning: '',
      requiredMissing: [],
      rows: previewRows,
      summary: {
        total: previewRows.length,
        valid,
        duplicates,
        errors
      }
    };
  }

  function importPurchaseData(input) {
    const context = getMonthFileContext(input.gstin, input.financialYear, input.month);
    const payload = readMonthPayload(context);
    const previewData = Array.isArray(input.previewData) ? input.previewData : [];
    const overwrite = Boolean(input.overwrite);

    if (previewData.length === 0) {
      throw new Error('No preview rows found to import');
    }

    let imported = 0;
    let duplicates = 0;
    let errors = 0;

    previewData.forEach((row) => {
      const status = String(row.status || '');
      if (status === 'error') {
        errors += 1;
        return;
      }

      if (status === 'duplicate' && !overwrite) {
        duplicates += 1;
        return;
      }

      const record = {
        id: row.id || `import-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'B2B',
        supplier_gstin: String(row.supplier_gstin || '').trim().toUpperCase(),
        supplier_name: String(row.supplier_name || '').trim(),
        invoice_no: String(row.invoice_no || '').trim(),
        date: String(row.date || '').trim(),
        taxable_value: Number(row.taxable_value || 0),
        igst: Number(row.igst || 0),
        cgst: Number(row.cgst || 0),
        sgst: Number(row.sgst || 0),
        total: Number(row.total || 0),
        source: 'import'
      };

      const existing = payload.purchases.find(
        (entry) =>
          String(entry.supplier_gstin || '').trim().toUpperCase() === record.supplier_gstin &&
          String(entry.invoice_no || '').trim().toUpperCase() === String(record.invoice_no || '').trim().toUpperCase()
      );

      if (existing && !overwrite) {
        duplicates += 1;
        return;
      }

      if (existing && overwrite) {
        Object.assign(existing, record);
        imported += 1;
        return;
      }

      payload.purchases.push(record);
      imported += 1;
    });

    writeMonthPayload(context, payload);

    return {
      total: previewData.length,
      imported,
      duplicates,
      errors
    };
  }

  function parseImportedSalesRows(sheetRows) {
    if (!Array.isArray(sheetRows) || sheetRows.length === 0) {
      return { requiredMissing: ['No data rows found'], mappedRows: [] };
    }

    const aliases = {
      buyerGstin: ['gstinuinofrecipient', 'buyergstin', 'gstin', 'receivergstin'],
      buyerName: ['receivername', 'buyername', 'name'],
      invoiceNo: ['invoicenumber', 'invoice no', 'invoiceno'],
      invoiceDate: ['invoicedate', 'invoice date', 'date'],
      invoiceValue: ['invoicevalue', 'invoice value', 'totalvalue'],
      taxableValue: ['taxablevalue', 'taxable value', 'taxable'],
      gstRate: ['rate', 'gstrate', 'taxrate'],
      igst: ['igst', 'igstamount'],
      cgst: ['cgst', 'cgstamount'],
      sgst: ['sgst', 'sgstamount'],
      placeOfSupply: ['placeofsupply', 'pos', 'supplyplace']
    };

    const firstRow = sheetRows[0];
    const keyMap = {};

    Object.keys(firstRow).forEach((header) => {
      const normalizedHeader = normalizeHeaderName(header);
      Object.entries(aliases).forEach(([field, list]) => {
        if (!keyMap[field] && list.includes(normalizedHeader)) {
          keyMap[field] = header;
        }
      });
    });

    const requiredFields = ['buyerGstin', 'invoiceNo', 'invoiceDate', 'taxableValue'];
    const requiredMissing = requiredFields.filter((field) => !keyMap[field]);
    if (requiredMissing.length > 0) {
      return { requiredMissing, mappedRows: [] };
    }

    const mappedRows = sheetRows.map((row, idx) => {
      const buyerGstin = String(row[keyMap.buyerGstin] || '').trim().toUpperCase();
      const buyerName = String(row[keyMap.buyerName] || '').trim();
      const invoiceNo = String(row[keyMap.invoiceNo] || '').trim();
      const date = String(row[keyMap.invoiceDate] || '').trim();
      const taxableValue = Number(row[keyMap.taxableValue] || 0);
      const gstRate = Number(row[keyMap.gstRate] || 18);
      const igst = Number(row[keyMap.igst] || 0);
      const cgst = Number(row[keyMap.cgst] || 0);
      const sgst = Number(row[keyMap.sgst] || 0);
      const invoiceValue = Number(row[keyMap.invoiceValue] || taxableValue + igst + cgst + sgst);
      const placeOfSupply = String(row[keyMap.placeOfSupply] || '').trim();

      return {
        id: `import-sales-${idx + 1}-${Date.now()}`,
        invoice_no: invoiceNo,
        date,
        buyer_gstin: buyerGstin,
        buyer_name: buyerName,
        place_of_supply: placeOfSupply,
        taxable_value: taxableValue,
        gst_amount: igst + cgst + sgst,
        total_value: invoiceValue,
        items: [{
          sr_no: 1,
          description: 'Imported Item',
          hsn_sac: '',
          quantity: 1,
          rate: taxableValue,
          taxable_value: taxableValue,
          gst_rate: gstRate,
          igst,
          cgst,
          sgst,
          total_amount: invoiceValue
        }],
        source: 'import'
      };
    });

    return { requiredMissing: [], mappedRows };
  }

  function previewSalesImport(input) {
    const context = getMonthFileContext(input.gstin, input.financialYear, input.month);
    const payload = readMonthPayload(context);
    const filePath = String(input.filePath || '').trim();

    if (!filePath) throw new Error('File path is required');
    if (!fs.existsSync(filePath)) throw new Error('File not found');

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

    const parsed = parseImportedSalesRows(rows);
    if (parsed.requiredMissing.length > 0) {
      return { ok: false, warning: 'Required columns missing', requiredMissing: parsed.requiredMissing, rows: [], summary: { total: 0, valid: 0, duplicates: 0, errors: 0 } };
    }

    const previewRows = [];
    let valid = 0, duplicates = 0, errors = 0;

    parsed.mappedRows.forEach((row, index) => {
      const statusErrors = [];
      if (!row.buyer_gstin) statusErrors.push('GSTIN missing');
      if (!row.invoice_no) statusErrors.push('Invoice No missing');
      
      const isDuplicate = payload.sales.b2b.some(e => e.invoice_no === row.invoice_no && e.buyer_gstin === row.buyer_gstin);

      if (statusErrors.length > 0) {
        row.status = 'error';
        row.errorMessage = statusErrors.join(', ');
        errors++;
      } else if (isDuplicate) {
        row.status = 'duplicate';
        duplicates++;
      } else {
        row.status = 'valid';
        valid++;
      }
      previewRows.push(row);
    });

    return { ok: true, rows: previewRows, summary: { total: previewRows.length, valid, duplicates, errors }, requiredMissing: [] };
  }

  function importSalesData(input) {
    const context = getMonthFileContext(input.gstin, input.financialYear, input.month);
    const payload = readMonthPayload(context);
    const previewData = Array.isArray(input.previewData) ? input.previewData : [];
    const overwrite = Boolean(input.overwrite);

    let imported = 0;
    previewData.forEach((row) => {
      if (row.status === 'error') return;
      if (row.status === 'duplicate' && !overwrite) return;

      const existingIdx = payload.sales.b2b.findIndex(e => e.invoice_no === row.invoice_no && e.buyer_gstin === row.buyer_gstin);
      if (existingIdx >= 0) {
        if (overwrite) {
          payload.sales.b2b[existingIdx] = { ...payload.sales.b2b[existingIdx], ...row, status: undefined };
          imported++;
        }
      } else {
        payload.sales.b2b.push({ ...row, status: undefined });
        imported++;
      }
      
      // Also save to customer master
      if (row.buyer_gstin && row.buyer_name) {
        saveCustomer({
          gstin: input.gstin,
          customer: { gstin: row.buyer_gstin, name: row.buyer_name, state: row.place_of_supply }
        });
      }
    });

    writeMonthPayload(context, payload);
    return { imported };
  }

  function importPurchase(input) {
    const context = getMonthFileContext(input.gstin, input.financialYear, input.month);
    const payload = readMonthPayload(context);

    if (!input.fileBuffer || !Array.isArray(input.fileBuffer)) {
      throw new Error('Invalid file content for import');
    }

    const workbook = XLSX.read(Buffer.from(input.fileBuffer), { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('No worksheet found in Excel file');
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const parsed = parseImportedPurchaseRows(rows);
    if (parsed.requiredMissing.length > 0) {
      return {
        ok: false,
        requiredMissing: parsed.requiredMissing,
        preview: []
      };
    }

    const preview = parsed.mappedRows;
    if (input.dryRun) {
      const duplicateRows = preview.filter((row) =>
        purchaseDuplicateExists(payload.purchases, row.supplier_gstin, row.invoice_no)
      );

      return {
        ok: true,
        requiredMissing: [],
        preview,
        duplicates: duplicateRows.map((row) => ({
          supplier_gstin: row.supplier_gstin,
          invoice_no: row.invoice_no
        }))
      };
    }

    let imported = 0;
    let skipped = 0;
    const overwrite = Boolean(input.overwrite);
    const duplicates = [];

    preview.forEach((row) => {
      const duplicate = payload.purchases.find(
        (existing) =>
          String(existing.supplier_gstin || '').trim().toUpperCase() === String(row.supplier_gstin || '').trim().toUpperCase() &&
          String(existing.invoice_no || '').trim().toUpperCase() === String(row.invoice_no || '').trim().toUpperCase()
      );

      if (!duplicate) {
        payload.purchases.push(row);
        imported += 1;
        return;
      }

      if (!overwrite) {
        skipped += 1;
        duplicates.push({ supplier_gstin: row.supplier_gstin, invoice_no: row.invoice_no });
        return;
      }

      Object.assign(duplicate, row);
      imported += 1;
    });

    writeMonthPayload(context, payload);

    return {
      ok: true,
      imported,
      skipped,
      duplicates,
      preview
    };
  }

  function validateSaleInput(input) {
    const saleType = String(input.saleType || '').toLowerCase();
    if (!['b2b', 'b2c'].includes(saleType)) {
      throw new Error('saleType must be b2b or b2c');
    }

    const sale = input.sale || {};
    if (!String(sale.invoice_no || '').trim()) {
      throw new Error('Invoice number is required');
    }

    if (!Array.isArray(sale.items) || sale.items.length === 0) {
      throw new Error('At least one sale item is required');
    }

    sale.items.forEach((item, idx) => {
      const quantity = Number(item.quantity || 0);
      const rate = Number(item.rate || 0);
      if (quantity <= 0) {
        throw new Error(`Item ${idx + 1}: Quantity must be greater than 0`);
      }
      if (rate <= 0) {
        throw new Error(`Item ${idx + 1}: Rate must be greater than 0`);
      }
    });

    if (saleType === 'b2b') {
      const gstin = String(sale.buyer_gstin || '').toUpperCase();
      const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
      if (!GSTIN_REGEX.test(gstin)) {
        throw new Error('Valid buyer GSTIN is required for B2B');
      }
    }
  }

  function saveSale(input) {
    validateSaleInput(input);

    const context = getMonthFileContext(input.gstin, input.financialYear, input.month);
    const payload = readMonthPayload(context);
    const saleType = String(input.saleType || '').toLowerCase();
    const sale = input.sale;

    const record = {
      ...sale,
      id: sale.id || `${sale.invoice_no}-${Date.now()}`
    };

    payload.sales[saleType].push(record);
    writeMonthPayload(context, payload);

    if (saleType === 'b2b') {
      const buyerGstin = String(record.buyer_gstin || '').trim().toUpperCase();
      const buyerName = String(record.buyer_name || '').trim();
      const buyerState = String(record.place_of_supply || '').trim();

      if (buyerGstin && buyerName) {
        saveCustomer({
          gstin: input.gstin,
          customer: {
            gstin: buyerGstin,
            name: buyerName,
            state: buyerState
          }
        });
      }
    }

    return { ok: true, sale: record };
  }

  function loadSales(input) {
    const context = getMonthFileContext(input.gstin, input.financialYear, input.month);
    const payload = readMonthPayload(context);

    const invoiceQuery = String(input.invoiceQuery || '').trim().toLowerCase();
    const fromDate = String(input.fromDate || '').trim();
    const toDate = String(input.toDate || '').trim();

    function byFilters(sale) {
      const invoice = String(sale.invoice_no || '').toLowerCase();
      const date = String(sale.date || '');

      if (invoiceQuery && !invoice.includes(invoiceQuery)) return false;
      if (fromDate && date < fromDate) return false;
      if (toDate && date > toDate) return false;
      return true;
    }

    return {
      b2b: payload.sales.b2b.filter(byFilters),
      b2c: payload.sales.b2c.filter(byFilters)
    };
  }

  function deleteSale(input) {
    const saleType = String(input.saleType || '').toLowerCase();
    if (!['b2b', 'b2c'].includes(saleType)) {
      throw new Error('saleType must be b2b or b2c');
    }

    const context = getMonthFileContext(input.gstin, input.financialYear, input.month);
    const payload = readMonthPayload(context);
    const id = String(input.id || '').trim();
    const invoiceNo = String(input.invoiceNo || '').trim();

    const originalLength = payload.sales[saleType].length;
    payload.sales[saleType] = payload.sales[saleType].filter((sale) => {
      if (id) return String(sale.id || '') !== id;
      return String(sale.invoice_no || '') !== invoiceNo;
    });

    if (payload.sales[saleType].length === originalLength) {
      throw new Error('Sale record not found');
    }

    writeMonthPayload(context, payload);
    return { ok: true };
  }

  function updateSale(input) {
    validateSaleInput(input);

    const saleType = String(input.saleType || '').toLowerCase();
    const context = getMonthFileContext(input.gstin, input.financialYear, input.month);
    const payload = readMonthPayload(context);
    const sale = input.sale;
    const id = String(sale.id || '').trim();

    if (!id) {
      throw new Error('Sale id is required for update');
    }

    const index = payload.sales[saleType].findIndex((s) => String(s.id || '') === id);
    if (index === -1) {
      throw new Error('Sale record not found for update');
    }

    // Preserve original id, replace everything else
    const updated = { ...sale, id };
    payload.sales[saleType][index] = updated;
    writeMonthPayload(context, payload);

    return { ok: true, sale: updated };
  }

  function exportSales(input) {
    const context = getMonthFileContext(input.gstin, input.financialYear, input.month);

    if (!fs.existsSync(context.filePath)) {
      throw new Error('Month data file not found for export');
    }

    const payload = readMonthPayload(context);
    const fyDir = path.dirname(context.filePath);
    fs.mkdirSync(fyDir, { recursive: true });

    const b2bRows = [];
    payload.sales.b2b.forEach((sale) => {
      const items = Array.isArray(sale.items) ? sale.items : [];
      items.forEach((item) => {
        b2bRows.push({
          'GSTIN of Buyer': sale.buyer_gstin || '',
          'Invoice Number': sale.invoice_no || '',
          'Invoice Date': sale.date || '',
          'Invoice Value': Number(sale.total_value || 0),
          'Place of Supply': sale.place_of_supply || '',
          'Taxable Value': Number(item.taxable_value || 0),
          'GST Rate': Number(item.gst_rate || 0),
          'IGST Amount': Number(item.igst || 0),
          'CGST Amount': Number(item.cgst || 0),
          'SGST Amount': Number(item.sgst || 0)
        });
      });
    });

    const b2cRows = [];
    payload.sales.b2c.forEach((sale) => {
      const items = Array.isArray(sale.items) ? sale.items : [];
      items.forEach((item) => {
        b2cRows.push({
          Type: sale.type || 'B2C Small',
          'Place of Supply': sale.place_of_supply || '',
          'Invoice Number': sale.invoice_no || '',
          'Invoice Date': sale.date || '',
          'Taxable Value': Number(item.taxable_value || 0),
          'GST Rate': Number(item.gst_rate || 0),
          'IGST Amount': Number(item.igst || 0),
          'CGST Amount': Number(item.cgst || 0),
          'SGST Amount': Number(item.sgst || 0),
          'Total Invoice Value': Number(sale.total_value || 0)
        });
      });
    });

    const workbook = XLSX.utils.book_new();
    const b2bSheet = XLSX.utils.json_to_sheet(b2bRows, {
      header: [
        'GSTIN of Buyer',
        'Invoice Number',
        'Invoice Date',
        'Invoice Value',
        'Place of Supply',
        'Taxable Value',
        'GST Rate',
        'IGST Amount',
        'CGST Amount',
        'SGST Amount'
      ]
    });
    const b2cSheet = XLSX.utils.json_to_sheet(b2cRows, {
      header: [
        'Type',
        'Place of Supply',
        'Invoice Number',
        'Invoice Date',
        'Taxable Value',
        'GST Rate',
        'IGST Amount',
        'CGST Amount',
        'SGST Amount',
        'Total Invoice Value'
      ]
    });

    XLSX.utils.book_append_sheet(workbook, b2bSheet, 'B2B');
    XLSX.utils.book_append_sheet(workbook, b2cSheet, 'B2C');

    const filePath = path.join(fyDir, `Sales_${context.month}.xlsx`);
    XLSX.writeFile(workbook, filePath);

    return {
      ok: true,
      filePath,
      b2bCount: b2bRows.length,
      b2cCount: b2cRows.length,
      isEmpty: b2bRows.length === 0 && b2cRows.length === 0
    };
  }

  function loadGstr1Data(input) {
    const context = getMonthFileContext(input.gstin, input.financialYear, input.month);
    const payload = readMonthPayload(context);
    const snapshot = buildGstr1Snapshot(payload, context.gstin);

    return {
      ok: true,
      clientName: context.clientName,
      gstin: context.gstin,
      financialYear: context.financialYear,
      month: context.month,
      ...snapshot
    };
  }

  function saveGstr1Data(input) {
    const context = getMonthFileContext(input.gstin, input.financialYear, input.month);
    const payload = readMonthPayload(context);
    const editedRows = Array.isArray(input.b2bRows) ? input.b2bRows : [];

    const saleIndexMap = new Map();
    payload.sales.b2b.forEach((sale, idx) => {
      saleIndexMap.set(String(sale.id || ''), idx);
    });

    editedRows.forEach((row) => {
      const saleId = String(row._saleId || '');
      const itemSrNo = Number(row._itemSrNo || 0);
      if (!saleId || !itemSrNo) return;

      const saleIdx = saleIndexMap.get(saleId);
      if (saleIdx === undefined) return;

      const sale = payload.sales.b2b[saleIdx];
      const itemIdx = (Array.isArray(sale.items) ? sale.items : []).findIndex((item) => Number(item.sr_no || 0) === itemSrNo);
      if (itemIdx < 0) return;

      sale.buyer_gstin = normalizeGstin(row['GSTIN/UIN of Recipient']);
      sale.buyer_name = String(row['Receiver Name'] || '').trim();
      sale.invoice_no = String(row['Invoice Number'] || '').trim();
      sale.reverse_charge = row['Reverse Charge'] === 'Yes' ? 'Yes' : 'No';

      const posCode = getStateCodeFromValue(row['Place Of Supply']);
      if (posCode) {
        sale.place_of_supply = STATE_CODE_TO_NAME[posCode] || row['Place Of Supply'];
      }

      const item = sale.items[itemIdx];
      item.gst_rate = toNum(row.Rate);
      item.taxable_value = to2(toNum(row['Taxable Value']));
      const rate = toNum(item.gst_rate);
      const taxable = toNum(item.taxable_value);
      const taxAmount = to2((taxable * rate) / 100);

      const buyerState = String(sale.buyer_gstin || '').slice(0, 2);
      const sellerState = String(context.gstin || '').slice(0, 2);
      if (buyerState && buyerState !== sellerState) {
        item.igst = taxAmount;
        item.cgst = 0;
        item.sgst = 0;
      } else {
        const half = to2(taxAmount / 2);
        item.igst = 0;
        item.cgst = half;
        item.sgst = half;
      }
      item.total_amount = to2(taxable + toNum(item.igst) + toNum(item.cgst) + toNum(item.sgst));
    });

    payload.sales.b2b = payload.sales.b2b.filter((sale) => {
      const key = normalizeInvoice(sale.invoice_no);
      if (!key) return false;
      return true;
    });

    const dedupe = new Set();
    payload.sales.b2b = payload.sales.b2b.filter((sale) => {
      const key = normalizeInvoice(sale.invoice_no);
      if (dedupe.has(key)) return false;
      dedupe.add(key);
      return true;
    });

    payload.sales.b2b.forEach((sale) => {
      const totals = (Array.isArray(sale.items) ? sale.items : []).reduce(
        (acc, item) => {
          acc.taxable += toNum(item.taxable_value);
          acc.gst += toNum(item.igst) + toNum(item.cgst) + toNum(item.sgst);
          acc.total += toNum(item.total_amount || item.total || 0);
          return acc;
        },
        { taxable: 0, gst: 0, total: 0 }
      );

      sale.taxable_value = to2(totals.taxable);
      sale.gst_amount = to2(totals.gst);
      sale.total_value = to2(totals.total || totals.taxable + totals.gst);
    });

    writeMonthPayload(context, payload);
    return loadGstr1Data(input);
  }

  function markGstr1Filed(input) {
    const result = updateReturnStatus({
      gstin: input.gstin,
      financialYear: input.financialYear,
      month: input.month,
      returnType: 'gstr1',
      status: 'filed'
    });
    return {
      ok: true,
      status: 'filed',
      history: result.returns.gstr1.history
    };
  }

  function exportGstr1(input) {
    const context = getMonthFileContext(input.gstin, input.financialYear, input.month);
    const payload = readMonthPayload(context);
    const snapshot = buildGstr1Snapshot(payload, context.gstin);

    const workbook = XLSX.utils.book_new();
    const b2bSheet = XLSX.utils.json_to_sheet(snapshot.b2bRows.map((row) => ({
      'GSTIN/UIN of Recipient': row['GSTIN/UIN of Recipient'],
      'Receiver Name': row['Receiver Name'],
      'Invoice Number': row['Invoice Number'],
      'Invoice Date': row['Invoice Date'],
      'Invoice Value': row['Invoice Value'],
      'Place Of Supply': row['Place Of Supply'],
      'Reverse Charge': row['Reverse Charge'],
      'Applicable % of Tax Rate': row['Applicable % of Tax Rate'],
      'Invoice Type': row['Invoice Type'],
      'E-Commerce GSTIN': row['E-Commerce GSTIN'],
      Rate: row.Rate,
      'Taxable Value': row['Taxable Value'],
      'Cess Amount': row['Cess Amount']
    })), {
      header: [
        'GSTIN/UIN of Recipient',
        'Receiver Name',
        'Invoice Number',
        'Invoice Date',
        'Invoice Value',
        'Place Of Supply',
        'Reverse Charge',
        'Applicable % of Tax Rate',
        'Invoice Type',
        'E-Commerce GSTIN',
        'Rate',
        'Taxable Value',
        'Cess Amount'
      ]
    });

    const b2clSheet = XLSX.utils.json_to_sheet(snapshot.b2clRows.map((row) => ({
      'Invoice Number': row['Invoice Number'],
      'Invoice Date': row['Invoice Date'],
      'Invoice Value': row['Invoice Value'],
      'Place Of Supply': row['Place Of Supply'],
      'Applicable %': row['Applicable %'],
      Rate: row.Rate,
      'Taxable Value': row['Taxable Value'],
      Cess: row.Cess
    })), {
      header: ['Invoice Number', 'Invoice Date', 'Invoice Value', 'Place Of Supply', 'Applicable %', 'Rate', 'Taxable Value', 'Cess']
    });

    const b2csSheet = XLSX.utils.json_to_sheet(snapshot.b2csRows.map((row) => ({
      Type: row.Type,
      'Place Of Supply': row['Place Of Supply'],
      'Applicable %': row['Applicable %'],
      Rate: row.Rate,
      'Taxable Value': row['Taxable Value'],
      Cess: row.Cess
    })), {
      header: ['Type', 'Place Of Supply', 'Applicable %', 'Rate', 'Taxable Value', 'Cess']
    });

    const hsnSheet = XLSX.utils.json_to_sheet(snapshot.hsnRows, {
      header: ['HSN', 'Description', 'UQC', 'Rate', 'Total Quantity', 'Total Value', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Cess']
    });

    XLSX.utils.book_append_sheet(workbook, b2bSheet, 'b2b');
    XLSX.utils.book_append_sheet(workbook, b2clSheet, 'b2cl');
    XLSX.utils.book_append_sheet(workbook, b2csSheet, 'b2cs');
    XLSX.utils.book_append_sheet(workbook, hsnSheet, 'hsn');

    const fyLabel = String(context.financialYear || '').replace(/^FY_/, '');
    const fileName = `GSTR1_${context.month}_${fyLabel}.xlsx`;
    const outPath = path.join(path.dirname(context.filePath), fileName);
    XLSX.writeFile(workbook, outPath);

    return {
      ok: true,
      filePath: outPath,
      warnings: snapshot.warnings,
      counts: {
        b2b: snapshot.b2bRows.length,
        b2cl: snapshot.b2clRows.length,
        b2cs: snapshot.b2csRows.length,
        hsn: snapshot.hsnRows.length
      }
    };
  }

  function sanitizeGstr3bAdjustments(input) {
    const source = input && typeof input === 'object' ? input : {};
    const strategy = String(source.igstCrossUtilizationStrategy || '').trim().toLowerCase();
    const igstCrossUtilizationStrategy = ['auto', 'prefer-cgst', 'prefer-sgst'].includes(strategy) ? strategy : 'auto';
    const utilizationModeRaw = String(source.utilizationMode || '').trim().toLowerCase();
    const utilizationMode = ['auto', 'manual'].includes(utilizationModeRaw) ? utilizationModeRaw : 'auto';
    const manualSource = source.manualUtilization && typeof source.manualUtilization === 'object' ? source.manualUtilization : {};
    const manualUtilization = {
      igstToIgst: to2(toNum(manualSource.igstToIgst)),
      igstToCgst: to2(toNum(manualSource.igstToCgst)),
      igstToSgst: to2(toNum(manualSource.igstToSgst)),
      cgstToCgst: to2(toNum(manualSource.cgstToCgst)),
      cgstToIgst: to2(toNum(manualSource.cgstToIgst)),
      sgstToSgst: to2(toNum(manualSource.sgstToSgst)),
      sgstToIgst: to2(toNum(manualSource.sgstToIgst))
    };

    return {
      zeroRatedTaxable: to2(toNum(source.zeroRatedTaxable)),
      zeroRatedIgst: to2(toNum(source.zeroRatedIgst)),
      nilExemptTaxable: to2(toNum(source.nilExemptTaxable)),
      nonGstTaxable: to2(toNum(source.nonGstTaxable)),
      itcReversedIgst: to2(toNum(source.itcReversedIgst)),
      itcReversedCgst: to2(toNum(source.itcReversedCgst)),
      itcReversedSgst: to2(toNum(source.itcReversedSgst)),
      utilizationMode,
      manualUtilization,
      igstCrossUtilizationStrategy
    };
  }

  function sumTaxFromItems(items) {
    return (Array.isArray(items) ? items : []).reduce(
      (acc, item) => {
        acc.taxable += toNum(item.taxable_value);
        acc.igst += toNum(item.igst);
        acc.cgst += toNum(item.cgst);
        acc.sgst += toNum(item.sgst);
        return acc;
      },
      { taxable: 0, igst: 0, cgst: 0, sgst: 0 }
    );
  }

  function buildGstr3bSnapshot(payload, sellerGstin, carryForwardITC) {
    const salesB2b = Array.isArray(payload?.sales?.b2b) ? payload.sales.b2b : [];
    const salesB2c = Array.isArray(payload?.sales?.b2c) ? payload.sales.b2c : [];
    const purchases = Array.isArray(payload?.purchases) ? payload.purchases : [];
    const adjustments = sanitizeGstr3bAdjustments(payload?.returns?.gstr3b_adjustments);
    const warnings = [];
    const sellerStateCode = String(sellerGstin || '').slice(0, 2);

    const outputTotals = [...salesB2b, ...salesB2c].reduce(
      (acc, sale) => {
        const tax = sumTaxFromItems(sale.items);
        acc.taxable += tax.taxable;
        acc.igst += tax.igst;
        acc.cgst += tax.cgst;
        acc.sgst += tax.sgst;
        return acc;
      },
      { taxable: 0, igst: 0, cgst: 0, sgst: 0 }
    );

    const purchaseTotals = purchases.reduce(
      (acc, row) => {
        acc.igst += toNum(row.igst);
        acc.cgst += toNum(row.cgst);
        acc.sgst += toNum(row.sgst);
        return acc;
      },
      { igst: 0, cgst: 0, sgst: 0 }
    );

    if (salesB2b.length + salesB2c.length === 0) {
      warnings.push('No sales data found for this period.');
    }

    if (purchases.length === 0) {
      warnings.push('No purchase data found for this period.');
    }

    const section31Rows = [
      {
        nature: 'Outward Taxable Supplies (B2B + B2C)',
        taxableValue: to2(outputTotals.taxable),
        igst: to2(outputTotals.igst),
        cgst: to2(outputTotals.cgst),
        sgst: to2(outputTotals.sgst)
      },
      {
        nature: 'Zero Rated Supplies',
        taxableValue: adjustments.zeroRatedTaxable,
        igst: adjustments.zeroRatedIgst,
        cgst: 0,
        sgst: 0
      },
      {
        nature: 'Nil Rated / Exempted Supplies',
        taxableValue: adjustments.nilExemptTaxable,
        igst: 0,
        cgst: 0,
        sgst: 0
      },
      {
        nature: 'Non-GST Supplies',
        taxableValue: adjustments.nonGstTaxable,
        igst: 0,
        cgst: 0,
        sgst: 0
      }
    ];

    const stateSummaryMap = new Map();
    salesB2c.forEach((sale) => {
      const posCode = getStateCodeFromValue(sale.place_of_supply);
      if (!posCode || posCode === sellerStateCode) return;

      const tax = sumTaxFromItems(sale.items);
      const stateName = STATE_CODE_TO_NAME[posCode] || String(sale.place_of_supply || posCode);
      const key = `${posCode}-${stateName}`;
      const current = stateSummaryMap.get(key) || {
        state: `${posCode}-${stateName}`,
        taxableValue: 0,
        igst: 0
      };

      current.taxableValue = to2(current.taxableValue + tax.taxable);
      current.igst = to2(current.igst + tax.igst);
      stateSummaryMap.set(key, current);
    });

    const section32Rows = Array.from(stateSummaryMap.values()).sort((a, b) => a.state.localeCompare(b.state));

    // Carry-forward balance from previous month (old setoff)
    const cfITC = carryForwardITC && typeof carryForwardITC === 'object'
      ? {
          igst: Math.max(0, to2(toNum(carryForwardITC.igst))),
          cgst: Math.max(0, to2(toNum(carryForwardITC.cgst))),
          sgst: Math.max(0, to2(toNum(carryForwardITC.sgst)))
        }
      : { igst: 0, cgst: 0, sgst: 0 };

    // Current month ITC (from purchases only, before carry-forward merge)
    const currentITC = {
      igst: to2(purchaseTotals.igst),
      cgst: to2(purchaseTotals.cgst),
      sgst: to2(purchaseTotals.sgst)
    };

    // finalITC = current + carry-forward (merged total available ITC)
    const itcAvailable = {
      igst: to2(currentITC.igst + cfITC.igst),
      cgst: to2(currentITC.cgst + cfITC.cgst),
      sgst: to2(currentITC.sgst + cfITC.sgst)
    };

    const itcReversed = {
      igst: to2(adjustments.itcReversedIgst),
      cgst: to2(adjustments.itcReversedCgst),
      sgst: to2(adjustments.itcReversedSgst)
    };

    const netItc = {
      igst: to2(itcAvailable.igst - itcReversed.igst),
      cgst: to2(itcAvailable.cgst - itcReversed.cgst),
      sgst: to2(itcAvailable.sgst - itcReversed.sgst)
    };

    if (netItc.igst < 0 || netItc.cgst < 0 || netItc.sgst < 0) {
      warnings.push('Negative ITC detected. Please verify reversal values.');
    }

    const section4Rows = [
      { type: 'ITC Available (from Purchases)', ...itcAvailable },
      { type: 'ITC Reversed', ...itcReversed },
      { type: 'Net ITC Available', ...netItc }
    ];

    const section5Rows = [
      { type: 'Nil Rated Supplies', taxableValue: adjustments.nilExemptTaxable },
      { type: 'Exempted Supplies', taxableValue: adjustments.nilExemptTaxable },
      { type: 'Non-GST Supplies', taxableValue: adjustments.nonGstTaxable }
    ];

    const taxPayable = {
      igst: to2(section31Rows.reduce((sum, row) => sum + toNum(row.igst), 0)),
      cgst: to2(section31Rows.reduce((sum, row) => sum + toNum(row.cgst), 0)),
      sgst: to2(section31Rows.reduce((sum, row) => sum + toNum(row.sgst), 0))
    };

    const remaining = {
      igst: to2(Math.max(0, taxPayable.igst)),
      cgst: to2(Math.max(0, taxPayable.cgst)),
      sgst: to2(Math.max(0, taxPayable.sgst))
    };

    const itc = {
      igst: to2(Math.max(0, netItc.igst)),
      cgst: to2(Math.max(0, netItc.cgst)),
      sgst: to2(Math.max(0, netItc.sgst))
    };

    const utilizationBySource = {
      igst: 0,
      cgst: 0,
      sgst: 0
    };

    const utilizationMatrix = {
      igstToIgst: 0,
      igstToCgst: 0,
      igstToSgst: 0,
      cgstToCgst: 0,
      cgstToIgst: 0,
      sgstToSgst: 0,
      sgstToIgst: 0
    };

    const utilize = (sourceTax, targetTax) => {
      const usable = to2(Math.min(itc[sourceTax], remaining[targetTax]));
      itc[sourceTax] = to2(Math.max(0, itc[sourceTax] - usable));
      remaining[targetTax] = to2(Math.max(0, remaining[targetTax] - usable));
      utilizationBySource[sourceTax] = to2(utilizationBySource[sourceTax] + usable);
      const matrixKey = `${sourceTax}To${String(targetTax).charAt(0).toUpperCase()}${String(targetTax).slice(1)}`;
      if (Object.prototype.hasOwnProperty.call(utilizationMatrix, matrixKey)) {
        utilizationMatrix[matrixKey] = to2(utilizationMatrix[matrixKey] + usable);
      }
      return usable;
    };

    const mode = adjustments.utilizationMode || 'auto';
    const manual = adjustments.manualUtilization || {};

    if (mode === 'manual') {
      const manualApply = (sourceTax, targetTax, requested, key) => {
        const wanted = to2(Math.max(0, toNum(requested)));
        const usable = to2(Math.min(wanted, itc[sourceTax], remaining[targetTax]));
        if (wanted > usable) {
          warnings.push(`Manual setoff capped for ${key}: requested ${wanted}, applied ${usable}`);
        }
        if (usable > 0) {
          itc[sourceTax] = to2(Math.max(0, itc[sourceTax] - usable));
          remaining[targetTax] = to2(Math.max(0, remaining[targetTax] - usable));
          utilizationBySource[sourceTax] = to2(utilizationBySource[sourceTax] + usable);
          utilizationMatrix[key] = to2(utilizationMatrix[key] + usable);
        }
      };

      // Manual GST Portal style editable setoff matrix with legal route constraints.
      manualApply('igst', 'igst', manual.igstToIgst, 'igstToIgst');
      manualApply('igst', 'cgst', manual.igstToCgst, 'igstToCgst');
      manualApply('igst', 'sgst', manual.igstToSgst, 'igstToSgst');
      console.log('[GSTR3B][ITC] After IGST utilization', {
        mode,
        remaining: { ...remaining },
        itc: { ...itc }
      });

      manualApply('cgst', 'cgst', manual.cgstToCgst, 'cgstToCgst');
      manualApply('cgst', 'igst', manual.cgstToIgst, 'cgstToIgst');
      console.log('[GSTR3B][ITC] After CGST utilization', {
        mode,
        remaining: { ...remaining },
        itc: { ...itc }
      });

      manualApply('sgst', 'sgst', manual.sgstToSgst, 'sgstToSgst');
      manualApply('sgst', 'igst', manual.sgstToIgst, 'sgstToIgst');
      console.log('[GSTR3B][ITC] After SGST utilization', {
        mode,
        remaining: { ...remaining },
        itc: { ...itc }
      });
    } else {
      // Step 1: IGST credit utilization -> IGST, then CGST/SGST per configured strategy
      utilize('igst', 'igst');

      const strategy = adjustments.igstCrossUtilizationStrategy || 'auto';
      let igstCrossOrder = ['cgst', 'sgst'];

      if (strategy === 'prefer-sgst') {
        igstCrossOrder = ['sgst', 'cgst'];
      } else if (strategy === 'auto') {
        const cgstDeficit = Math.max(0, remaining.cgst - itc.cgst);
        const sgstDeficit = Math.max(0, remaining.sgst - itc.sgst);
        igstCrossOrder = sgstDeficit > cgstDeficit ? ['sgst', 'cgst'] : ['cgst', 'sgst'];
      }

      igstCrossOrder.forEach((target) => utilize('igst', target));
      console.log('[GSTR3B][ITC] After IGST utilization', {
        mode,
        strategy,
        igstCrossOrder,
        remaining: { ...remaining },
        itc: { ...itc }
      });

      // Step 2: CGST credit utilization -> CGST, IGST (never SGST)
      utilize('cgst', 'cgst');
      utilize('cgst', 'igst');
      console.log('[GSTR3B][ITC] After CGST utilization', {
        mode,
        remaining: { ...remaining },
        itc: { ...itc }
      });

      // Step 3: SGST credit utilization -> SGST, IGST (never CGST)
      utilize('sgst', 'sgst');
      utilize('sgst', 'igst');
      console.log('[GSTR3B][ITC] After SGST utilization', {
        mode,
        remaining: { ...remaining },
        itc: { ...itc }
      });
    }

    const utilizedBySource = {
      igst: to2(utilizationBySource.igst),
      cgst: to2(utilizationBySource.cgst),
      sgst: to2(utilizationBySource.sgst)
    };

    const utilizedByLiability = {
      igst: to2(taxPayable.igst - remaining.igst),
      cgst: to2(taxPayable.cgst - remaining.cgst),
      sgst: to2(taxPayable.sgst - remaining.sgst)
    };

    const cashPayable = {
      igst: to2(Math.max(0, remaining.igst)),
      cgst: to2(Math.max(0, remaining.cgst)),
      sgst: to2(Math.max(0, remaining.sgst))
    };

    const section6Rows = [
      {
        taxType: 'IGST',
        taxPayable: taxPayable.igst,
        itcUtilized: utilizedByLiability.igst,
        cashPayable: cashPayable.igst
      },
      {
        taxType: 'CGST',
        taxPayable: taxPayable.cgst,
        itcUtilized: utilizedByLiability.cgst,
        cashPayable: cashPayable.cgst
      },
      {
        taxType: 'SGST',
        taxPayable: taxPayable.sgst,
        itcUtilized: utilizedByLiability.sgst,
        cashPayable: cashPayable.sgst
      }
    ];

    return {
      status: payload?.returns?.gstr3b || 'pending',
      filingHistory: Array.isArray(payload?.returns?.gstr3b_history) ? payload.returns.gstr3b_history : [],
      warnings,
      adjustments,
      utilizationMatrix,
      // ITC breakdown for UI display
      carryForwardITC: { igst: cfITC.igst, cgst: cfITC.cgst, sgst: cfITC.sgst },
      currentITC:      { igst: currentITC.igst, cgst: currentITC.cgst, sgst: currentITC.sgst },
      finalITC:        { igst: itcAvailable.igst, cgst: itcAvailable.cgst, sgst: itcAvailable.sgst },
      outputGST: {
        igst: taxPayable.igst,
        cgst: taxPayable.cgst,
        sgst: taxPayable.sgst
      },
      inputGST: {
        igst: netItc.igst,
        cgst: netItc.cgst,
        sgst: netItc.sgst
      },
      netGST: {
        igst: cashPayable.igst,
        cgst: cashPayable.cgst,
        sgst: cashPayable.sgst
      },
      payable: {
        igst: cashPayable.igst,
        cgst: cashPayable.cgst,
        sgst: cashPayable.sgst
      },
      utilized: {
        igst: utilizedBySource.igst,
        cgst: utilizedBySource.cgst,
        sgst: utilizedBySource.sgst
      },
      balance_itc: {
        igst: itc.igst,
        cgst: itc.cgst,
        sgst: itc.sgst
      },
      summary: {
        outputGst: to2(taxPayable.igst + taxPayable.cgst + taxPayable.sgst),
        inputGst: to2(Math.max(0, netItc.igst) + Math.max(0, netItc.cgst) + Math.max(0, netItc.sgst)),
        netPayable: to2(cashPayable.igst + cashPayable.cgst + cashPayable.sgst),
        output: {
          igst: taxPayable.igst,
          cgst: taxPayable.cgst,
          sgst: taxPayable.sgst
        },
        input: {
          igst: netItc.igst,
          cgst: netItc.cgst,
          sgst: netItc.sgst
        }
      },
      section31Rows,
      section32Rows,
      section4Rows,
      section5Rows,
      section6Rows
    };
  }

  function resolveGstinFromGstrPayload(input) {
    const rawGstin = String(input?.gstin || '').trim().toUpperCase();
    if (rawGstin) return rawGstin;

    const rawClient = String(input?.client || '').trim();
    if (!rawClient) {
      throw new Error('Client GSTIN is required');
    }

    const folderStyle = rawClient.match(/_([0-9]{2}[A-Z0-9]{13})$/i);
    if (folderStyle) {
      return String(folderStyle[1] || '').toUpperCase();
    }

    if (GSTIN_REGEX.test(rawClient.toUpperCase())) {
      return rawClient.toUpperCase();
    }

    throw new Error('Unable to resolve GSTIN from payload. Pass gstin or client folder name ending with _GSTIN');
  }

  function normalizeGstr3bInput(input) {
    return {
      gstin: resolveGstinFromGstrPayload(input),
      financialYear: String(input?.financialYear || input?.fy || '').trim(),
      month: String(input?.month || '').trim()
    };
  }

  function loadGstr3bData(input) {
    const normalized = normalizeGstr3bInput(input || {});
    const context = getMonthFileContext(normalized.gstin, normalized.financialYear, normalized.month);
    const payload = readMonthPayload(context);

    // carry_forward[FY][month] = the ITC balance available AT THE START of that month
    // (i.e. leftover from the previous month's setoff, or manually entered opening balance)
    const carryForwardITC = getStoredCarryForward(context.folderName, normalized.financialYear, normalized.month);

    const snapshot = buildGstr3bSnapshot(payload, context.gstin, carryForwardITC);

    return {
      ok: true,
      clientName: context.clientName,
      gstin: context.gstin,
      financialYear: context.financialYear,
      month: context.month,
      ...snapshot
    };
  }

  function saveGstr3bData(input) {
    const normalized = normalizeGstr3bInput(input || {});
    const context = getMonthFileContext(normalized.gstin, normalized.financialYear, normalized.month);
    const payload = readMonthPayload(context);

    payload.returns = payload.returns || {};
    payload.returns.gstr3b_adjustments = sanitizeGstr3bAdjustments(input.adjustments || {});
    writeMonthPayload(context, payload);

    // Reload fresh snapshot (includes carry-forward)
    const result = loadGstr3bData(normalized);

    // Auto-save this month's remaining ITC as next month's carry-forward
    // (only if the next month is not already marked as filed)
    try {
      const nextPeriod = (() => {
        const idx = MONTHS.indexOf(normalized.month);
        if (idx < 0) return null;
        if (idx < MONTHS.length - 1) {
          return { financialYear: normalized.financialYear, month: MONTHS[idx + 1] };
        }
        // March → April of next FY
        const fyMatch = String(normalized.financialYear || '').match(/^FY_(\d{4})-(\d{2})$/);
        if (!fyMatch) return null;
        const nextStartYear = Number(fyMatch[1]) + 1;
        const endShort = String((nextStartYear + 1) % 100).padStart(2, '0');
        return { financialYear: `FY_${nextStartYear}-${endShort}`, month: 'April' };
      })();

      if (nextPeriod) {
        // Guard: skip if next month is already filed (don't overwrite a filed month's data)
        let nextMonthFiled = false;
        try {
          const nextCtx = getMonthFileContext(normalized.gstin, nextPeriod.financialYear, nextPeriod.month);
          const nextPayload = readMonthPayload(nextCtx);
          nextMonthFiled = String(nextPayload?.returns?.gstr3b || '').toLowerCase() === 'filed';
        } catch {
          nextMonthFiled = false;
        }

        if (!nextMonthFiled) {
          const bal = result.balance_itc || { igst: 0, cgst: 0, sgst: 0 };
          setStoredCarryForward(
            context.folderName,
            nextPeriod.financialYear,
            nextPeriod.month,
            bal.igst,
            bal.cgst,
            bal.sgst
          );
        }
      }
    } catch {
      // Non-fatal — carry-forward auto-save failure should not break the save
    }

    return result;
  }

  function markGstr3bFiled(input) {
    const normalized = normalizeGstr3bInput(input || {});
    const result = updateReturnStatus({
      gstin: normalized.gstin,
      financialYear: normalized.financialYear,
      month: normalized.month,
      returnType: 'gstr3b',
      status: 'filed'
    });
    return {
      ok: true,
      status: 'filed',
      history: result.returns.gstr3b.history
    };
  }

  function exportGstr3b(input) {
    const normalized = normalizeGstr3bInput(input || {});
    const context = getMonthFileContext(normalized.gstin, normalized.financialYear, normalized.month);
    const payload = readMonthPayload(context);
    const snapshot = buildGstr3bSnapshot(payload, context.gstin);

    const workbook = XLSX.utils.book_new();

    const sheet31 = XLSX.utils.json_to_sheet(snapshot.section31Rows.map((row) => ({
      'Nature of Supplies': row.nature,
      'Taxable Value': row.taxableValue,
      IGST: row.igst,
      CGST: row.cgst,
      SGST: row.sgst
    })));

    const sheet32 = XLSX.utils.json_to_sheet(snapshot.section32Rows.map((row) => ({
      State: row.state,
      'Taxable Value': row.taxableValue,
      IGST: row.igst
    })));

    const sheet4 = XLSX.utils.json_to_sheet(snapshot.section4Rows.map((row) => ({
      Type: row.type,
      IGST: row.igst,
      CGST: row.cgst,
      SGST: row.sgst
    })));

    const sheet6 = XLSX.utils.json_to_sheet(snapshot.section6Rows.map((row) => ({
      'Tax Type': row.taxType,
      'Tax Payable': row.taxPayable,
      'ITC Utilized': row.itcUtilized,
      'Cash Payable': row.cashPayable
    })));

    const summarySheet = XLSX.utils.json_to_sheet([
      {
        'Output GST': snapshot.summary.outputGst,
        'Input GST': snapshot.summary.inputGst,
        'Net Payable': snapshot.summary.netPayable,
        Status: snapshot.status
      }
    ]);

    XLSX.utils.book_append_sheet(workbook, sheet31, '3.1 Outward');
    XLSX.utils.book_append_sheet(workbook, sheet32, '3.2 Interstate');
    XLSX.utils.book_append_sheet(workbook, sheet4, '4 ITC');
    XLSX.utils.book_append_sheet(workbook, sheet6, '6 Payment');
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    const fyLabel = String(context.financialYear || '').replace(/^FY_/, '');
    const fileName = `GSTR3B_${context.month}_${fyLabel}.xlsx`;
    const outPath = path.join(path.dirname(context.filePath), fileName);
    XLSX.writeFile(workbook, outPath);

    return {
      ok: true,
      filePath: outPath,
      warnings: snapshot.warnings
    };
  }

  function calculateGst(input) {
    const amount = toNum(input?.amount);
    const rate = toNum(input?.rate);
    const mode = String(input?.mode || 'exclusive').toLowerCase() === 'inclusive' ? 'inclusive' : 'exclusive';

    if (amount < 0) {
      throw new Error('Amount must be non-negative');
    }

    if (rate < 0) {
      throw new Error('Rate must be non-negative');
    }

    if (mode === 'exclusive') {
      const taxableValue = to2(amount);
      const gstAmount = to2((taxableValue * rate) / 100);
      const totalAmount = to2(taxableValue + gstAmount);
      return { mode, amount: taxableValue, rate, taxableValue, gstAmount, totalAmount };
    }

    const taxableValue = to2(amount / (1 + rate / 100));
    const gstAmount = to2(amount - taxableValue);
    const totalAmount = to2(amount);
    return { mode, amount: totalAmount, rate, taxableValue, gstAmount, totalAmount };
  }

  function generateInvoiceNumber(input) {
    const financialYear = String(input?.financialYear || getCurrentFinancialYearLabel());
    const month = String(input?.month || '').trim() || 'April';
    const year = getCalendarYearForMonth(financialYear, month);
    const mm = String(monthNumber(month)).padStart(2, '0');
    const period = `${year}${mm}`;

    const counterPath = path.join(baseDataDir, '.invoice-counter.json');
    let counter = { period: '', seq: 0 };

    if (fs.existsSync(counterPath)) {
      try {
        counter = { ...counter, ...JSON.parse(fs.readFileSync(counterPath, 'utf8')) };
      } catch {
        counter = { period: '', seq: 0 };
      }
    }

    if (counter.period !== period) {
      counter.period = period;
      counter.seq = 0;
    }

    counter.seq += 1;
    fs.writeFileSync(counterPath, JSON.stringify(counter, null, 2), 'utf8');

    const invoiceNo = `INV-${period}-${String(counter.seq).padStart(3, '0')}`;
    return {
      ok: true,
      invoiceNo,
      sequence: counter.seq,
      period
    };
  }

  function findClientsFolder(rootPath) {
    const direct = path.join(rootPath, 'clients');
    if (fs.existsSync(direct) && fs.statSync(direct).isDirectory()) {
      return direct;
    }

    const entries = fs.existsSync(rootPath) ? fs.readdirSync(rootPath, { withFileTypes: true }) : [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const nested = path.join(rootPath, entry.name, 'clients');
      if (fs.existsSync(nested) && fs.statSync(nested).isDirectory()) {
        return nested;
      }
    }

    return null;
  }

  function restoreData(input) {
    if (!Array.isArray(input?.zipBuffer) || input.zipBuffer.length === 0) {
      throw new Error('zipBuffer is required for restore');
    }

    const tempRoot = path.join(baseDataDir, `.restore_${Date.now()}`);
    fs.mkdirSync(tempRoot, { recursive: true });

    try {
      const zip = new AdmZip(Buffer.from(input.zipBuffer));
      zip.extractAllTo(tempRoot, true);

      const restoredClientsPath = findClientsFolder(tempRoot);
      if (!restoredClientsPath) {
        throw new Error('Invalid backup ZIP. Expected clients folder not found.');
      }

      const backupPath = `${clientsRoot}_pre_restore_${Date.now()}`;
      if (fs.existsSync(clientsRoot)) {
        fs.renameSync(clientsRoot, backupPath);
      }

      fs.mkdirSync(clientsRoot, { recursive: true });
      fs.cpSync(restoredClientsPath, clientsRoot, { recursive: true });

      customersCache.clear();
      suppliersCache.clear();
      invalidateYearlyCache();

      return {
        ok: true,
        restoredTo: clientsRoot,
        previousBackupPath: fs.existsSync(backupPath) ? backupPath : ''
      };
    } finally {
      if (fs.existsSync(tempRoot)) {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    }
  }

  function buildReportSnapshot(payload, context) {
    const b2b = Array.isArray(payload?.sales?.b2b) ? payload.sales.b2b : [];
    const b2c = Array.isArray(payload?.sales?.b2c) ? payload.sales.b2c : [];
    const purchases = Array.isArray(payload?.purchases) ? payload.purchases : [];

    const salesRows = [];
    [...b2b, ...b2c].forEach((sale) => {
      const gstAmount = to2(
        toNum(sale.gst_amount) ||
          (Array.isArray(sale.items)
            ? sale.items.reduce((sum, item) => sum + toNum(item.igst) + toNum(item.cgst) + toNum(item.sgst), 0)
            : 0)
      );

      salesRows.push({
        date: String(sale.date || ''),
        invoiceNo: String(sale.invoice_no || ''),
        type: sale.buyer_gstin ? 'B2B' : 'B2C',
        partyName: String(sale.buyer_name || (sale.buyer_gstin ? 'Business Customer' : 'Retail Customer')),
        taxableValue: to2(toNum(sale.taxable_value)),
        gstAmount,
        total: to2(toNum(sale.total_value))
      });
    });

    const purchaseRows = purchases.map((row) => ({
      date: String(row.date || ''),
      invoiceNo: String(row.invoice_no || ''),
      supplierName: String(row.supplier_name || ''),
      taxableValue: to2(toNum(row.taxable_value)),
      igst: to2(toNum(row.igst)),
      cgst: to2(toNum(row.cgst)),
      sgst: to2(toNum(row.sgst)),
      total: to2(toNum(row.total || row.total_value)),
      source: String(row.source || 'manual')
    }));

    const totalSales = to2(salesRows.reduce((sum, row) => sum + toNum(row.total), 0));
    const totalSalesTaxable = to2(salesRows.reduce((sum, row) => sum + toNum(row.taxableValue), 0));
    const outputGST = {
      igst: to2(salesRows.reduce((sum, row) => sum + (Array.isArray(b2b) || Array.isArray(b2c) ? 0 : 0), 0)),
      cgst: 0,
      sgst: 0
    };

    // Compute tax split from original rows for accuracy.
    [...b2b, ...b2c].forEach((sale) => {
      (Array.isArray(sale.items) ? sale.items : []).forEach((item) => {
        outputGST.igst = to2(outputGST.igst + toNum(item.igst));
        outputGST.cgst = to2(outputGST.cgst + toNum(item.cgst));
        outputGST.sgst = to2(outputGST.sgst + toNum(item.sgst));
      });
    });

    const totalPurchases = to2(purchaseRows.reduce((sum, row) => sum + toNum(row.total), 0));
    const inputGST = {
      igst: to2(purchaseRows.reduce((sum, row) => sum + toNum(row.igst), 0)),
      cgst: to2(purchaseRows.reduce((sum, row) => sum + toNum(row.cgst), 0)),
      sgst: to2(purchaseRows.reduce((sum, row) => sum + toNum(row.sgst), 0))
    };

    const outputTotalGst = to2(outputGST.igst + outputGST.cgst + outputGST.sgst);
    const inputTotalGst = to2(inputGST.igst + inputGST.cgst + inputGST.sgst);
    const netPayableTotal = to2(outputTotalGst - inputTotalGst);

    const gstr3b = buildGstr3bSnapshot(payload, context.gstin);

    const gstSummaryRows = [
      {
        taxType: 'IGST',
        output: outputGST.igst,
        input: inputGST.igst,
        net: to2(outputGST.igst - inputGST.igst)
      },
      {
        taxType: 'CGST',
        output: outputGST.cgst,
        input: inputGST.cgst,
        net: to2(outputGST.cgst - inputGST.cgst)
      },
      {
        taxType: 'SGST',
        output: outputGST.sgst,
        input: inputGST.sgst,
        net: to2(outputGST.sgst - inputGST.sgst)
      }
    ];

    const itcUtilizationRows = [
      {
        taxType: 'IGST',
        liability: to2(gstr3b.outputGST?.igst),
        itcUsed: to2(gstr3b.section6Rows?.find((r) => r.taxType === 'IGST')?.itcUtilized),
        cashPayable: to2(gstr3b.payable?.igst)
      },
      {
        taxType: 'CGST',
        liability: to2(gstr3b.outputGST?.cgst),
        itcUsed: to2(gstr3b.section6Rows?.find((r) => r.taxType === 'CGST')?.itcUtilized),
        cashPayable: to2(gstr3b.payable?.cgst)
      },
      {
        taxType: 'SGST',
        liability: to2(gstr3b.outputGST?.sgst),
        itcUsed: to2(gstr3b.section6Rows?.find((r) => r.taxType === 'SGST')?.itcUtilized),
        cashPayable: to2(gstr3b.payable?.sgst)
      }
    ];

    return {
      clientName: context.clientName,
      gstin: context.gstin,
      financialYear: context.financialYear,
      month: context.month,
      salesRows,
      purchaseRows,
      summary: {
        totalSales,
        totalSalesTaxable,
        totalPurchases,
        outputGST,
        inputGST,
        outputTotalGst,
        inputTotalGst,
        netGstPayable: netPayableTotal
      },
      gstSummary: {
        cards: {
          totalSales,
          totalPurchase: totalPurchases,
          outputGst: outputTotalGst,
          inputGst: inputTotalGst,
          netGstPayable: netPayableTotal
        },
        taxRows: gstSummaryRows,
        itcUtilizationRows
      }
    };
  }

  function monthSnapshotFromPayload(payload, monthLabel) {
    const b2b = Array.isArray(payload?.sales?.b2b) ? payload.sales.b2b : [];
    const b2c = Array.isArray(payload?.sales?.b2c) ? payload.sales.b2c : [];
    const purchases = Array.isArray(payload?.purchases) ? payload.purchases : [];

    const salesTotal = to2([...b2b, ...b2c].reduce((sum, sale) => sum + toNum(sale.total_value), 0));
    const purchaseTotal = to2(purchases.reduce((sum, row) => sum + toNum(row.total || row.total_value), 0));

    const output = [...b2b, ...b2c].reduce(
      (acc, sale) => {
        (Array.isArray(sale.items) ? sale.items : []).forEach((item) => {
          acc.igst += toNum(item.igst);
          acc.cgst += toNum(item.cgst);
          acc.sgst += toNum(item.sgst);
        });
        return acc;
      },
      { igst: 0, cgst: 0, sgst: 0 }
    );

    const input = purchases.reduce(
      (acc, row) => {
        acc.igst += toNum(row.igst);
        acc.cgst += toNum(row.cgst);
        acc.sgst += toNum(row.sgst);
        return acc;
      },
      { igst: 0, cgst: 0, sgst: 0 }
    );

    const outputTotal = to2(output.igst + output.cgst + output.sgst);
    const inputTotal = to2(input.igst + input.cgst + input.sgst);
    const netGst = to2(outputTotal - inputTotal);

    return {
      month: monthLabel,
      sales: salesTotal,
      purchases: purchaseTotal,
      outputGST: to2(outputTotal),
      inputGST: to2(inputTotal),
      netGST: netGst,
      outputSplit: {
        igst: to2(output.igst),
        cgst: to2(output.cgst),
        sgst: to2(output.sgst)
      },
      inputSplit: {
        igst: to2(input.igst),
        cgst: to2(input.cgst),
        sgst: to2(input.sgst)
      },
      margin: to2(salesTotal - purchaseTotal),
      isLoss: salesTotal < purchaseTotal
    };
  }

  function normalizeYearlyInput(input) {
    return {
      gstin: resolveGstinFromGstrPayload(input),
      financialYear: String(input?.financialYear || input?.fy || '').trim()
    };
  }

  function loadYearlyReportData(input) {
    const normalized = normalizeYearlyInput(input || {});
    const cacheKey = yearlyCacheKey(normalized.gstin, normalized.financialYear);
    if (yearlyReportCache.has(cacheKey)) {
      return yearlyReportCache.get(cacheKey);
    }

    const folderName = findFolderByGstin(normalized.gstin);
    if (!folderName) {
      throw new Error('Client not found for GSTIN');
    }

    const meta = readClientMeta(folderName);
    const clientName = meta?.clientName || folderName.replace(`_${normalized.gstin}`, '').replace(/_/g, ' ');
    ensureFyMonthFiles(folderName, normalized.financialYear, clientName, normalized.gstin);

    const monthRows = MONTHS.map((monthName) => {
      const filePath = path.join(clientsRoot, folderName, normalized.financialYear, `${monthName}.json`);
      const payload = normalizeMonthPayload(JSON.parse(fs.readFileSync(filePath, 'utf8')));
      return monthSnapshotFromPayload(payload, monthName);
    });

    const totals = monthRows.reduce(
      (acc, row) => {
        acc.turnover += toNum(row.sales);
        acc.purchases += toNum(row.purchases);
        acc.output += toNum(row.outputGST);
        acc.input += toNum(row.inputGST);
        return acc;
      },
      { turnover: 0, purchases: 0, output: 0, input: 0 }
    );

    const highestSalesMonth = monthRows.reduce((top, row) => (row.sales > (top?.sales || -1) ? row : top), null);
    const lossMonths = monthRows.filter((row) => row.isLoss).map((row) => row.month);

    const result = {
      ok: true,
      clientName,
      gstin: normalized.gstin,
      financialYear: normalized.financialYear,
      summary: {
        totalTurnover: to2(totals.turnover),
        totalPurchases: to2(totals.purchases),
        totalOutputGST: to2(totals.output),
        totalInputGST: to2(totals.input),
        netGstPayable: to2(totals.output - totals.input)
      },
      monthRows,
      charts: {
        line: monthRows.map((row) => ({ month: row.month, sales: row.sales })),
        bar: monthRows.map((row) => ({ month: row.month, sales: row.sales, purchases: row.purchases }))
      },
      highlights: {
        highestSalesMonth: highestSalesMonth?.month || '',
        lossMonths
      }
    };

    yearlyReportCache.set(cacheKey, result);
    return result;
  }

  function exportYearlyReport(input) {
    const report = loadYearlyReportData(input);
    const folderName = findFolderByGstin(report.gstin);
    if (!folderName) throw new Error('Client not found for GSTIN');
    const fyDir = path.join(clientsRoot, folderName, report.financialYear);

    const workbook = XLSX.utils.book_new();

    const monthSheet = XLSX.utils.json_to_sheet(
      report.monthRows.map((row) => ({
        Month: row.month,
        Sales: row.sales,
        Purchases: row.purchases,
        'Output GST': row.outputGST,
        'Input GST': row.inputGST,
        'Net GST': row.netGST
      }))
    );

    const summarySheet = XLSX.utils.json_to_sheet([
      {
        'Total Turnover': report.summary.totalTurnover,
        'Total Purchases': report.summary.totalPurchases,
        'Total Output GST': report.summary.totalOutputGST,
        'Total Input GST': report.summary.totalInputGST,
        'Net GST Payable': report.summary.netGstPayable,
        'Highest Sales Month': report.highlights.highestSalesMonth,
        'Loss Months': report.highlights.lossMonths.join(', ')
      }
    ]);

    XLSX.utils.book_append_sheet(workbook, monthSheet, 'Month-wise');
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Year Summary');

    const fyLabel = String(report.financialYear || '').replace(/^FY_/, '');
    const outPath = path.join(fyDir, `Yearly_Turnover_${fyLabel}.xlsx`);
    XLSX.writeFile(workbook, outPath);
    return { ok: true, filePath: outPath };
  }

  function exportYearlySummaryPdf(input) {
    const report = loadYearlyReportData(input);
    const folderName = findFolderByGstin(report.gstin);
    if (!folderName) throw new Error('Client not found for GSTIN');
    const fyDir = path.join(clientsRoot, folderName, report.financialYear);

    const fyLabel = String(report.financialYear || '').replace(/^FY_/, '');
    const outPath = path.join(fyDir, `Yearly_GST_Summary_${fyLabel}.pdf`);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);

    doc.fontSize(16).text('Yearly Turnover & GST Summary', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Client: ${report.clientName}`);
    doc.text(`GSTIN: ${report.gstin}`);
    doc.text(`Financial Year: ${report.financialYear}`);
    doc.moveDown(1);

    doc.fontSize(12).text('Yearly Totals');
    doc.fontSize(10);
    doc.text(`Total Turnover: Rs ${report.summary.totalTurnover.toLocaleString('en-IN')}`);
    doc.text(`Total Purchases: Rs ${report.summary.totalPurchases.toLocaleString('en-IN')}`);
    doc.text(`Total Output GST: Rs ${report.summary.totalOutputGST.toLocaleString('en-IN')}`);
    doc.text(`Total Input GST: Rs ${report.summary.totalInputGST.toLocaleString('en-IN')}`);
    doc.text(`Net GST Payable: Rs ${report.summary.netGstPayable.toLocaleString('en-IN')}`);
    doc.text(`Highest Sales Month: ${report.highlights.highestSalesMonth || 'N/A'}`);
    doc.text(`Loss Months: ${report.highlights.lossMonths.join(', ') || 'None'}`);
    doc.moveDown(1);

    doc.fontSize(12).text('Month-wise GST');
    doc.fontSize(9);
    report.monthRows.forEach((row) => {
      doc.text(`${row.month}: Sales ${row.sales.toFixed(2)} | Purchases ${row.purchases.toFixed(2)} | Output ${row.outputGST.toFixed(2)} | Input ${row.inputGST.toFixed(2)} | Net ${row.netGST.toFixed(2)}`);
    });

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => resolve({ ok: true, filePath: outPath }));
      stream.on('error', reject);
    });
  }

  function loadReportsData(input) {
    const normalized = normalizeGstr3bInput(input || {});
    const context = getMonthFileContext(normalized.gstin, normalized.financialYear, normalized.month);
    const payload = readMonthPayload(context);
    const report = buildReportSnapshot(payload, context);

    return {
      ok: true,
      ...report
    };
  }

  function exportMonthlyReport(input) {
    const normalized = normalizeGstr3bInput(input || {});
    const context = getMonthFileContext(normalized.gstin, normalized.financialYear, normalized.month);
    const payload = readMonthPayload(context);
    const report = buildReportSnapshot(payload, context);

    const workbook = XLSX.utils.book_new();

    const salesSheet = XLSX.utils.json_to_sheet(
      report.salesRows.map((row) => ({
        Date: row.date,
        'Invoice No': row.invoiceNo,
        Type: row.type,
        'Party Name': row.partyName,
        'Taxable Value': row.taxableValue,
        'GST Amount': row.gstAmount,
        Total: row.total
      }))
    );

    const purchaseSheet = XLSX.utils.json_to_sheet(
      report.purchaseRows.map((row) => ({
        Date: row.date,
        'Invoice No': row.invoiceNo,
        'Supplier Name': row.supplierName,
        'Taxable Value': row.taxableValue,
        IGST: row.igst,
        CGST: row.cgst,
        SGST: row.sgst,
        Total: row.total,
        Source: row.source
      }))
    );

    const summarySheet = XLSX.utils.json_to_sheet([
      {
        'Total Sales': report.summary.totalSales,
        'Total Purchases': report.summary.totalPurchases,
        'Output GST': report.summary.outputTotalGst,
        'Input GST': report.summary.inputTotalGst,
        'Net GST Payable': report.summary.netGstPayable
      }
    ]);

    XLSX.utils.book_append_sheet(workbook, salesSheet, 'Sales');
    XLSX.utils.book_append_sheet(workbook, purchaseSheet, 'Purchases');
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    const fyLabel = String(context.financialYear || '').replace(/^FY_/, '');
    const outPath = path.join(path.dirname(context.filePath), `Monthly_Report_${context.month}_${fyLabel}.xlsx`);
    XLSX.writeFile(workbook, outPath);

    return {
      ok: true,
      filePath: outPath
    };
  }

  function exportGstSummaryPdf(input) {
    const normalized = normalizeGstr3bInput(input || {});
    const context = getMonthFileContext(normalized.gstin, normalized.financialYear, normalized.month);
    const payload = readMonthPayload(context);
    const report = buildReportSnapshot(payload, context);

    const fyLabel = String(context.financialYear || '').replace(/^FY_/, '');
    const outPath = path.join(path.dirname(context.filePath), `GST_Summary_${context.month}_${fyLabel}.pdf`);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);

    doc.fontSize(16).text('GST Summary Report', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Client: ${report.clientName}`);
    doc.text(`GSTIN: ${report.gstin}`);
    doc.text(`Period: ${report.month} / ${report.financialYear}`);
    doc.moveDown(1);

    doc.fontSize(12).text('Key Figures');
    doc.fontSize(10);
    doc.text(`Total Sales: Rs ${report.gstSummary.cards.totalSales.toLocaleString('en-IN')}`);
    doc.text(`Total Purchase: Rs ${report.gstSummary.cards.totalPurchase.toLocaleString('en-IN')}`);
    doc.text(`Output GST: Rs ${report.gstSummary.cards.outputGst.toLocaleString('en-IN')}`);
    doc.text(`Input GST (ITC): Rs ${report.gstSummary.cards.inputGst.toLocaleString('en-IN')}`);
    doc.text(`Net GST Payable: Rs ${report.gstSummary.cards.netGstPayable.toLocaleString('en-IN')}`);
    doc.moveDown(1);

    doc.fontSize(12).text('GST Liability Table');
    doc.fontSize(10);
    report.gstSummary.taxRows.forEach((row) => {
      doc.text(`${row.taxType}  | Output: ${row.output.toFixed(2)} | Input: ${row.input.toFixed(2)} | Net: ${row.net.toFixed(2)}`);
    });
    doc.moveDown(1);

    doc.fontSize(12).text('ITC Utilization');
    doc.fontSize(10);
    report.gstSummary.itcUtilizationRows.forEach((row) => {
      doc.text(`${row.taxType}  | Liability: ${row.liability.toFixed(2)} | ITC Used: ${row.itcUsed.toFixed(2)} | Cash Payable: ${row.cashPayable.toFixed(2)}`);
    });

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => resolve({ ok: true, filePath: outPath }));
      stream.on('error', reject);
    });
  }

  function backupDataFolder() {
    ensureClientsRoot();

    const backupDir = path.join(baseDataDir, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const zipPath = path.join(backupDir, `clients-backup-${stamp}.zip`);

    const zip = new AdmZip();
    zip.addLocalFolder(clientsRoot, 'clients');
    zip.writeZip(zipPath);

    return { ok: true, zipPath };
  }

  function ensureClientStructure(clientName, gstin, financialYear, clientType = 'Regular', status = 'Active') {
    if (findFolderByGstin(gstin)) {
      return;
    }

    createClientStructure({
      clientName,
      gstin,
      financialYear,
      clientType,
      status
    });
  }

  function buildUniqueInvoiceNo(prefix, financialYear, month, usedSet) {
    const year = getCalendarYearForMonth(financialYear, month);
    const mm = String(monthNumber(month)).padStart(2, '0');
    const yyyymm = `${year}${mm}`;

    let attempt = 0;
    while (attempt < 10000) {
      const serial = String(usedSet.size + 1 + attempt).padStart(3, '0');
      const invoiceNo = `${prefix}-${yyyymm}-${serial}`;
      const key = invoiceNo.toUpperCase();
      if (!usedSet.has(key)) {
        usedSet.add(key);
        return invoiceNo;
      }
      attempt += 1;
    }

    throw new Error('Unable to generate unique invoice number');
  }

  function buildSaleItems(isInterstate) {
    const itemCount = randomInt(1, 5);
    const items = [];
    let taxableTotal = 0;
    let igstTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let totalValue = 0;

    for (let i = 0; i < itemCount; i += 1) {
      const quantity = randomInt(1, 20);
      const rate = randomFloat(120, 4500);
      const gstRate = pickRandom(GST_RATES);
      const taxableValue = to2(quantity * rate);
      const tax = splitTax(taxableValue, gstRate, isInterstate);

      const item = {
        sr_no: i + 1,
        description: pickRandom(ITEM_DESCRIPTIONS),
        hsn_code: pickRandom(HSN_CODES),
        hsn_sac: pickRandom(HSN_CODES),
        quantity,
        rate,
        taxable_value: taxableValue,
        gst_rate: gstRate,
        igst: tax.igst,
        cgst: tax.cgst,
        sgst: tax.sgst,
        total: tax.total,
        total_amount: tax.total
      };

      taxableTotal += taxableValue;
      igstTotal += tax.igst;
      cgstTotal += tax.cgst;
      sgstTotal += tax.sgst;
      totalValue += tax.total;
      items.push(item);
    }

    return {
      items,
      taxableTotal: to2(taxableTotal),
      igstTotal: to2(igstTotal),
      cgstTotal: to2(cgstTotal),
      sgstTotal: to2(sgstTotal),
      gstAmount: to2(igstTotal + cgstTotal + sgstTotal),
      totalValue: to2(totalValue)
    };
  }

  function generateMockData(client, financialYear, month) {
    const gstinInput = typeof client === 'string'
      ? client
      : (client && typeof client === 'object' ? client.gstin : '');

    const context = getMonthFileContext(gstinInput, financialYear, month);
    const payload = readMonthPayload(context);

    const clientStateCode = String(context.gstin || '').slice(0, 2);
    const usedInvoices = new Set(
      [
        ...payload.sales.b2b.map((row) => String(row.invoice_no || '').toUpperCase()),
        ...payload.sales.b2c.map((row) => String(row.invoice_no || '').toUpperCase()),
        ...payload.purchases.map((row) => String(row.invoice_no || '').toUpperCase())
      ].filter(Boolean)
    );

    const b2bCount = randomInt(10, 20);
    const b2cCount = randomInt(10, 20);
    const purchaseCount = randomInt(15, 25);

    for (let i = 0; i < b2bCount; i += 1) {
      const place = pickRandom(INDIAN_STATES);
      const isInterstate = place.code !== clientStateCode;
      const invoiceNo = buildUniqueInvoiceNo('INV', context.financialYear, context.month, usedInvoices);
      const lines = buildSaleItems(isInterstate);

      payload.sales.b2b.push({
        id: `${invoiceNo}-${Date.now()}-${i}`,
        invoice_no: invoiceNo,
        date: randomDateInMonth(context.financialYear, context.month),
        buyer_gstin: generateGstin(place.code),
        buyer_name: pickRandom(BUSINESS_NAMES),
        place_of_supply: place.name,
        reverse_charge: 'No',
        items: lines.items,
        taxable_value: lines.taxableTotal,
        gst_amount: lines.gstAmount,
        total_value: lines.totalValue
      });
    }

    for (let i = 0; i < b2cCount; i += 1) {
      const place = pickRandom(INDIAN_STATES);
      const isInterstate = place.code !== clientStateCode;
      const invoiceNo = buildUniqueInvoiceNo('INV', context.financialYear, context.month, usedInvoices);
      const lines = buildSaleItems(isInterstate);

      payload.sales.b2c.push({
        id: `${invoiceNo}-${Date.now()}-${i}`,
        invoice_no: invoiceNo,
        date: randomDateInMonth(context.financialYear, context.month),
        type: Math.random() > 0.55 ? 'B2C Small' : 'B2C Large',
        place_of_supply: place.name,
        items: lines.items,
        taxable_value: lines.taxableTotal,
        gst_amount: lines.gstAmount,
        total_value: lines.totalValue
      });
    }

    for (let i = 0; i < purchaseCount; i += 1) {
      const supplierState = pickRandom(INDIAN_STATES);
      const isInterstate = supplierState.code !== clientStateCode;
      const taxableValue = to2(randomFloat(800, 250000));
      const gstRate = pickRandom(GST_RATES);
      const tax = splitTax(taxableValue, gstRate, isInterstate);
      const invoiceNo = buildUniqueInvoiceNo('PINV', context.financialYear, context.month, usedInvoices);

      payload.purchases.push({
        id: `${invoiceNo}-${Date.now()}-${i}`,
        type: 'B2B',
        supplier_gstin: generateGstin(supplierState.code),
        supplier_name: pickRandom(BUSINESS_NAMES),
        invoice_no: invoiceNo,
        date: randomDateInMonth(context.financialYear, context.month),
        place_of_supply: supplierState.name,
        taxable_value: taxableValue,
        igst: tax.igst,
        cgst: tax.cgst,
        sgst: tax.sgst,
        total: tax.total,
        source: Math.random() > 0.5 ? 'import' : 'manual'
      });
    }

    writeMonthPayload(context, payload);

    return {
      ok: true,
      b2bCreated: b2bCount,
      b2cCreated: b2cCount,
      purchasesCreated: purchaseCount,
      message: `${b2bCount} B2B, ${b2cCount} B2C, ${purchaseCount} Purchases generated`
    };
  }

  function generatePurchaseMockData(client, financialYear, month) {
    const gstinInput = typeof client === 'string'
      ? client
      : (client && typeof client === 'object' ? client.gstin : '');

    const context = getMonthFileContext(gstinInput, financialYear, month);
    const payload = readMonthPayload(context);
    const clientStateCode = String(context.gstin || '').slice(0, 2);

    const existingPairKeys = new Set(
      payload.purchases.map((row) => {
        const gstin = String(row.supplier_gstin || '').trim().toUpperCase();
        const invoice = String(row.invoice_no || '').trim().toUpperCase();
        return `${gstin}::${invoice}`;
      })
    );

    const existingPurchaseInvoices = new Set(
      payload.purchases.map((row) => String(row.invoice_no || '').trim().toUpperCase()).filter(Boolean)
    );

    const generatedCount = randomInt(20, 30);
    const year = getCalendarYearForMonth(context.financialYear, context.month);
    const mm = String(monthNumber(context.month)).padStart(2, '0');
    const yyyymm = `${year}${mm}`;

    let serial = 1;
    let added = 0;

    while (added < generatedCount) {
      let invoiceNo = '';
      while (!invoiceNo) {
        const candidate = `PUR-${yyyymm}-${String(serial).padStart(3, '0')}`;
        serial += 1;
        if (!existingPurchaseInvoices.has(candidate.toUpperCase())) {
          invoiceNo = candidate;
          existingPurchaseInvoices.add(candidate.toUpperCase());
        }
      }

      const supplierState = pickRandom(PURCHASE_STATES);
      const supplierGstin = generateGstin(supplierState.code);
      const pairKey = `${supplierGstin}::${invoiceNo}`;
      if (existingPairKeys.has(pairKey)) {
        continue;
      }

      const taxableValue = to2(randomFloat(1000, 50000));
      const gstRate = pickRandom(GST_RATES);
      const isInterstate = supplierState.code !== clientStateCode;
      const tax = splitTax(taxableValue, gstRate, isInterstate);

      payload.purchases.push({
        id: `${invoiceNo}-${Date.now()}-${added}`,
        type: 'B2B',
        supplier_gstin: supplierGstin,
        supplier_name: pickRandom(PURCHASE_SUPPLIER_NAMES),
        invoice_no: invoiceNo,
        date: randomDateInMonth(context.financialYear, context.month),
        place_of_supply: supplierState.name,
        taxable_value: taxableValue,
        gst_rate: gstRate,
        igst: tax.igst,
        cgst: tax.cgst,
        sgst: tax.sgst,
        total: tax.total,
        total_value: tax.total,
        source: Math.random() > 0.5 ? 'import' : 'manual'
      });

      existingPairKeys.add(pairKey);
      added += 1;
    }

    writeMonthPayload(context, payload);

    return {
      total_generated: added
    };
  }

  return {
    clientsRoot,
    MONTHS,
    getCurrentFinancialYearLabel,
    ensureClientsRoot,
    getClients,
    createClientStructure,
    loadMonthData,
    saveMonthData,
    loadClientStatus,
    updateReturnStatus,
    loadCustomers,
    saveCustomer,
    updateCustomer,
    deleteCustomer,
    toggleCustomerFavorite,
    loadSuppliers,
    saveSupplier,
    updateSupplier,
    deleteSupplier,
    toggleSupplierFavorite,
    previewPurchaseImport,
    importPurchaseData,
    importPurchase,
    savePurchase,
    loadPurchase,
    deletePurchase,
    saveSale,
    updateSale,
    loadSales,
    deleteSale,
    previewSalesImport,
    importSalesData,
    exportSales,
    loadGstr1Data,
    saveGstr1Data,
    exportGstr1,
    markGstr1Filed,
    loadGstr3bData,
    saveGstr3bData,
    exportGstr3b,
    markGstr3bFiled,
    loadCarryForward,
    saveCarryForward,
    calculateGst,
    generateInvoiceNumber,
    restoreData,
    loadReportsData,
    exportMonthlyReport,
    exportGstSummaryPdf,
    loadYearlyReportData,
    exportYearlyReport,
    exportYearlySummaryPdf,
    generateMockData,
    generatePurchaseMockData,
    backupDataFolder,
    ensureClientStructure,
    findFolderByGstin
  };
}

module.exports = {
  createClientDataService,
  getCurrentFinancialYearLabel,
  MONTHS
};
