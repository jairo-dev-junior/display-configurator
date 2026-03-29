import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { access, readdir } from 'node:fs/promises';
import { promisify } from 'node:util';
import type { MonitorCapability, MonitorDevice } from '../../shared/profile-schema.js';

const execFileAsync = promisify(execFile);

const KNOWN_FEATURES: Array<{ code: string; hexCode: string; name: string }> = [
  { code: 'brightness', hexCode: '10', name: 'Brightness' },
  { code: 'contrast', hexCode: '12', name: 'Contrast' },
  { code: 'redGain', hexCode: '16', name: 'Red Gain' },
  { code: 'greenGain', hexCode: '18', name: 'Green Gain' },
  { code: 'blueGain', hexCode: '1A', name: 'Blue Gain' },
  { code: 'audioSpeakerVolume', hexCode: '62', name: 'Speaker Volume' },
  { code: 'audioMute', hexCode: '8D', name: 'Audio Mute' },
  { code: 'inputSource', hexCode: '60', name: 'Input Source' },
  { code: 'whiteLevel', hexCode: '6B', name: 'White Level' },
  { code: 'sharpness', hexCode: '87', name: 'Sharpness' },
  { code: 'hue', hexCode: '90', name: 'Hue' },
  { code: 'saturation', hexCode: '8A', name: 'Saturation' }
];

type DdcDiagnostics = {
  ddcutilInstalled: boolean;
  message: string | null;
};

export class DdcutilService {
  async getDiagnostics(): Promise<DdcDiagnostics> {
    const i2cMessage = await this.getI2cDiagnostics();

    try {
      await execFileAsync('ddcutil', ['--version']);
      return {
        ddcutilInstalled: true,
        message: i2cMessage
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ddcutil not available';
      return {
        ddcutilInstalled: false,
        message: [message, i2cMessage].filter(Boolean).join(' ')
      };
    }
  }

  async listMonitors(): Promise<MonitorDevice[]> {
    const diagnostics = await this.getDiagnostics();
    if (!diagnostics.ddcutilInstalled) {
      return [];
    }

    const { stdout } = await execFileAsync('ddcutil', ['detect']);
    const entries = this.parseDetectOutput(stdout);

    const monitors = await Promise.all(
      entries.map(async (entry, index) => ({
        id: `display-${index + 1}-${entry.bus}`,
        bus: entry.bus,
        displayName: entry.model ?? `Display ${index + 1}`,
        manufacturer: entry.manufacturer,
        model: entry.model,
        serial: entry.serial,
        capabilities: await this.readCapabilities(entry.bus),
        available: true
      }) satisfies MonitorDevice)
    );

    return monitors;
  }

  async setVcpValue(bus: string, hexCode: string, value: number): Promise<void> {
    await execFileAsync('ddcutil', ['setvcp', hexCode, String(value), '--bus', bus]);
  }

  private async readCapabilities(bus: string): Promise<MonitorCapability[]> {
    const capabilities = await Promise.all(
      KNOWN_FEATURES.map(async (feature) => {
        try {
          const { stdout } = await execFileAsync('ddcutil', ['getvcp', feature.hexCode, '--bus', bus]);
          const values = stdout.match(/current value =\s*(0x[0-9a-f]+|\d+),\s*max value =\s*(0x[0-9a-f]+|\d+)/i);
          return {
            code: feature.code,
            hexCode: feature.hexCode,
            name: feature.name,
            currentValue: values ? this.parseNumeric(values[1]) : null,
            maxValue: values ? this.parseNumeric(values[2]) : null,
            writable: true,
            supported: true
          } satisfies MonitorCapability;
        } catch {
          return {
            code: feature.code,
            hexCode: feature.hexCode,
            name: feature.name,
            currentValue: null,
            maxValue: null,
            writable: false,
            supported: false
          } satisfies MonitorCapability;
        }
      })
    );

    return capabilities.filter((capability) => capability.supported);
  }

  private parseNumeric(value: string): number {
    if (value.startsWith('0x') || value.startsWith('0X')) {
      return Number.parseInt(value, 16);
    }

    return Number.parseInt(value, 10);
  }

  private parseDetectOutput(stdout: string): Array<{
    bus: string;
    manufacturer: string | null;
    model: string | null;
    serial: string | null;
  }> {
    return stdout
      .split(/(?=Display \d+)/g)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => {
        const busPath = block.match(/I2C bus:\s*\/dev\/i2c-(\d+)/i)?.[1] ?? null;
        return {
          bus: busPath ?? '0',
          manufacturer: block.match(/Mfg id:\s*(.+)/i)?.[1]?.trim() ?? null,
          model: block.match(/Model:\s*(.+)/i)?.[1]?.trim() ?? null,
          serial: block.match(/Serial number:\s*(.+)/i)?.[1]?.trim() ?? null
        };
      })
      .filter((entry) => entry.bus !== '0');
  }

  private async getI2cDiagnostics(): Promise<string | null> {
    try {
      const entries = await readdir('/dev');
      const i2cDevices = entries.filter((entry) => entry.startsWith('i2c-')).sort();

      if (i2cDevices.length === 0) {
        return 'No /dev/i2c-* devices were found.';
      }

      const inaccessible: string[] = [];

      for (const device of i2cDevices) {
        try {
          await access(`/dev/${device}`, constants.R_OK | constants.W_OK);
        } catch {
          inaccessible.push(device);
        }
      }

      if (inaccessible.length > 0) {
        return `Insufficient permission for ${inaccessible.map((device) => `/dev/${device}`).join(', ')}.`;
      }

      return null;
    } catch {
      return 'Unable to inspect /dev/i2c-* permissions.';
    }
  }
}
