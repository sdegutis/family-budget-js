const electron = require('electron');
const path = require('path');
const fs = require('fs');

electron.app.whenReady().then(() => {
  const mainWindow = new electron.BrowserWindow({
    title: 'Family Budget',
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  let file = /** @type {string} */(null);
  let isClean = true;
  let data = null;

  electron.ipcMain.on('isClean', (event, arg1) => {
    isClean = arg1;
    mainWindow.title = 'Family Budget' + (isClean ? '' : ' •');
  });

  electron.ipcMain.on('changedData', (event, arg1) => data = arg1);

  electron.ipcMain.on('toggleDevTools', (event, arg1) => mainWindow.webContents.toggleDevTools());
  electron.ipcMain.on('reload', (event, arg1) => mainWindow.reload());

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
