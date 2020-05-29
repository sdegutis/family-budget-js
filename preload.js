const electron = require('electron');

electron.ipcRenderer.on('AddExpense', () => addExpense());
electron.ipcRenderer.on('AddSpace', () => addSpace());
electron.ipcRenderer.on('Undo', () => undo());
electron.ipcRenderer.on('Redo', () => redo());
