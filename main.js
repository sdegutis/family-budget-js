const electron = require('electron');
const path = require('path');

electron.app.whenReady().then(() => {
  const mainWindow = new electron.BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile('index.html');

  const newFile = () => { };
  const openFile = () => { };
  const saveFile = () => { };
  const saveAsFile = () => { };
  const exit = () => { };
  const undo = () => { };
  const redo = () => { };
  const addExpense = () => mainWindow.webContents.send('AddExpense');
  const addSpace = () => { };

  mainWindow.on('close', (e) => {
    //e.preventDefault();
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
