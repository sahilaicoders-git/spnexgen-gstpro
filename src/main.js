const { app, BrowserWindow, ipcMain, shell, dialog, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { createClientDataService } = require('./services/clientDataService');

let splashWindow;
let mainWindow;
let activeClient = null;
let ipcHandlersReady = false;

let dataRoot = '';
let clientService = null;

const SETTINGS_PATH = path.join(app.getPath('userData'), 'app-settings.json');

function readAppSettings() {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) return {};
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAppSettings(nextSettings) {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(nextSettings, null, 2), 'utf8');
}

async function resolveDataRoot() {
  const settings = readAppSettings();
  const configured = String(settings.dataDirectory || '').trim();

  if (configured) {
    fs.mkdirSync(configured, { recursive: true });
    return configured;
  }

  const defaultPath = path.join(app.getPath('documents'), 'SPGST_Data');
  const choice = await dialog.showMessageBox({
    type: 'question',
    title: 'Select Data Directory',
    message: 'Choose where SPGST should store your GST data files.',
    detail: `Default location:\n${defaultPath}`,
    buttons: ['Choose Folder', 'Use Default', 'Exit'],
    defaultId: 1,
    cancelId: 2,
    noLink: true
  });

  if (choice.response === 2) {
    return '';
  }

  let selectedPath = defaultPath;
  if (choice.response === 0) {
    const picked = await dialog.showOpenDialog({
      title: 'Select SPGST Data Directory',
      properties: ['openDirectory', 'createDirectory']
    });

    if (picked.canceled || !picked.filePaths[0]) {
      selectedPath = defaultPath;
    } else {
      selectedPath = picked.filePaths[0];
    }
  }

  fs.mkdirSync(selectedPath, { recursive: true });
  writeAppSettings({
    ...settings,
    dataDirectory: selectedPath
  });

  return selectedPath;
}

function setupIpcHandlers() {
  if (ipcHandlersReady) {
    return;
  }

  const registerHandle = (channel, handler) => {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, handler);
  };

  const withService = (fn) => (...args) => {
    if (!clientService) {
      throw new Error('Client data service is not initialized');
    }
    return fn(...args);
  };

  registerHandle('get-clients', withService(() => {
    return clientService.getClients();
  }));

  registerHandle('create-client-structure', withService((_, payload) => {
    return clientService.createClientStructure(payload || {});
  }));

  registerHandle('load-month-data', withService((_, payload) => {
    return clientService.loadMonthData(payload || {});
  }));

  registerHandle('load-client-status', withService((_, payload) => {
    return clientService.loadClientStatus(payload || {});
  }));

  registerHandle('save-month-data', withService((_, payload) => {
    return clientService.saveMonthData(payload || {});
  }));

  registerHandle('update-return-status', withService((_, payload) => {
    return clientService.updateReturnStatus(payload || {});
  }));

  registerHandle('load-customers', withService((_, payload) => {
    return clientService.loadCustomers(payload || {});
  }));

  registerHandle('save-customer', withService((_, payload) => {
    return clientService.saveCustomer(payload || {});
  }));

  registerHandle('update-customer', withService((_, payload) => {
    return clientService.updateCustomer(payload || {});
  }));

  registerHandle('delete-customer', withService((_, payload) => {
    return clientService.deleteCustomer(payload || {});
  }));

  registerHandle('toggle-customer-favorite', withService((_, payload) => {
    return clientService.toggleCustomerFavorite(payload || {});
  }));

  registerHandle('load-suppliers', withService((_, payload) => {
    return clientService.loadSuppliers(payload || {});
  }));

  registerHandle('save-supplier', withService((_, payload) => {
    return clientService.saveSupplier(payload || {});
  }));

  registerHandle('update-supplier', withService((_, payload) => {
    return clientService.updateSupplier(payload || {});
  }));

  registerHandle('delete-supplier', withService((_, payload) => {
    return clientService.deleteSupplier(payload || {});
  }));

  registerHandle('toggle-supplier-favorite', withService((_, payload) => {
    return clientService.toggleSupplierFavorite(payload || {});
  }));

  registerHandle('import-purchase', withService((_, payload) => {
    return clientService.importPurchase(payload || {});
  }));

  registerHandle('preview-purchase-import', withService((_, payload) => {
    return clientService.previewPurchaseImport(payload || {});
  }));

  registerHandle('import-purchase-data', withService((_, payload) => {
    return clientService.importPurchaseData(payload || {});
  }));

  registerHandle('save-purchase', withService((_, payload) => {
    return clientService.savePurchase(payload || {});
  }));

  registerHandle('load-purchase', withService((_, payload) => {
    return clientService.loadPurchase(payload || {});
  }));

  registerHandle('delete-purchase', withService((_, payload) => {
    return clientService.deletePurchase(payload || {});
  }));

  registerHandle('save-sale', withService((_, payload) => {
    return clientService.saveSale(payload || {});
  }));

  registerHandle('load-sales', withService((_, payload) => {
    return clientService.loadSales(payload || {});
  }));

  registerHandle('delete-sale', withService((_, payload) => {
    return clientService.deleteSale(payload || {});
  }));

  registerHandle('export-sales', withService((_, payload) => {
    const result = clientService.exportSales(payload || {});

    if (payload && payload.openFile && result?.filePath) {
      shell.openPath(result.filePath);
    }

    return result;
  }));

  registerHandle('load-gstr1-data', withService((_, payload) => {
    return clientService.loadGstr1Data(payload || {});
  }));

  registerHandle('save-gstr1-data', withService((_, payload) => {
    return clientService.saveGstr1Data(payload || {});
  }));

  registerHandle('export-gstr1', withService((_, payload) => {
    const result = clientService.exportGstr1(payload || {});

    if (payload && payload.openFile && result?.filePath) {
      shell.openPath(result.filePath);
    }

    return result;
  }));

  registerHandle('export-gstr1-offline', withService((_, payload) => {
    const result = clientService.exportGstr1(payload || {});

    if (payload && payload.openFile && result?.filePath) {
      shell.openPath(result.filePath);
    }

    return result;
  }));

  registerHandle('mark-gstr1-filed', withService((_, payload) => {
    return clientService.markGstr1Filed(payload || {});
  }));

  registerHandle('load-gstr3b-data', withService((_, payload) => {
    return clientService.loadGstr3bData(payload || {});
  }));

  registerHandle('save-gstr3b-data', withService((_, payload) => {
    return clientService.saveGstr3bData(payload || {});
  }));

  registerHandle('export-gstr3b', withService((_, payload) => {
    const result = clientService.exportGstr3b(payload || {});

    if (payload && payload.openFile && result?.filePath) {
      shell.openPath(result.filePath);
    }

    return result;
  }));

  registerHandle('mark-gstr3b-filed', withService((_, payload) => {
    return clientService.markGstr3bFiled(payload || {});
  }));

  registerHandle('load-reports-data', withService((_, payload) => {
    return clientService.loadReportsData(payload || {});
  }));

  registerHandle('export-monthly-report', withService((_, payload) => {
    const result = clientService.exportMonthlyReport(payload || {});

    if (payload && payload.openFile && result?.filePath) {
      shell.openPath(result.filePath);
    }

    return result;
  }));

  registerHandle('export-gst-summary-pdf', withService(async (_, payload) => {
    const result = await clientService.exportGstSummaryPdf(payload || {});

    if (payload && payload.openFile && result?.filePath) {
      shell.openPath(result.filePath);
    }

    return result;
  }));

  registerHandle('load-yearly-report-data', withService((_, payload) => {
    return clientService.loadYearlyReportData(payload || {});
  }));

  registerHandle('export-yearly-report', withService((_, payload) => {
    const result = clientService.exportYearlyReport(payload || {});

    if (payload && payload.openFile && result?.filePath) {
      shell.openPath(result.filePath);
    }

    return result;
  }));

  registerHandle('export-yearly-summary-pdf', withService(async (_, payload) => {
    const result = await clientService.exportYearlySummaryPdf(payload || {});

    if (payload && payload.openFile && result?.filePath) {
      shell.openPath(result.filePath);
    }

    return result;
  }));

  registerHandle('generate-mock-data', withService((_, payload) => {
    const input = payload || {};
    return clientService.generateMockData(input.client || input.gstin || '', input.financialYear, input.month);
  }));

  registerHandle('generate-purchase-mock', withService((_, payload) => {
    const input = payload || {};
    return clientService.generatePurchaseMockData(input.client || input.gstin || '', input.financialYear, input.month);
  }));

  registerHandle('backup-data-folder', withService(() => {
    return clientService.backupDataFolder();
  }));

  registerHandle('backup-data', withService(() => {
    return clientService.backupDataFolder();
  }));

  registerHandle('restore-data', withService((_, payload) => {
    return clientService.restoreData(payload || {});
  }));

  registerHandle('calculate-gst', withService((_, payload) => {
    return clientService.calculateGst(payload || {});
  }));

  registerHandle('generate-invoice', withService((_, payload) => {
    return clientService.generateInvoiceNumber(payload || {});
  }));

  registerHandle('get-data-directory', () => {
    return { dataRoot };
  });

  registerHandle('get-active-client', () => {
    return activeClient;
  });

  // ── App settings ──────────────────────────────────────────────────────────
  registerHandle('get-app-settings', () => {
    const settings = readAppSettings();
    return {
      dataDirectory: settings.dataDirectory || dataRoot || '',
      appVersion: app.getVersion()
    };
  });

  registerHandle('change-data-directory', async () => {
    const picked = await dialog.showOpenDialog(mainWindow, {
      title: 'Select New SPGST Data Directory',
      properties: ['openDirectory', 'createDirectory']
    });

    if (picked.canceled || !picked.filePaths[0]) {
      return { changed: false, newPath: dataRoot, needsRestart: false };
    }

    const newPath = picked.filePaths[0];
    if (newPath === dataRoot) {
      return { changed: false, newPath, needsRestart: false };
    }

    const settings = readAppSettings();
    writeAppSettings({ ...settings, dataDirectory: newPath });
    return { changed: true, newPath, needsRestart: true };
  });

  registerHandle('check-for-updates', () => {
    return new Promise((resolve) => {
      const currentVersion = app.getVersion();
      const options = {
        hostname: 'api.github.com',
        path: '/repos/sahilaicoders-git/spnexgen-gstpro/releases/latest',
        method: 'GET',
        headers: { 'User-Agent': 'SPGST-Pro-App' }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const release = JSON.parse(data);
            const latestVersion = (release.tag_name || '').replace(/^v/, '');
            const hasUpdate = latestVersion && latestVersion !== currentVersion &&
              latestVersion.localeCompare(currentVersion, undefined, { numeric: true, sensitivity: 'base' }) > 0;
            resolve({
              ok: true,
              currentVersion,
              latestVersion: latestVersion || currentVersion,
              hasUpdate: !!hasUpdate,
              releaseUrl: release.html_url || '',
              releaseNotes: release.body || ''
            });
          } catch {
            resolve({ ok: false, currentVersion, latestVersion: currentVersion, hasUpdate: false, releaseUrl: '', releaseNotes: '' });
          }
        });
      });

      req.on('error', () => {
        resolve({ ok: false, currentVersion, latestVersion: currentVersion, hasUpdate: false, releaseUrl: '', releaseNotes: '' });
      });

      req.setTimeout(8000, () => {
        req.destroy();
        resolve({ ok: false, currentVersion, latestVersion: currentVersion, hasUpdate: false, releaseUrl: '', releaseNotes: '' });
      });

      req.end();
    });
  });

  ipcHandlersReady = true;
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 980,
    height: 620,
    frame: false,
    resizable: false,
    movable: true,
    fullscreenable: false,
    show: false,
    backgroundColor: '#0f1a22',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.once('ready-to-show', () => splashWindow.show());

  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

function createMainWindow() {
  const rendererPath = path.join(__dirname, '..', 'dist', 'index.html');

  // Resolve app icon for the taskbar / window icon.
  const iconPath = path.join(__dirname, '..', 'build', 'icons', 'icon.iconset', 'icon_256x256.png');
  const appIcon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 620,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#101821',
    icon: appIcon,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(rendererPath);
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Notify renderer when maximize/restore state changes.
  mainWindow.on('maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-state-changed', true);
    }
  });

  mainWindow.on('unmaximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-state-changed', false);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  const resolvedRoot = await resolveDataRoot();
  if (!resolvedRoot) {
    app.quit();
    return;
  }

  dataRoot = resolvedRoot;
  clientService = createClientDataService(dataRoot);
  clientService.ensureClientsRoot();
  setupIpcHandlers();

  createSplashWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function openMainApp() {
  if (!mainWindow) {
    createMainWindow();
  }

  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.setOpacity(0);
    } catch {
      // setOpacity may be unsupported on a few platforms.
    }

    mainWindow.show();
    mainWindow.focus();

    let opacity = 0;
    const fade = setInterval(() => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        clearInterval(fade);
        return;
      }

      opacity = Math.min(opacity + 0.14, 1);
      try {
        mainWindow.setOpacity(opacity);
      } catch {
        clearInterval(fade);
      }

      if (opacity >= 1) {
        clearInterval(fade);
      }
    }, 16);
  }
}

app.on('second-instance', () => {
  openMainApp();
});

ipcMain.on('open-main-app', () => {
  openMainApp();
});

ipcMain.on('client-selected', (_, client) => {
  activeClient = client || null;
});

// ── Custom title-bar window controls ──────────────────────────────────────────
ipcMain.on('window-minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
});

ipcMain.on('open-external-url', (_, url) => {
  if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
    shell.openExternal(url);
  }
});

ipcMain.on('restart-app', () => {
  app.relaunch();
  app.exit(0);
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});
