const electron = require('electron');
const path = require('path');
const fs = require('fs');

// @ts-ignore
const { ProgId, ShellOption, Regedit } = require('electron-regedit');
new ProgId({
  description: 'Family Budget File',
  extensions: ['familybudget'],
});
Regedit.installAll();

const isMac = process.platform === 'darwin';

electron.app.whenReady().then(() => {
  const [, openedFile] = process.argv;
  const file = (openedFile && openedFile !== '.') ? openedFile : null;
  createWindow(file);
});

electron.app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    electron.app.quit();
  }
});

/**
 * @param {string | null} file
 */
function createWindow(file) {
  const mainWindow = new electron.BrowserWindow({
    title: 'Family Budget',
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  let isClean = true;
  let data = /** @type {any} */(null);

  const resetTitle = () => {
    mainWindow.title = (isClean ? '' : '• ') + (file ? `${path.basename(file)} - ` : '') + 'Family Budget';
  };

  mainWindow.webContents.on('ipc-message', (event, msg, ...args) => {
    switch (msg) {
      case 'isClean': {
        [isClean] = args;
        if (isMac) mainWindow.documentEdited = !isClean;
        resetTitle();
        break;
      }
      case 'changedData': {
        [data] = args;
        break;
      }
      case 'toggleDevTools': {
        mainWindow.webContents.toggleDevTools();
        break;
      }
      case 'reload': {
        mainWindow.reload();
        break;
      }
      case 'showMenu': {
        const [x, y, i] = args;
        electron.Menu.buildFromTemplate([
          { label: 'Delete', click() { mainWindow.webContents.send('DeleteItem', i); } },
        ]).popup({ window: mainWindow, x, y });
        break;
      }
    }
  });

  mainWindow.loadFile('index.html');

  const nevermind = (/** @type {string} */action) => {
    if (isClean) return false;
    return electron.dialog.showMessageBoxSync(mainWindow, {
      title: 'Family Budget',
      message: `You have unsaved changes. Are you sure you want to ${action}?`,
      buttons: ['OK', 'Cancel'],
    }) === 1;
  };

  const newFile = () => {
    if (nevermind("start a new file")) return;
    mainWindow.webContents.send('NewFile');
    file = null;
    resetTitle();
  };

  const loadFile = (/** @type {string} */ path) => {
    electron.app.addRecentDocument(path);

    file = path;
    const json = JSON.parse(fs.readFileSync(file, 'utf-8'));
    mainWindow.webContents.send('OpenFile', json);
    resetTitle();
  };

  const openFile = () => {
    if (nevermind("open another file")) return;

    const files = electron.dialog.showOpenDialogSync(mainWindow, {
      filters: [{ name: 'Family Budget', extensions: ['familybudget'] }],
    });
    if (!files) return;

    loadFile(files[0]);
  };

  const writeData = () => {
    fs.writeFileSync(/** @type {string} */(file), JSON.stringify(data, null, 2));
    mainWindow.webContents.send('Saved');
    isClean = true;
    if (isMac) mainWindow.documentEdited = !isClean;
    resetTitle();
  };

  const saveFile = () => {
    if (!file) {
      saveAsFile();
    }
    else if (!isClean) {
      writeData();
    }
    else {
      mainWindow.webContents.send('NothingToSave');
    }
  };

  const saveAsFile = () => {
    const result = electron.dialog.showSaveDialogSync(mainWindow, {
      filters: [{ name: 'Family Budget', extensions: ['familybudget'] }],
    });
    if (!result) return;

    file = result;
    writeData();
  };

  const exit = () => mainWindow.close();
  const undo = () => mainWindow.webContents.send('Undo');
  const redo = () => mainWindow.webContents.send('Redo');
  const addExpense = () => mainWindow.webContents.send('AddExpense');
  const addSpace = () => mainWindow.webContents.send('AddSpace');
  const closeWindow = () => mainWindow.close();

  if (isMac) {
    mainWindow.on('focus', () => {
      setAppMenu({
        saveFile,
        saveAsFile,
        undo,
        redo,
        addExpense,
        addSpace,
        closeWindow,
      });
    });

    mainWindow.on('blur', () => {
      setAppMenu({});
    });

    mainWindow.on('closed', () => {
      setAppMenu({});
    });
  }

  mainWindow.on('close', (e) => {
    if (nevermind(isMac ? "close the document" : "exit")) e.preventDefault();
  });

  mainWindow.webContents.on('did-finish-load', () => {
    if (!isMac) {
      mainWindow.setMenu(electron.Menu.buildFromTemplate([
        {
          label: '&File', submenu: [
            { label: '&New', accelerator: 'Ctrl+N', click: newFile },
            { label: '&Open', accelerator: 'Ctrl+O', click: openFile },
            { type: 'separator' },
            { label: '&Save', accelerator: 'Ctrl+S', click: saveFile },
            { label: 'Save &As', click: saveAsFile },
            { type: 'separator' },
            { label: 'E&xit', click: exit },
          ],
        },
        {
          label: '&Edit', submenu: [
            { label: '&Undo', accelerator: 'Ctrl+Z', click: undo },
            { label: '&Redo', accelerator: 'Ctrl+Y', click: redo },
            { type: 'separator' },
            { label: 'Add Expense', accelerator: 'Ctrl+E', click: addExpense },
            { label: 'Add Space', accelerator: 'Ctrl+Shift+E', click: addSpace },
          ],
        },
      ]));
    }

    if (file) {
      loadFile(file);
    }
  });
}

/** @typedef {Electron.MenuItemConstructorOptions['click']} MenuClicker */

/**
 * @param {object}       handlers
 * @param {MenuClicker=} handlers.saveFile
 * @param {MenuClicker=} handlers.saveAsFile
 * @param {MenuClicker=} handlers.undo
 * @param {MenuClicker=} handlers.redo
 * @param {MenuClicker=} handlers.addExpense
 * @param {MenuClicker=} handlers.addSpace
 * @param {MenuClicker=} handlers.closeWindow
 */
function setAppMenu(handlers) {
  electron.app.applicationMenu = electron.Menu.buildFromTemplate([
    { role: 'appMenu' },
    {
      label: '&File', submenu: [
        { label: '&New', accelerator: 'Cmd+N', click: newWindow },
        { label: '&Open', accelerator: 'Cmd+O', click: openFileNewWindow },
        { type: 'separator' },
        { label: '&Save', accelerator: 'Cmd+S', click: handlers.saveFile, enabled: !!handlers.saveFile },
        { label: 'Save &As', accelerator: 'Cmd+Shift+S', click: handlers.saveAsFile, enabled: !!handlers.saveAsFile },
        { type: 'separator' },
        { label: 'Close', accelerator: 'Cmd+W', click: handlers.closeWindow, enabled: !!handlers.closeWindow },
      ],
    },
    {
      label: '&Edit', submenu: [
        { label: '&Undo', accelerator: 'Cmd+Z', click: handlers.undo, enabled: !!handlers.undo },
        { label: '&Redo', accelerator: 'Cmd+Shift+Z', click: handlers.redo, enabled: !!handlers.redo },
        { type: 'separator' },
        { label: 'Add Expense', accelerator: 'Cmd+E', click: handlers.addExpense, enabled: !!handlers.addExpense },
        { label: 'Add Space', accelerator: 'Cmd+Shift+E', click: handlers.addSpace, enabled: !!handlers.addSpace },
      ],
    },
    { role: 'windowMenu' },
  ]);
}

function newWindow() {
  createWindow(null);
}

function openFileNewWindow() {
  const files = electron.dialog.showOpenDialogSync({
    filters: [{ name: 'Family Budget', extensions: ['familybudget'] }],
  });
  if (!files) return;

  createWindow(files[0]);
}
