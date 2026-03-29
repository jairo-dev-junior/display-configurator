import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import type { AppStatePayload, MonitorCapability, MonitorDevice } from '../shared/profile-schema';

type AppStore = {
  state: AppStatePayload | null;
  pending: boolean;
  error: string | null;
  setState: (state: AppStatePayload | null) => void;
  setPending: (pending: boolean) => void;
  setError: (error: string | null) => void;
};

const useAppStore = create<AppStore>((set) => ({
  state: null,
  pending: true,
  error: null,
  setState: (state) => set({ state }),
  setPending: (pending) => set({ pending }),
  setError: (error) => set({ error })
}));

function useBootstrap() {
  const { setState, setPending, setError } = useAppStore();

  useEffect(() => {
    let active = true;
    setPending(true);
    if (!window.monitorControl) {
      setError('Electron preload API not available. Restart the app and verify the preload configuration.');
      setPending(false);
      return () => {
        active = false;
      };
    }

    window.monitorControl
      .bootstrap()
      .then((payload: AppStatePayload) => {
        if (active) {
          setState(payload);
          setError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setError(error instanceof Error ? error.message : 'Failed to bootstrap application');
        }
      })
      .finally(() => {
        if (active) {
          setPending(false);
        }
      });

    return () => {
      active = false;
    };
  }, [setError, setPending, setState]);
}

function capabilityValue(capability: MonitorCapability): number {
  if (capability.currentValue === null) {
    return 0;
  }

  return capability.currentValue;
}

type DisplayControl = {
  key: string;
  name: string;
  hexCode: string;
  currentValue: number;
  maxValue: number;
  draftValue: number;
  isPending: boolean;
  tooltip: string;
  applyDraft: (nextValue: number) => void;
};

function diagnosticCopy(state: AppStatePayload | null): string {
  if (!state) {
    return 'Loading monitor diagnostics.';
  }

  if (state.diagnostics.ddcutilInstalled) {
    return state.diagnostics.message ?? 'ddcutil detected. Supported controls are ready for staged changes.';
  }

  return state.diagnostics.message ?? 'ddcutil was not found. Install the dependency to unlock monitor discovery.';
}

export function App() {
  useBootstrap();

  const { state, pending, error, setState, setPending, setError } = useAppStore();
  const [selectedBus, setSelectedBus] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profileNotes, setProfileNotes] = useState('');
  const [draftValues, setDraftValues] = useState<Record<string, number>>({});

  const selectedMonitor = useMemo<MonitorDevice | null>(() => {
    if (!state?.monitors.length) {
      return null;
    }

    const match = state.monitors.find((monitor) => monitor.bus === selectedBus);
    return match ?? state.monitors[0];
  }, [selectedBus, state?.monitors]);

  useEffect(() => {
    if (!selectedBus && state?.monitors[0]) {
      setSelectedBus(state.monitors[0].bus);
    }
  }, [selectedBus, state?.monitors]);

  useEffect(() => {
    if (!selectedMonitor) {
      setDraftValues({});
      return;
    }

    setDraftValues(
      Object.fromEntries(
        selectedMonitor.capabilities.map((capability) => [capability.code, capability.currentValue ?? 0])
      )
    );
  }, [selectedMonitor]);

  async function runAction(action: () => Promise<AppStatePayload | boolean>) {
    setPending(true);
    try {
      const result = await action();
      if (typeof result !== 'boolean') {
        setState(result);
      }
      setError(null);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Operation failed');
    } finally {
      setPending(false);
    }
  }

  const changedCapabilities = selectedMonitor
    ? selectedMonitor.capabilities.filter((capability) => draftValues[capability.code] !== (capability.currentValue ?? 0))
    : [];

  const hasPendingChanges = changedCapabilities.length > 0;
  const monitorCount = state?.monitors.length ?? 0;
  const profileCount = state?.profiles.length ?? 0;

  const displayControls = useMemo<DisplayControl[]>(() => {
    if (!selectedMonitor) {
      return [];
    }

    const controls: DisplayControl[] = selectedMonitor.capabilities.map((capability) => ({
      key: capability.code,
      name: capability.name,
      hexCode: capability.hexCode,
      currentValue: capability.currentValue ?? 0,
      maxValue: capability.maxValue ?? 100,
      draftValue: draftValues[capability.code] ?? capabilityValue(capability),
      isPending: (draftValues[capability.code] ?? capabilityValue(capability)) !== (capability.currentValue ?? 0),
      tooltip: `Ajusta ${capability.name} no rascunho. O monitor so muda quando voce aplica as alteracoes.`,
      applyDraft: (nextValue: number) =>
        setDraftValues((current) => ({
          ...current,
          [capability.code]: nextValue
        }))
    }));

    const red = selectedMonitor.capabilities.find((capability) => capability.code === 'redGain');
    const green = selectedMonitor.capabilities.find((capability) => capability.code === 'greenGain');
    const blue = selectedMonitor.capabilities.find((capability) => capability.code === 'blueGain');

    if (red && green && blue) {
      const currentWhiteBalance = Math.round(((red.currentValue ?? 0) + (green.currentValue ?? 0) + (blue.currentValue ?? 0)) / 3);
      const draftWhiteBalance = Math.round(
        ((draftValues.redGain ?? red.currentValue ?? 0) +
          (draftValues.greenGain ?? green.currentValue ?? 0) +
          (draftValues.blueGain ?? blue.currentValue ?? 0)) /
          3
      );

      controls.unshift({
        key: 'whiteBalance',
        name: 'White Balance',
        hexCode: 'RGB',
        currentValue: currentWhiteBalance,
        maxValue: Math.min(red.maxValue ?? 100, green.maxValue ?? 100, blue.maxValue ?? 100),
        draftValue: draftWhiteBalance,
        isPending: draftWhiteBalance !== currentWhiteBalance,
        tooltip: 'Ajusta em conjunto os ganhos de vermelho, verde e azul para simplificar o balanco de branco.',
        applyDraft: (nextValue: number) =>
          setDraftValues((current) => ({
            ...current,
            redGain: nextValue,
            greenGain: nextValue,
            blueGain: nextValue
          }))
      });
    }

    return controls;
  }, [draftValues, selectedMonitor]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-panel">
          <p className="eyebrow">Monitor Control</p>
          <h1>Gray and violet command center for external displays.</h1>
          <p className="sidebar-copy">
            Tune DDC/CI capabilities, stage changes before applying them, and share profile presets as clean JSON files.
          </p>
        </div>

        <section className="card hero-panel">
          <div className="hero-copy">
            <span className="pill">Linux desktop utility</span>
            <h2>{selectedMonitor?.displayName ?? 'Waiting for a display'}</h2>
            <p className="muted">{diagnosticCopy(state)}</p>
          </div>
          <div className="signal-grid">
            <div className="signal-card">
              <span>Displays</span>
              <strong>{monitorCount}</strong>
            </div>
            <div className="signal-card">
              <span>Profiles</span>
              <strong>{profileCount}</strong>
            </div>
            <div className="signal-card accent">
              <span>Pending</span>
              <strong>{changedCapabilities.length}</strong>
            </div>
          </div>
        </section>

        <section className="card stack">
          <div className="section-header">
            <h2>Displays</h2>
            <button
              className="ghost-button"
              data-tooltip="Atualiza a lista de monitores e rele as capacidades disponiveis."
              onClick={() => runAction(() => window.monitorControl.refresh())}
            >
              Refresh
            </button>
          </div>
          <div className="stack">
            {state?.monitors.length ? (
              state.monitors.map((monitor) => (
                <button
                  key={monitor.id}
                  className={`monitor-button ${selectedMonitor?.id === monitor.id ? 'active' : ''}`}
                  data-tooltip="Seleciona este monitor para editar e aplicar perfis."
                  onClick={() => setSelectedBus(monitor.bus)}
                >
                  <div>
                    <strong>{monitor.displayName}</strong>
                    <small>{monitor.manufacturer ?? 'Unknown vendor'}</small>
                  </div>
                  <span className="bus-chip">Bus {monitor.bus}</span>
                </button>
              ))
            ) : (
              <p className="muted">
                {state?.diagnostics.message ??
                  'No external monitors detected. Install ddcutil and verify i2c permissions first.'}
              </p>
            )}
          </div>
        </section>

        <section className="card stack">
          <div className="section-header">
            <h2>Profiles</h2>
            <button
              className="ghost-button"
              data-tooltip="Importa um perfil JSON salvo localmente ou recebido de outra pessoa."
              onClick={() => runAction(() => window.monitorControl.importProfile())}
            >
              Import JSON
            </button>
          </div>
          <div className="stack">
            {state?.profiles.length ? (
              state.profiles.map((profile) => (
                <div key={profile.profileName} className="profile-item">
                  <div>
                    <strong>{profile.profileName}</strong>
                    <small>{new Date(profile.createdAt).toLocaleString()}</small>
                  </div>
                  <div className="profile-actions">
                    <button
                      className="ghost-button"
                      disabled={!selectedMonitor}
                      data-tooltip="Aplica os valores deste perfil no monitor atualmente selecionado."
                      onClick={() =>
                        selectedMonitor &&
                        runAction(() =>
                          window.monitorControl.applyProfile({
                            profileName: profile.profileName,
                            bus: selectedMonitor.bus
                          })
                        )
                      }
                    >
                      Apply
                    </button>
                    <button
                      className="ghost-button"
                      data-tooltip="Exporta este perfil para um arquivo JSON compartilhavel."
                      onClick={() => runAction(() => window.monitorControl.exportProfile(profile.profileName))}
                    >
                      Export
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">No saved profiles yet.</p>
            )}
          </div>
        </section>
      </aside>

      <main className="main-panel">
        <section className="card command-header">
          <div>
            <p className="eyebrow">Session</p>
            <h2>Stage a batch of display changes</h2>
            <p className="muted">
              Sliders only update the draft. Nothing is written to the monitor until you click apply.
            </p>
          </div>
          <div className="command-actions">
            <button
              className="ghost-button"
              disabled={!selectedMonitor || !hasPendingChanges}
              data-tooltip="Descarta as alteracoes pendentes e restaura os valores atuais do monitor no rascunho."
              onClick={() =>
                selectedMonitor &&
                setDraftValues(
                  Object.fromEntries(
                    selectedMonitor.capabilities.map((capability) => [capability.code, capability.currentValue ?? 0])
                  )
                )
              }
            >
              Reset draft
            </button>
            <button
              className="primary-button"
              disabled={!selectedMonitor || !hasPendingChanges}
              data-tooltip="Aplica ao monitor todas as alteracoes pendentes feitas nos controles."
              onClick={() =>
                selectedMonitor &&
                runAction(() =>
                  window.monitorControl.setValues({
                    bus: selectedMonitor.bus,
                    values: changedCapabilities.map((capability) => ({
                      hexCode: capability.hexCode,
                      value: draftValues[capability.code]
                    }))
                  })
                )
              }
            >
              Apply staged changes
            </button>
          </div>
        </section>

        {error ? <section className="message error">{error}</section> : null}
        {pending ? <section className="message">Processing request...</section> : null}

        <section className="content-grid">
          <section className="card controls-panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">Controls</p>
                <h2>{selectedMonitor?.displayName ?? 'No display selected'}</h2>
              </div>
              <span className="muted">{displayControls.length} supported controls</span>
            </div>

            {selectedMonitor ? (
              <div className="control-grid">
                {displayControls.map((control) => (
                  <label key={control.key} className="control-card">
                    <div className="control-meta">
                      <span className="control-name">{control.name}</span>
                      <span className="vcp-badge" data-tooltip="Codigo VCP usado pelo monitor para identificar esta feature.">
                        VCP {control.hexCode}
                      </span>
                    </div>
                    <div className="control-value-row">
                      <strong>{control.draftValue}</strong>
                      <small>Current {control.currentValue}</small>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={control.maxValue}
                      value={control.draftValue}
                      data-tooltip={control.tooltip}
                      onChange={(event) => control.applyDraft(Number(event.target.value))}
                    />
                    <small className={control.isPending ? 'pending-label' : ''}>
                      {control.isPending ? 'Pending change' : 'Synced with monitor'}
                    </small>
                  </label>
                ))}
              </div>
            ) : (
              <p className="muted">Select a monitor to inspect its supported DDC/CI controls.</p>
            )}
          </section>

          <section className="side-column">
            <section className="card monitor-summary">
              <p className="eyebrow">Hardware</p>
              <h2>{selectedMonitor?.displayName ?? 'Display unavailable'}</h2>
              <dl className="detail-list">
                <div>
                  <dt>Manufacturer</dt>
                  <dd>{selectedMonitor?.manufacturer ?? 'Unknown'}</dd>
                </div>
                <div>
                  <dt>Model</dt>
                  <dd>{selectedMonitor?.model ?? 'Unknown'}</dd>
                </div>
                <div>
                  <dt>Serial</dt>
                  <dd>{selectedMonitor?.serial ?? 'Unavailable'}</dd>
                </div>
                <div>
                  <dt>Bus</dt>
                  <dd>{selectedMonitor?.bus ?? '--'}</dd>
                </div>
              </dl>
            </section>

            <section className="card profile-builder">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Profiles</p>
                  <h2>Save current monitor state</h2>
                </div>
                <span className="muted">Readable JSON export</span>
              </div>
              <div className="form-grid">
                <label>
                  <span>Profile name</span>
                  <input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Editing Suite" />
                </label>
                <label className="full-width">
                  <span>Notes</span>
                  <textarea
                    value={profileNotes}
                    onChange={(event) => setProfileNotes(event.target.value)}
                    placeholder="High contrast preset for low ambient light."
                  />
                </label>
              </div>
              <button
                className="primary-button"
                disabled={!selectedMonitor || !profileName.trim()}
                data-tooltip="Salva o estado atual do monitor selecionado como um novo perfil JSON."
                onClick={() =>
                  selectedMonitor &&
                  runAction(() =>
                    window.monitorControl.createProfile({
                      profileName: profileName.trim(),
                      bus: selectedMonitor.bus,
                      notes: profileNotes.trim() || undefined
                    })
                  ).then(() => {
                    setProfileName('');
                    setProfileNotes('');
                  })
                }
              >
                Save profile snapshot
              </button>
            </section>
          </section>
        </section>
      </main>
    </div>
  );
}
