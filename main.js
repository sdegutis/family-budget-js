const electron = require('electron');
const path = require('path');
const fs = require('fs');

let isClean = true;
electron.ipcMain.on('isClean', (event, data) => isClean = data);

electron.app.whenReady().then(() => {
  const mainWindow = new electron.BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  /** @type {string} */
  let file = null;

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
    isClean = true;
    mainWindow.webContents.send('NewFile');
  };

  const openFile = () => {
    if (nevermind("open another file")) return;

    const files = electron.dialog.showOpenDialogSync(mainWindow, {});
    if (!files) return;

    file = files[0];
    isClean = true;

    const json = JSON.parse(fs.readFileSync(file, 'utf-8'));

    mainWindow.webContents.send('OpenFile', json);
  };

  const saveFile = () => {
    if (isClean) return;
  };

  const saveAsFile = () => {
  };

  const exit = () => mainWindow.close();
  const undo = () => mainWindow.webContents.send('Undo');
  const redo = () => mainWindow.webContents.send('Redo');
  const addExpense = () => mainWindow.webContents.send('AddExpense');
  const addSpace = () => mainWindow.webContents.send('AddSpace');

  mainWindow.on('close', (e) => {
    if (nevermind("exit")) e.preventDefault();
  });

  mainWindow.setMenu(electron.Menu.buildFromTemplate([
    {
      label: '&File', submenu: [
        { label: '&New', accelerator: 'Ctrl+N', click: newFile },
        { label: '&Open', accelerator: 'Ctrl+O', click: openFile },
        { type: 'separator' },
        { label: '&Save', accelerator: 'Ctrl+S', click: saveFile },
        { label: 'Save &As', click: saveAsFile },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { role: 'reload' },
        { type: 'separator' },
        { label: 'E&xit', click: exit },
      ],
    },
    {
      label: '&Edit', submenu: [
        { label: '&Undo', accelerator: 'Ctrl+Z', click: undo },
        { label: '&Redo', accelerator: 'Ctrl+Y', click: redo },
        { type: 'separator' },
        { label: 'Add Expense', click: addExpense },
        { label: 'Add Space', click: addSpace },
      ],
    },
  ]));
});
