/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  MediaOptimizationSection.tsx
 *  Media settings with FFmpeg status, conversion, compression, and cleanup.
 *-----------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useRef, useState } from 'react';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { command } from '@/commands';
import {
  formatBytes,
  isCancelError,
  onFfmpegProgress,
  pickLocalFfmpegFile,
  type FfmpegAssetInfo,
  type FfmpegProgress,
  type FfmpegStatus,
} from '@/lib/ffmpeg';
import {
  MEDIA_QUALITY_MAX,
  MEDIA_QUALITY_MIN,
  AUDIO_BITRATE_OPTIONS,
  IMAGE_WIDTH_OPTIONS,
  VIDEO_AUDIO_BITRATE_OPTIONS,
  VIDEO_PRESET_OPTIONS,
  VIDEO_RESOLUTION_OPTIONS,
} from '@/constants';
import {
  DEFAULT_MEDIA_SETTINGS,
  loadMediaSettings,
  saveMediaSettings,
  type MediaSettings,
} from '@/lib/mediaSettings';

function progressPercent(progress: FfmpegProgress | null): number {
  if (!progress || !progress.totalBytes) return 0;
  if (progress.totalBytes <= 0) return 0;
  return Math.min(100, Math.round((progress.downloadedBytes / progress.totalBytes) * 100));
}

function sourceLabel(source?: string | null): string {
  switch (source) {
    case 'app-data':
      return 'Downloaded';
    case 'imported':
      return 'Imported';
    case 'dev-sidecar':
      return 'Dev sidecar';
    case 'bundled':
      return 'Bundled';
    case 'system':
      return 'System';
    default:
      return '';
  }
}

function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-primary' : 'bg-border'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

export function MediaOptimizationSection() {
  const [status, setStatus] = useState<FfmpegStatus | null>(null);
  const [assetInfo, setAssetInfo] = useState<FfmpegAssetInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<FfmpegProgress | null>(null);
  const [notice, setNotice] = useState<{ kind: 'warning' | 'error' | 'info'; text: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<MediaSettings>(() => loadMediaSettings());
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const isDev = import.meta.env.DEV;

  const updateSettings = useCallback((updater: (prev: MediaSettings) => MediaSettings) => {
    setSettings((prev) => {
      const next = updater(prev);
      saveMediaSettings(next);
      return next;
    });
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const next = await command('media.engine.status', undefined);
      setStatus(next);
      const info = await command('media.engine.asset-info', undefined);
      setAssetInfo(info);
      if (!next.downloading) {
        setDownloading(false);
      }
    } catch (e) {
      console.error('Failed to load FFmpeg status', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    return () => {
      unlistenRef.current?.();
      unlistenRef.current = null;
    };
  }, [refreshStatus]);

  const stopListening = useCallback(() => {
    unlistenRef.current?.();
    unlistenRef.current = null;
  }, []);

  const handleCancel = useCallback(async () => {
    try {
      await command('media.engine.cancel-download', undefined);
      command('ui.notify', { type: 'info', message: 'Download cancelled. You can resume it later.' });
    } catch (e) {
      console.error('Failed to cancel download', e);
    } finally {
      stopListening();
      setDownloading(false);
      await refreshStatus();
    }
  }, [refreshStatus, stopListening]);

  const handleDownload = useCallback(async () => {
    setNotice(null);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const text = 'No internet connection detected. Please check your connection and try again.';
      setNotice({ kind: 'warning', text });
      command('ui.notify', { type: 'warning', message: text });
      return;
    }

    setChecking(true);
    try {
      const online = await command('media.engine.check-connection', undefined);
      if (!online) {
        const text = 'No internet connection detected. Please check your connection and try again.';
        setNotice({ kind: 'warning', text });
        command('ui.notify', { type: 'warning', message: text });
        return;
      }
    } catch (e) {
      const text = 'Unable to reach the download server. Please check your connection and try again.';
      setNotice({ kind: 'warning', text });
      command('ui.notify', { type: 'warning', message: text });
      console.error('Connection check failed', e);
      return;
    } finally {
      setChecking(false);
    }

    setDownloading(true);
    setProgress(
      status && status.downloadedBytes > 0
        ? { downloadedBytes: status.downloadedBytes, totalBytes: status.totalBytes ?? null }
        : { downloadedBytes: 0, totalBytes: null },
    );

    try {
      stopListening();
      unlistenRef.current = await onFfmpegProgress((p) => setProgress(p));
      const next = await command('media.engine.download', undefined);
      setStatus(next);
      setNotice(null);
      command('ui.notify', { type: 'success', message: 'FFmpeg installed successfully. Media optimization is now enabled.' });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (isCancelError(message)) {
        setNotice({ kind: 'info', text: 'Download cancelled. Your progress was saved — select Download again to resume.' });
      } else {
        setNotice({
          kind: 'error',
          text: `${message || 'Download failed.'} Your progress was saved — select Download again to resume.`,
        });
        command('ui.notify', { type: 'danger', message: 'FFmpeg download failed. You can resume it later.' });
      }
      await refreshStatus();
    } finally {
      stopListening();
      setDownloading(false);
    }
  }, [refreshStatus, status, stopListening]);

  const handleDelete = useCallback(async () => {
    setBusy(true);
    try {
      const next = await command('media.engine.delete', undefined);
      setStatus(next);
      setProgress(null);
      setNotice(null);
      command('ui.notify', { type: 'success', message: 'FFmpeg removed. Original media files will be used.' });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      command('ui.notify', { type: 'danger', message: message || 'Failed to remove FFmpeg.' });
    } finally {
      setBusy(false);
      setShowDeleteConfirm(false);
    }
  }, []);

  const handleImportLocal = useCallback(async () => {
    setNotice(null);
    let picked: string | null;
    try {
      picked = await pickLocalFfmpegFile();
    } catch (e) {
      console.error('File dialog failed', e);
      return;
    }
    // The dialog was dismissed without a selection.
    if (!picked) return;
    setImporting(true);
    try {
      const next = await command('media.engine.import-local', { path: picked });
      setStatus(next);
      setNotice(null);
      command('ui.notify', {
        type: 'success',
        message: `FFmpeg ready${next.version ? ` (v${next.version})` : ''}. Media optimization is now enabled.`,
      });
      await refreshStatus();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setNotice({ kind: 'error', text: message || 'Could not use that file as FFmpeg.' });
      command('ui.notify', { type: 'danger', message: message || 'Could not use that file as FFmpeg.' });
    } finally {
      setImporting(false);
    }
  }, [refreshStatus]);

  const handleResetDefaults = useCallback(() => {
    const next = structuredClone(DEFAULT_MEDIA_SETTINGS);
    saveMediaSettings(next);
    setSettings(next);
    command('ui.notify', { type: 'success', message: 'Media settings reset to defaults.' });
  }, []);

  const installed = status?.installed ?? false;
  const percent = progressPercent(progress);
  const hasPartial = !installed && (status?.downloadedBytes ?? 0) > 0;
  const canDelete = installed && (status?.source === 'app-data' || status?.source === 'imported');
  const busyUi = checking || downloading || importing || busy;

  return (
    <section>
      <h3 className="text-sm font-semibold text-text-primary mb-1">Media</h3>
      <p className="text-xs text-text-secondary mb-4">
        Control how images, audio, and video are converted and compressed on import.
      </p>

      {/*
      Neutral skeleton while the FFmpeg status is unknown.
      Rendering the real layout only after the check avoids a
      not-installed flash when the binary is actually present.
      */}
      {loading ? (
        <div className="space-y-2" aria-label="Loading media settings">
          <div className="h-28 rounded-xl border border-border bg-surface animate-pulse" />
          <div className="h-16 rounded-xl border border-border bg-surface animate-pulse" />
          <div className="h-16 rounded-xl border border-border bg-surface animate-pulse" />
        </div>
      ) : (
      <>
      {/* Status: only shown until FFmpeg is available. */}
      {!installed && (
      <div className="rounded-xl border border-border bg-background p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary">FFmpeg — Media Engine</p>
            <ul className="mt-2 space-y-1 text-xs text-text-secondary list-disc pl-4">
              <li>Converts WAV recordings to MP3 for faster loading.</li>
              <li>Compresses large videos to H.264 for smooth playback.</li>
              <li>Without it, original files are used as-is. The app remains fully usable.</li>
            </ul>
            <p className="mt-3 text-[11px] text-text-secondary">
              One-time download (about 25–80 MB depending on your system). Stored locally and
              can be removed at any time.
            </p>
            {/* Exact download package for this device, resolved by the backend. */}
            {!loading && assetInfo?.supported && assetInfo.asset && (
              <p className="mt-2 text-[11px] text-text-secondary">
                Download package for this device ({assetInfo.os} {assetInfo.arch}):{' '}
                <span className="font-mono">{assetInfo.asset}</span>
              </p>
            )}
          </div>

          <div className="shrink-0 flex flex-col items-end gap-2">
            {loading ? (
              <span className="text-xs text-text-secondary">Checking status…</span>
            ) : installed ? (
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600">
                Installed{status?.version ? ` · v${status.version}` : ''}
                {typeof status?.sizeBytes === 'number' ? ` · ${formatBytes(status.sizeBytes)}` : ''}
                {sourceLabel(status?.source) ? ` · ${sourceLabel(status?.source)}` : ''}
              </span>
            ) : (
              <>
                <Button size="sm" disabled={busyUi} onClick={handleDownload}>
                  {checking
                    ? 'Checking connection…'
                    : downloading
                      ? 'Downloading…'
                      : hasPartial
                        ? 'Resume Download'
                        : 'Download FFmpeg'}
                </Button>
                {/* Any file name works: the file is validated by running it, then copied automatically. */}
                <Button variant="outline" size="sm" disabled={busyUi} onClick={handleImportLocal}>
                  {importing ? 'Checking file…' : 'Use local file…'}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Clear notice when no release binary exists for this platform yet. */}
        {!loading && !installed && assetInfo && !assetInfo.supported && (
          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
            No automatic download for {assetInfo.os} {assetInfo.arch} yet
            {assetInfo.reason ? ` (${assetInfo.reason})` : ''}. Use “Use local file…” above with
            an FFmpeg binary for your system instead.
          </div>
        )}

        {/* Development hint: the sidecar counts as installed automatically. */}
        {isDev && installed && status?.source === 'dev-sidecar' && (
          <p className="mt-3 rounded-lg border border-border bg-surface px-3 py-2 text-[11px] text-text-secondary">
            Development mode: FFmpeg was auto-detected from src-tauri/binaries. Release builds
            never look there and use the on-demand download instead, so no flag needs flipping.
          </p>
        )}

        {!loading && !installed && (
          <p className="mt-3 text-[11px] text-text-secondary">
            Status: Not installed — original media files will be used.
            {hasPartial ? ` Partial download found (${formatBytes(status?.downloadedBytes)}).` : ''}
          </p>
        )}

        {downloading && (
          <div className="mt-4">
            <div className="flex justify-between items-center text-[11px] text-text-secondary mb-1.5">
              <span>
                {progress?.totalBytes
                  ? `${formatBytes(progress.downloadedBytes)} of ${formatBytes(progress.totalBytes)}`
                  : `${formatBytes(progress?.downloadedBytes)} downloaded`}
              </span>
              <span>{progress?.totalBytes ? `${percent}%` : 'Downloading…'}</span>
            </div>
            <div className="w-full h-2 bg-surface rounded-full overflow-hidden border border-border">
              {progress?.totalBytes ? (
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              ) : (
                <div className="h-full w-1/3 bg-primary rounded-full animate-pulse" />
              )}
            </div>
            <div className="mt-2 flex justify-end">
              <Button variant="outline" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-text-secondary">
              If your connection drops, progress is saved. Select Download again to resume.
            </p>
          </div>
        )}

        {notice && !downloading && (
          <div
            className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
              notice.kind === 'error'
                ? 'border-danger/30 bg-danger/5 text-danger'
                : notice.kind === 'warning'
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-600'
                  : 'border-border bg-surface text-text-secondary'
            }`}
          >
            {notice.text}
          </div>
        )}
      </div>
      )}

      {/* Conversion: optimal output format per media type. */}
      <div className={`${installed ? '' : 'mt-6 pointer-events-none select-none opacity-50'}`}>
        <h4 className="text-sm font-semibold text-text-primary">Format Conversion</h4>
        <p className="mt-1 text-xs text-text-secondary">
          Convert uploads to the optimal format for fast loading and smooth playback.
          {!installed && ' Install FFmpeg above to enable these options.'}
        </p>
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm text-text-primary">Images → WebP</p>
              <p className="text-xs text-text-secondary">PNG and JPEG panoramas become lightweight WebP files.</p>
            </div>
            <Toggle
              label="Convert images to WebP"
              disabled={!installed}
              checked={settings.image.autoConvert}
              onChange={(next) => updateSettings((prev) => ({ ...prev, image: { ...prev.image, autoConvert: next } }))}
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm text-text-primary">Audio → MP3</p>
              <p className="text-xs text-text-secondary">WAV recordings become MP3 files at the bitrate below.</p>
            </div>
            <Toggle
              label="Convert audio to MP3"
              disabled={!installed}
              checked={settings.audio.autoConvert}
              onChange={(next) => updateSettings((prev) => ({ ...prev, audio: { ...prev.audio, autoConvert: next } }))}
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm text-text-primary">Video → H.264 MP4</p>
              <p className="text-xs text-text-secondary">Large videos become compressed MP4 files for smooth playback.</p>
            </div>
            <Toggle
              label="Convert video to H.264 MP4"
              disabled={!installed}
              checked={settings.video.autoConvert}
              onChange={(next) => updateSettings((prev) => ({ ...prev, video: { ...prev.video, autoConvert: next } }))}
            />
          </div>
        </div>
      </div>

      {/* Compression: single quality bar for images and video. */}
      <div className={`mt-6 ${installed ? '' : 'pointer-events-none select-none opacity-50'}`}>
        <h4 className="text-sm font-semibold text-text-primary">Compression</h4>
        <p className="mt-1 text-xs text-text-secondary">
          One quality bar for images and video. Higher quality means larger files.
        </p>
        <div className="mt-3 rounded-xl border border-border bg-background p-4">
          <Slider
            label="Quality"
            value={settings.image.quality}
            min={MEDIA_QUALITY_MIN}
            max={MEDIA_QUALITY_MAX}
            disabled={!installed}
            formatValue={(v) => `${v}%`}
            onChange={(v) =>
              updateSettings((prev) => ({
                ...prev,
                image: { ...prev.image, quality: v },
                video: { ...prev.video, quality: v },
              }))
            }
          />
          <p className="mt-2 text-[11px] text-text-secondary">
            At {settings.image.quality}% quality the output is roughly {100 - settings.image.quality}% smaller
            than the original. Video uses the same bar and maps it to an equivalent H.264 quality level.
          </p>
        </div>
      </div>

      {/* Advanced: per-type encoder controls. */}
      <div className={`mt-6 ${installed ? '' : 'pointer-events-none select-none opacity-50'}`}>
        <div className="flex items-center justify-between gap-4">
          <h4 className="text-sm font-semibold text-text-primary">Advanced</h4>
          <Button variant="outline" size="sm" disabled={!installed} onClick={handleResetDefaults}>
            Reset defaults
          </Button>
        </div>

        <p className="mt-2 text-xs font-medium uppercase tracking-wider text-text-secondary">Images</p>
        <div className="mt-2 rounded-xl border border-border bg-background p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-text-primary">Maximum width</p>
              <p className="text-xs text-text-secondary">Panoramas wider than this are resized before encoding.</p>
            </div>
            <div className="w-48 shrink-0">
              <Select
                value={String(settings.image.maxWidth)}
                onChange={(v) =>
                  updateSettings((prev) => ({ ...prev, image: { ...prev.image, maxWidth: Number(v) } }))
                }
                options={[...IMAGE_WIDTH_OPTIONS]}
              />
            </div>
          </div>
        </div>

        <p className="mt-4 text-xs font-medium uppercase tracking-wider text-text-secondary">Audio</p>
        <div className="mt-2 rounded-xl border border-border bg-background p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-text-primary">MP3 bitrate</p>
              <p className="text-xs text-text-secondary">Higher bitrates sound better and produce larger files.</p>
            </div>
            <div className="w-48 shrink-0">
              <Select
                value={String(settings.audio.bitrateKbps)}
                onChange={(v) =>
                  updateSettings((prev) => ({ ...prev, audio: { ...prev.audio, bitrateKbps: Number(v) } }))
                }
                options={[...AUDIO_BITRATE_OPTIONS]}
              />
            </div>
          </div>
        </div>

        <p className="mt-4 text-xs font-medium uppercase tracking-wider text-text-secondary">Video</p>
        <div className="mt-2 space-y-2 rounded-xl border border-border bg-background p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-text-primary">Maximum resolution</p>
              <p className="text-xs text-text-secondary">Videos larger than this are scaled down before encoding.</p>
            </div>
            <div className="w-48 shrink-0">
              <Select
                value={String(settings.video.maxWidth)}
                onChange={(v) =>
                  updateSettings((prev) => ({ ...prev, video: { ...prev.video, maxWidth: Number(v) } }))
                }
                options={[...VIDEO_RESOLUTION_OPTIONS]}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
            <div>
              <p className="text-sm text-text-primary">Encoding speed</p>
              <p className="text-xs text-text-secondary">Slower speeds compress smaller but take longer.</p>
            </div>
            <div className="w-48 shrink-0">
              <Select
                value={settings.video.preset}
                onChange={(v) => updateSettings((prev) => ({ ...prev, video: { ...prev.video, preset: v } }))}
                options={[...VIDEO_PRESET_OPTIONS]}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
            <div>
              <p className="text-sm text-text-primary">Audio bitrate</p>
              <p className="text-xs text-text-secondary">Bitrate used for the video soundtrack.</p>
            </div>
            <div className="w-48 shrink-0">
              <Select
                value={String(settings.video.audioBitrateKbps)}
                onChange={(v) =>
                  updateSettings((prev) => ({ ...prev, video: { ...prev.video, audioBitrateKbps: Number(v) } }))
                }
                options={[...VIDEO_AUDIO_BITRATE_OPTIONS]}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
            <div>
              <p className="text-sm text-text-primary">Web-optimized streaming</p>
              <p className="text-xs text-text-secondary">Lets videos start before the download finishes.</p>
            </div>
            <Toggle
              label="Enable web-optimized streaming"
              disabled={!installed}
              checked={settings.video.faststart}
              onChange={(next) => updateSettings((prev) => ({ ...prev, video: { ...prev.video, faststart: next } }))}
            />
          </div>
        </div>
      </div>

      {/* Danger zone: always last. */}
      {installed && (
        <div className="mt-6 rounded-xl border border-danger/30 bg-background p-4">
          <p className="text-sm font-medium text-text-primary">Remove FFmpeg</p>
          <p className="mt-1 text-xs text-text-secondary">
            {canDelete
              ? 'Deletes the downloaded binary from this device. Conversion settings above are kept.'
              : 'This binary is managed outside the app and cannot be deleted here.'}
          </p>
          {canDelete && (
            <div className="mt-3 flex justify-end">
              <Button variant="danger" size="sm" disabled={busy || downloading} onClick={() => setShowDeleteConfirm(true)}>
                Delete FFmpeg
              </Button>
            </div>
          )}
        </div>
      )}
      </>
      )}

      <ConfirmModal
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Remove FFmpeg?"
        description={`This will delete the FFmpeg binary (${formatBytes(status?.sizeBytes)}) from this device. Audio and video files will use their original format until you install it again.`}
        confirmLabel="Remove"
        cancelLabel="Keep"
        isDanger
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </section>
  );
}
