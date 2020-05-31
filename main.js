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
  let data = /** @type {any} */(null);

  const setClean = (/**@type {boolean}*/arg) => {
    isClean = arg;
    mainWindow.title = 'Family Budget' + (isClean ? '' : ' •');
  };

  electron.ipcMain.on('isClean', (event, arg1) => setClean(arg1));
  electron.ipcMain.on('changedData', (event, arg1) => {
    data = arg1;
  });
  electron.ipcMain.on('toggleDevTools', (event, arg1) => mainWindow.webContents.toggleDevTools());
  electron.ipcMain.on('reload', (event, arg1) => mainWindow.reload());

  electron.ipcMain.on('showMenu', (event, x, y, i) => {
    electron.Menu.buildFromTemplate([
      {
        label: 'Delete',
        click() { mainWindow.webContents.send('DeleteItem', i); }
      }
    ]).popup({ window: mainWindow, x, y });
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
  };

  const openFile = () => {
    if (nevermind("open another file")) return;

    const files = electron.dialog.showOpenDialogSync(mainWindow, {});
    if (!files) return;

    file = files[0];
    const json = JSON.parse(fs.readFileSync(file, 'utf-8'));
    mainWindow.webContents.send('OpenFile', json);
  };

  const writeData = () => {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    mainWindow.webContents.send('Saved');
  };

  const saveFile = () => {
    if (file && isClean) return;

    if (file) {
      writeData();
    }
    else {
      saveAsFile();
    }
  };

  const saveAsFile = () => {
    const result = electron.dialog.showSaveDialogSync(mainWindow, {});
    if (!result) return;

    file = result;
    writeData();
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
