const electron = require('electron');

/** @type {*} */(global).sendToBackend = electron.ipcRenderer.send;

electron.ipcRenderer.on('AddExpense', (event) => addExpense());
electron.ipcRenderer.on('AddSpace', (event) => addSpace());
electron.ipcRenderer.on('Undo', (event) => undo());
electron.ipcRenderer.on('Redo', (event) => redo());
electron.ipcRenderer.on('NewFile', (event) => newFile());
electron.ipcRenderer.on('OpenFile', (event, data) => openFile(data));
