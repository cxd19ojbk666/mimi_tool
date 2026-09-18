const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

const pages = {
  launcher: path.join('..', 'renderer', 'index.html'),
  seats: path.join('..', 'renderer', 'pages', 'seating-chart.html'),
  boards: path.join('..', 'renderer', 'pages', 'board-labels.html'),
  rollcall: path.join('..', 'renderer', 'pages', 'roll-call.html')
};

let mainWindow;

function openPage(page) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadFile(path.join(__dirname, pages[page]));
  }
}

function buildMenu() {
  const template = [
    ...(process.platform === 'darwin'
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
          ]
        }]
      : []),
    {
      label: '工具',
      submenu: [
        { label: '返回工具箱', accelerator: 'CmdOrCtrl+0', click: () => openPage('launcher') },
        { type: 'separator' },
        { label: '咪咪大王排座位', accelerator: 'CmdOrCtrl+1', click: () => openPage('seats') },
        { label: '咪咪大王做板贴', accelerator: 'CmdOrCtrl+2', click: () => openPage('boards') },
        { label: '咪咪大王点名器', accelerator: 'CmdOrCtrl+3', click: () => openPage('rollcall') },
        ...(process.platform === 'darwin' ? [] : [{ type: 'separator' }, { role: 'quit' }])
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: '显示',
      submenu: [
        { role: 'reload' },
        { role: 'togglefullscreen' }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 620,
    title: '咪咪大王工具箱',
    backgroundColor: '#fff9df',
    icon: path.join(__dirname, '..', '..', 'assets', process.platform === 'win32' ? 'mimi-toolbox.ico' : 'mimi-toolbox-icon-1024.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, pages.launcher));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.setName('咪咪大王工具箱');
app.setAppUserModelId('com.mimi.toolbox');

app.whenReady().then(() => {
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
