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

  registerHandle('update-sale', withService((_, payload) => {
    return clientService.updateSale(payload || {});
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

  registerHandle('load-carry-forward', withService((_, payload) => {
    return clientService.loadCarryForward(payload || {});
  }));

  registerHandle('save-carry-forward', withService((_, payload) => {
    return clientService.saveCarryForward(payload || {});
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


  // ── GST Portal Credentials ─────────────────────────────────────────────────
  registerHandle('get-gst-credentials', () => {
    const settings = readAppSettings();
    return {
      gst_username: settings.gst_username || '',
      // Never expose password back to renderer – send a masked flag instead
      has_password: Boolean(settings.gst_password),
    };
  });

  registerHandle('save-gst-credentials', (_, payload) => {
    const { gst_username, gst_password } = payload || {};
    const settings = readAppSettings();
    const next = { ...settings };
    if (typeof gst_username === 'string') next.gst_username = gst_username.trim();
    if (typeof gst_password === 'string' && gst_password.length > 0) next.gst_password = gst_password;
    writeAppSettings(next);
    return { ok: true };
  });

  // ── Open GST Portal ────────────────────────────────────────────────────────
  ipcMain.removeAllListeners('open-gst-portal');
  ipcMain.on('open-gst-portal', (_, { targetUrl } = {}) => {
    // Read credentials fresh each time
    const settings = readAppSettings();
    const username = (settings.gst_username || '').trim();
    const password = settings.gst_password || '';
    const portalUrl = targetUrl || 'https://services.gst.gov.in/services/login';

    const win = new BrowserWindow({
      width: 1280,
      height: 820,
      title: 'GST Portal — SPGST Pro',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        // Allow cookies / session to persist between opens
        partition: 'persist:gstportal',
      },
    });

    win.loadURL(portalUrl);

    // ── Autofill helper ────────────────────────────────────────────────────
    // GST portal is Angular – the form renders AFTER did-finish-load.
    // We inject a polling script that retries every 400 ms (up to 15 s).
    const injectAutofill = () => {
      const currentUrl = win.webContents.getURL();
      const isLoginPage =
        currentUrl.includes('services.gst.gov.in/services/login') ||
        (currentUrl.includes('gst.gov.in') && currentUrl.includes('login'));

      if (!isLoginPage) return;
      if (!username && !password) return;

      // Sanitise – JSON.stringify escapes quotes/slashes safely
      const safeUser = JSON.stringify(username);
      const safePass = JSON.stringify(password);

      win.webContents.executeJavaScript(`
        (function startAutofill() {
          // Prevent multiple loops if this is injected more than once
          if (window.__spgstAutofillRunning) return;
          window.__spgstAutofillRunning = true;

          var maxAttempts = 30;   // 30 × 400 ms = 12 seconds
          var attempts    = 0;
          var filled      = false;

          function tryFill() {
            if (filled) return;
            attempts++;

            // ── Try every known selector for the GST portal fields ──────
            var u =
              document.getElementById('user_name') ||
              document.getElementById('username') ||
              document.getElementById('userid') ||
              document.querySelector('input[name="username"]') ||
              document.querySelector('input[name="user_name"]') ||
              document.querySelector('input[formcontrolname="username"]') ||
              document.querySelector('input[placeholder*="Username" i]') ||
              document.querySelector('input[placeholder*="User Name" i]') ||
              document.querySelector('input[type="text"]');

            var p =
              document.getElementById('user_pass') ||
              document.getElementById('password') ||
              document.querySelector('input[name="password"]') ||
              document.querySelector('input[name="user_pass"]') ||
              document.querySelector('input[formcontrolname="password"]') ||
              document.querySelector('input[placeholder*="Password" i]') ||
              document.querySelector('input[type="password"]');

            if (u || p) {
              // Native value setter – works with Angular/React controlled inputs
              function setNativeValue(el, val) {
                var nativeInputValueSetter =
                  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeInputValueSetter.call(el, val);
                el.dispatchEvent(new Event('input',  { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
              }

              if (u && ${safeUser}) setNativeValue(u, ${safeUser});
              if (p && ${safePass}) setNativeValue(p, ${safePass});

              filled = true;

              // Show success banner
              if (!document.getElementById('__spgst_banner')) {
                var banner = document.createElement('div');
                banner.id = '__spgst_banner';
                banner.innerHTML =
                  '<span style="font-size:15px;margin-right:6px">✓</span>' +
                  '<strong>SPGST Pro:</strong> Credentials auto-filled — please enter the CAPTCHA and click Login.';
                Object.assign(banner.style, {
                  position: 'fixed', top: '0', left: '0', right: '0',
                  zIndex: '2147483647',
                  background: 'linear-gradient(90deg,#0f2f57,#1a4a7a)',
                  color: '#7dd3fc',
                  textAlign: 'center',
                  padding: '10px 16px',
                  fontSize: '13px',
                  fontFamily: 'Inter,"Segoe UI",sans-serif',
                  boxShadow: '0 3px 12px rgba(0,0,0,0.5)',
                  letterSpacing: '0.01em',
                });
                document.body.prepend(banner);
                setTimeout(function() { banner.remove(); }, 9000);
              }
            }

            if (!filled && attempts < maxAttempts) {
              setTimeout(tryFill, 400);
            } else if (!filled) {
              window.__spgstAutofillRunning = false; // reset so next navigation can retry
            }
          }

          tryFill();
        })();
      `).catch(() => {});
    };

    // Fire on both events – whichever comes last on an SPA wins
    win.webContents.on('did-finish-load', injectAutofill);
    win.webContents.on('dom-ready',       injectAutofill);

    // Also re-trigger on any navigation within the portal
    win.webContents.on('did-navigate-in-page', injectAutofill);
    win.webContents.on('did-navigate',          injectAutofill);
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
