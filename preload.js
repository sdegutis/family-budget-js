const electron = require('electron');

electron.ipcRenderer.on('AddExpense', () => addExpense());
