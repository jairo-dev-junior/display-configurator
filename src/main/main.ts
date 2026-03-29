import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DdcutilService } from './services/ddcutil.js';
import { ProfileService } from './services/profiles.js';
import { profileSchema } from '../shared/profile-schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ddcutilService = new DdcutilService();
const profileService = new ProfileService();

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#eef2eb',
    webPreferences: {
      preload: join(__dirname, '../../electron/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await window.loadURL(devServerUrl);
    window.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  await window.loadFile(join(__dirname, '../../dist/index.html'));
}

async function readAppState() {
  const [monitors, profiles, diagnostics] = await Promise.all([
    ddcutilService.listMonitors(),
    profileService.listProfiles(),
    ddcutilService.getDiagnostics()
  ]);

  return {
    monitors,
    profiles,
    diagnostics
  };
}

app.whenReady().then(async () => {
  ipcMain.handle('app:bootstrap', async () => readAppState());

  ipcMain.handle(
    'monitor:set-values',
    async (_event, payload: { bus: string; values: Array<{ hexCode: string; value: number }> }) => {
      for (const entry of payload.values) {
        await ddcutilService.setVcpValue(payload.bus, entry.hexCode, entry.value);
      }

      return readAppState();
    }
  );

  ipcMain.handle('monitor:set-value', async (_event, payload: { bus: string; hexCode: string; value: number }) => {
    await ddcutilService.setVcpValue(payload.bus, payload.hexCode, payload.value);
    return readAppState();
  });

  ipcMain.handle('profiles:create', async (_event, payload: { profileName: string; bus: string; notes?: string }) => {
    const monitors = await ddcutilService.listMonitors();
    const monitor = monitors.find((entry) => entry.bus === payload.bus);
    if (!monitor) {
      throw new Error('Monitor not found.');
    }

    const profile = profileService.createProfileFromMonitor(payload.profileName, monitor, payload.notes);
    await profileService.saveProfile(profileSchema.parse(profile));
    return readAppState();
  });

  ipcMain.handle('profiles:apply', async (_event, payload: { profileName: string; bus: string }) => {
    const profiles = await profileService.listProfiles();
    const profile = profiles.find((entry) => entry.profileName === payload.profileName);
    if (!profile) {
      throw new Error('Profile not found.');
    }

    const monitors = await ddcutilService.listMonitors();
    const monitor = monitors.find((entry) => entry.bus === payload.bus);
    if (!monitor) {
      throw new Error('Monitor not found.');
    }

    await Promise.all(
      monitor.capabilities
        .filter((capability) => capability.supported)
        .map(async (capability) => {
          const value = profile.settings[capability.code];
          if (typeof value === 'number') {
            await ddcutilService.setVcpValue(payload.bus, capability.hexCode, value);
          }
        })
    );

    return readAppState();
  });

  ipcMain.handle('profiles:import', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return readAppState();
    }

    await profileService.importProfile(result.filePaths[0]);
    return readAppState();
  });

  ipcMain.handle('profiles:export', async (_event, payload: { profileName: string }) => {
    const result = await dialog.showSaveDialog({
      defaultPath: `${payload.profileName}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });

    if (result.canceled || !result.filePath) {
      return false;
    }

    await profileService.exportProfile(payload.profileName, result.filePath);
    return true;
  });

  ipcMain.handle('app:refresh', async () => readAppState());

  await createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
