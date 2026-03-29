import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { app } from 'electron';
import { profileSchema, type MonitorDevice, type MonitorProfile } from '../../shared/profile-schema.js';

export class ProfileService {
  private getProfilesDir(): string {
    return join(app.getPath('userData'), 'profiles');
  }

  async listProfiles(): Promise<MonitorProfile[]> {
    await mkdir(this.getProfilesDir(), { recursive: true });
    const entries = await readdir(this.getProfilesDir(), { withFileTypes: true });
    const profiles = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map(async (entry) => {
          const content = await readFile(join(this.getProfilesDir(), entry.name), 'utf8');
          return profileSchema.parse(JSON.parse(content));
        })
    );

    return profiles.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async saveProfile(profile: MonitorProfile): Promise<void> {
    const parsed = profileSchema.parse(profile);
    await mkdir(this.getProfilesDir(), { recursive: true });
    const safeName = parsed.profileName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const filePath = join(this.getProfilesDir(), `${safeName}.json`);
    await writeFile(filePath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
  }

  async importProfile(filePath: string): Promise<MonitorProfile> {
    const content = await readFile(filePath, 'utf8');
    const profile = profileSchema.parse(JSON.parse(content));
    await this.saveProfile(profile);
    return profile;
  }

  async exportProfile(profileName: string, destination: string): Promise<void> {
    const profiles = await this.listProfiles();
    const profile = profiles.find((entry) => entry.profileName === profileName);
    if (!profile) {
      throw new Error(`Profile "${profileName}" not found.`);
    }

    await writeFile(destination, `${JSON.stringify(profile, null, 2)}\n`, 'utf8');
  }

  createProfileFromMonitor(
    profileName: string,
    monitor: MonitorDevice,
    notes: string | undefined
  ): MonitorProfile {
    const settings = Object.fromEntries(
      monitor.capabilities
        .filter((capability) => capability.supported && capability.currentValue !== null)
        .map((capability) => [capability.code, capability.currentValue as number])
    );

    return {
      version: 1,
      profileName,
      createdAt: new Date().toISOString(),
      monitor: {
        vendor: monitor.manufacturer ?? undefined,
        model: monitor.model ?? undefined,
        serial: monitor.serial ?? undefined,
        bus: monitor.bus,
        matchStrategy: monitor.serial ? 'vendor-model-serial' : 'bus'
      },
      settings,
      meta: {
        appVersion: app.getVersion(),
        notes
      }
    };
  }
}
