/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  PropertyPanel.tsx
 *  Inspector for scene settings and hotspot content with live updates.
 *-----------------------------------------------------------------------------------------------*/

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useTourStore } from '@/store/useTourStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { ResizableTextarea } from '@/components/ResizableTextarea';
import { ConfirmModal } from '@/components/ui/Modal';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/Select';
import { Trash2, MapPin, Info } from 'lucide-react';
import { TourScene, NavigationHotspot, InfoHotspot } from '@/types/tour';
import { HOTSPOT_ACTION_OPTIONS, TEXT_ALIGN_OPTIONS } from '@/constants';
import { HOTSPOT_ICONS, LUCIDE_ICONS } from '@/icons';
import { ColorPickerMenu } from '@/components/ui/ColorPickerMenu';
import type { HotspotStyle } from '@/lib/hotspotRender';
import { command } from '@/commands';

type ActionType = 'navigate' | 'show_image' | 'show_video' | 'show_text' | 'play_sound' | 'show_document';

export const PropertyPanel = () => {
  const project = useTourStore((state) => state.project);
  const activeSceneId = useTourStore((state) => state.activeSceneId);
  const selectedHotspotId = useTourStore((state) => state.selectedHotspotId);

  const images = useMemo(() => (project?.assets ?? []).filter((a) => a.type === 'image'), [project?.assets]);
  const audioFiles = useMemo(() => (project?.assets ?? []).filter((a) => a.type === 'audio'), [project?.assets]);
  const videoFiles = useMemo(() => (project?.assets ?? []).filter((a) => a.type === 'video'), [project?.assets]);
  const documentFiles = useMemo(() => (project?.assets ?? []).filter((a) => a.type === 'document'), [project?.assets]);
  const fontFiles = useMemo(() => (project?.assets ?? []).filter((a) => a.type === 'font'), [project?.assets]);

  const activeScene = project?.scenes.find((s) => s.id === activeSceneId);
  const selectedInfoMarker = activeScene?.markers.find(m => m.id === selectedHotspotId);
  const selectedNavMarker = activeScene?.links.find(l => l.id === selectedHotspotId || 'nav_' + l.nodeId === selectedHotspotId);
  const isNav = !!selectedNavMarker;
  const isInfo = !!selectedInfoMarker;

  /*
  Navigation hotspots historically stored style in markerStyle, newer saves use data.style.
  Read both so previously saved appearance is shown instead of resetting to defaults.
  */
  const navExtra = selectedNavMarker as unknown as { data?: Record<string, unknown>; markerStyle?: Record<string, unknown> } | undefined;
  const hotspotData = (isInfo
    ? selectedInfoMarker?.data
    : (navExtra?.data ?? (navExtra?.markerStyle ? { style: navExtra.markerStyle } : undefined))) as Record<string, unknown> | null;
  const hotspotAction: ActionType = isNav
    ? 'navigate'
    : (hotspotData?.action as ActionType) || (selectedInfoMarker?.image ? 'show_image' : 'show_text');

  if (!activeScene) {
    return (
      <div className="h-full flex flex-col bg-card">
        <div className="p-4 border-b border-border font-medium text-text-primary">Properties</div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-text-secondary text-center px-4">Select a scene to edit properties.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-card overflow-hidden">
      <div className="p-4 border-b border-border font-medium text-text-primary">
        {selectedHotspotId && (isNav || isInfo) ? 'Hotspot Properties' : 'Scene Properties'}
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 pb-20">
          {!selectedHotspotId && (
            <ScenePropertiesForm
              scene={activeScene}
              onUpdate={(id, updates) => command('scene.update', { sceneId: id, updates })}
              onDelete={(id) => command('scene.delete', id)}
              isStartScene={project?.defaultSceneId === activeScene.id}
              onSetStart={() => command('project.set-start-scene', { sceneId: activeScene.id })}
              onHotspotClick={(_markerId, internalId) => {
                command('selection.set-hotspot', internalId);
                const hotspot = [...activeScene.links, ...activeScene.markers].find((item) => {
                  const id = 'nodeId' in item ? (item.id || `nav_${item.nodeId}`) : item.id;
                  return id === internalId;
                });
                window.dispatchEvent(new CustomEvent('focus-marker', {
                  detail: {
                    id: internalId,
                    position: hotspot?.position
                      ? { yaw: Number(hotspot.position.yaw) || 0, pitch: Number(hotspot.position.pitch) || 0 }
                      : undefined,
                  },
                }));
              }}
            />
          )}

          {selectedHotspotId && (isNav || isInfo) && (
            <UnifiedHotspotForm
            sceneId={activeScene.id}
            hotspotId={selectedHotspotId}
            isNav={isNav}
            navMarker={selectedNavMarker}
            infoMarker={selectedInfoMarker}
            data={hotspotData}
            action={hotspotAction}
            images={images}
            audioFiles={audioFiles}
            videoFiles={videoFiles}
            documentFiles={documentFiles}
            fontFiles={fontFiles}
            scenes={project?.scenes || []}
          />
        )}
        </div>
      </ScrollArea>
    </div>
  );
};

function ScenePropertiesForm({
  scene,
  onUpdate,
  onDelete,
  isStartScene,
  onSetStart,
  onHotspotClick,
}: {
  scene: TourScene;
  onUpdate: (id: string, updates: Partial<TourScene>) => void;
  onDelete: (id: string) => void;
  isStartScene: boolean;
  onSetStart: () => void;
  onHotspotClick: (markerId: string, internalId: string) => void;
}) {
  const handleDelete = () => {
    onDelete(scene.id);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col flex-1">
        <div className="space-y-4 flex-1">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input
              value={scene.name || ''}
              onChange={(e) => onUpdate(scene.id, { name: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <ResizableTextarea
              value={scene.description || ''}
              onChange={(e) => onUpdate(scene.id, { description: e.target.value })}
              minLines={1}
              maxLines={10}
              placeholder="Describe this scene..."
              className="w-full"
            />
          </div>
          <div className="space-y-1">
            <Label>Editor notes</Label>
            <ResizableTextarea
              value={scene.notes || ''}
              onChange={(e) => onUpdate(scene.id, { notes: e.target.value })}
              minLines={1}
              maxLines={10}
              placeholder="Private notes for this scene..."
              className="w-full"
            />
          </div>
          <Button variant={isStartScene ? 'secondary' : 'outline'} size="sm" className="w-full justify-start" onClick={onSetStart}>
            {isStartScene ? 'Start scene' : 'Set as start scene'}
          </Button>
        </div>

        {(scene.markers.length > 0 || scene.links.length > 0) && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold border-b border-border pb-2 text-text-primary mb-3">Hotspots</h3>
            <div className="space-y-2">
              {scene.links.map(link => (
                <Button key={link.id || `nav_${link.nodeId}`} variant="outline" size="sm" className="w-full justify-start text-xs font-normal h-8" onClick={() => onHotspotClick(link.id || `nav_${link.nodeId}`, link.id || `nav_${link.nodeId}`)}>
                  <MapPin className="w-3 h-3 mr-2 text-primary" />
                  {link.name || 'Navigate'}
                </Button>
              ))}
              {scene.markers.map(marker => {
                const name = typeof marker.tooltip === 'string' ? marker.tooltip : marker.tooltip?.content || 'Hotspot';
                return (
                  <Button key={marker.id} variant="outline" size="sm" className="w-full justify-start text-xs font-normal h-8" onClick={() => onHotspotClick(marker.id, marker.id)}>
                    <Info className="w-3 h-3 mr-2 text-blue-500" />
                    {name}
                  </Button>
                )
              })}
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-border mt-4 flex gap-2">
          <Button variant="danger" size="sm" className="w-full" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-2" /> Delete Scene
          </Button>
        </div>
      </div>
    </div>
  );
}

function UnifiedHotspotForm({
  sceneId,
  hotspotId,
  isNav,
  navMarker,
  infoMarker,
  data,
  action,
  images,
  audioFiles,
  videoFiles,
  documentFiles,
  fontFiles,
  scenes,
}: {
  sceneId: string;
  hotspotId: string;
  isNav: boolean;
  navMarker?: NavigationHotspot;
  infoMarker?: InfoHotspot;
  data: Record<string, unknown> | null;
  action: ActionType;
  images: { path: string; name: string }[];
  audioFiles: { path: string; name: string }[];
  videoFiles: { path: string; name: string }[];
  documentFiles: { path: string; name: string }[];
  fontFiles: { id: string; name: string }[];
  scenes: { id: string; name?: string }[];
}) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  
  const currentData = data || {};
  const origTooltip = isNav ? (navMarker?.name || '') : (typeof infoMarker?.tooltip === 'string' ? infoMarker.tooltip : infoMarker?.tooltip?.content || '');
  const origAction = action;
  const origImage = infoMarker?.image || '';
  const origContent = infoMarker?.content || '';
  const origVideo = (currentData.video as string) || '';
  const origTextAlign = (currentData.textAlign as string) || 'center';
  const origAutoPlay = !!currentData.autoPlay;
  const origAudio = (currentData.audio as string) || '';
  const origDocument = (currentData.document as string) || '';
  const origNavTarget = isNav ? (navMarker?.nodeId || '') : ((currentData.navTarget as string) || '');
  const origStyle = (currentData.style as HotspotStyle) || {};

  const [localTooltip, setLocalTooltip] = useState(origTooltip);
  const [localAction, setLocalAction] = useState(origAction);
  const [localImage, setLocalImage] = useState(origImage);
  const [localContent, setLocalContent] = useState(origContent);
  const [localVideo, setLocalVideo] = useState(origVideo);
  const [localTextAlign, setLocalTextAlign] = useState(origTextAlign);
  const [localAutoPlay, setLocalAutoPlay] = useState(origAutoPlay);
  const [localAudio, setLocalAudio] = useState(origAudio);
  const [localDocument, setLocalDocument] = useState(origDocument);
  const [localNavTarget, setLocalNavTarget] = useState(origNavTarget);
  const [localStyle, setLocalStyle] = useState(origStyle);

  const isInitialMount = useRef(true);
  
  useEffect(() => {
    isInitialMount.current = true;
    setLocalTooltip(origTooltip); setLocalAction(origAction); setLocalImage(origImage); setLocalContent(origContent);
    setLocalVideo(origVideo); setLocalTextAlign(origTextAlign); setLocalAutoPlay(origAutoPlay); setLocalAudio(origAudio); setLocalDocument(origDocument); setLocalNavTarget(origNavTarget);
    setLocalStyle(origStyle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotspotId]);

  const handleSave = useCallback(() => {
    const position = isNav ? navMarker?.position : infoMarker?.position;

    if (localAction === 'navigate') {
      if (!localNavTarget) return;
      const newNavHotspot: NavigationHotspot = {
        id: isNav ? hotspotId : `hotspot_${Math.random().toString(36).substring(2, 9)}`,
        nodeId: localNavTarget,
        name: localTooltip,
        position,
      };

      /*
      Persist style in both markerStyle (legacy) and data.style (unified).
      The viewer reads both, so old and new projects stay compatible.
      Always persist, even when empty, so resetting to defaults is real-time too.
      */
      newNavHotspot.markerStyle = localStyle as unknown as Record<string, unknown>;
      const infoToNavData = { style: localStyle };

      if (!isNav) {
        // Keep data.style in sync for unified style reading.
        const infoToNav = { ...newNavHotspot, data: infoToNavData } as unknown as NavigationHotspot;
        command('hotspot.delete-info', { sceneId, hotspotId });
        command('hotspot.add-nav', { sceneId, hotspot: infoToNav });
        command('selection.set-hotspot', infoToNav.id!);
      } else {
        command('hotspot.update-nav', { sceneId, hotspotId, updates: { name: localTooltip, nodeId: localNavTarget, markerStyle: localStyle as unknown as Record<string, unknown>, data: infoToNavData } as unknown as Partial<NavigationHotspot> });
      }
    } else {
      const dataUpdates: Record<string, unknown> = { action: localAction };
      if (localAction === 'show_text') dataUpdates.textAlign = localTextAlign;
      if (localAction === 'play_sound') { dataUpdates.audio = localAudio; dataUpdates.autoPlay = localAutoPlay; }
      if (localAction === 'show_video') dataUpdates.video = localVideo;
      if (localAction === 'show_document') dataUpdates.document = localDocument;

      // Always include style so appearance edits apply instantly, including resets.
      dataUpdates.style = localStyle;

      const newInfoHotspot: InfoHotspot = {
        id: !isNav ? hotspotId : `hotspot_${Math.random().toString(36).substring(2, 9)}`,
        position,
        tooltip: localTooltip,
        content: localAction === 'show_text' ? localContent : undefined,
        image: localAction === 'show_image' ? localImage : undefined,
        data: dataUpdates,
      };

      if (isNav) {
        command('hotspot.delete-nav', { sceneId, hotspotId });
        command('hotspot.add-info', { sceneId, hotspot: newInfoHotspot });
        command('selection.set-hotspot', newInfoHotspot.id);
      } else {
        command('hotspot.update-info', { sceneId, hotspotId, updates: newInfoHotspot });
      }
    }
  }, [isNav, navMarker, infoMarker, localAction, localNavTarget, localTooltip, localStyle, hotspotId, sceneId, localTextAlign, localAudio, localAutoPlay, localVideo, localDocument, localContent, localImage]);

  /*
  Immediate style writer for real-time preview.
  Appearance controls (icon, color, font, background, opacity, radius) call this
  instead of only buffering in local state, so the viewer updates in the same
  tick without waiting for the autosave effect. The autosave effect below
  intentionally excludes localStyle to avoid a double commit per change.
  */
  const applyStylePatch = useCallback((patch: Partial<HotspotStyle> | HotspotStyle) => {
    const next = { ...localStyle, ...patch };
    setLocalStyle(next);
    const stableType = isNav === (localAction === 'navigate');
    if (!stableType) return;
    try {
      if (isNav) {
        command('hotspot.update-nav', { sceneId, hotspotId, updates: {
          markerStyle: next as unknown as Record<string, unknown>,
          data: { style: next },
        } as unknown as Partial<NavigationHotspot> });
      } else {
        const dataUpdates: Record<string, unknown> = { action: localAction, style: next };
        if (localAction === 'show_text') dataUpdates.textAlign = localTextAlign;
        if (localAction === 'play_sound') { dataUpdates.audio = localAudio; dataUpdates.autoPlay = localAutoPlay; }
        if (localAction === 'show_video') dataUpdates.video = localVideo;
        if (localAction === 'show_document') dataUpdates.document = localDocument;
        command('hotspot.update-info', { sceneId, hotspotId, updates: {
          tooltip: localTooltip,
          content: localAction === 'show_text' ? localContent : undefined,
          image: localAction === 'show_image' ? localImage : undefined,
          data: dataUpdates,
        } });
      }
    } catch {
      // Autosave effect will flush the buffered style on the next render.
    }
  }, [localStyle, isNav, localAction, sceneId, hotspotId, localTextAlign, localAudio, localAutoPlay, localVideo, localDocument, localTooltip, localContent, localImage]);

  const handleSaveRef = useRef(handleSave);
  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    handleSaveRef.current();
    /*
    Style is excluded here because applyStylePatch already persists
    appearance edits synchronously for real-time preview.
    Including it would commit twice per color/icon change.
    */
  }, [localAction, localImage, localContent, localVideo, localTextAlign, localAutoPlay, localAudio, localDocument, localNavTarget, localTooltip]);

  const handleDelete = () => {
    if (isNav) command('hotspot.delete-nav', { sceneId, hotspotId });
    else command('hotspot.delete-info', { sceneId, hotspotId });
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="space-y-1">
          <Label>Name</Label>
          <Input value={localTooltip} onChange={(e) => setLocalTooltip(e.target.value)} />
        </div>

        <div className="space-y-1">
          <Label>Action</Label>
          <Select
            value={localAction}
            onChange={(v) => setLocalAction(v as ActionType)}
            options={[...HOTSPOT_ACTION_OPTIONS]}
          />
        </div>

        {localAction === 'show_image' && (
          <div className="space-y-1 p-3 bg-surface rounded-lg border border-border">
            <Label>Image Asset</Label>
            {images.length === 0 ? (
              <p className="text-xs text-text-secondary">No images in Assets.</p>
            ) : (
              <Select
                value={localImage}
                onChange={(v) => setLocalImage(v)}
                placeholder="Select an image..."
                options={images.map(img => ({ value: img.path, label: img.name }))}
              />
            )}
          </div>
        )}

        {localAction === 'navigate' && (
          <div className="space-y-1 p-3 bg-surface rounded-lg border border-border">
            <Label>Target Scene</Label>
            <Select
              value={localNavTarget}
              onChange={(v) => setLocalNavTarget(v)}
              placeholder="Select a scene..."
              options={scenes.filter(s => s.id !== sceneId).map(s => ({ value: s.id, label: s.name || s.id }))}
            />
          </div>
        )}

        {localAction === 'show_video' && (
          <div className="space-y-1 p-3 bg-surface rounded-lg border border-border">
            <Label>Video Asset</Label>
            {videoFiles.length === 0 ? (
              <p className="text-xs text-text-secondary">No videos in Assets.</p>
            ) : (
              <Select
                value={localVideo}
                onChange={(v) => setLocalVideo(v)}
                placeholder="Select video..."
                options={videoFiles.map(v => ({ value: v.path, label: v.name }))}
              />
            )}
          </div>
        )}

        {localAction === 'show_document' && (
          <div className="space-y-1 p-3 bg-surface rounded-lg border border-border">
            <Label>Document Asset</Label>
            {documentFiles.length === 0 ? (
              <p className="text-xs text-text-secondary">No documents in Assets.</p>
            ) : (
              <Select
                value={localDocument}
                onChange={(v) => setLocalDocument(v)}
                placeholder="Select document..."
                options={documentFiles.map(d => ({ value: d.path, label: d.name }))}
              />
            )}
          </div>
        )}

        {localAction === 'show_text' && (
          <div className="space-y-1 p-3 bg-surface rounded-lg border border-border">
            <Label>Text Alignment</Label>
            <Select
              value={localTextAlign}
              onChange={(v) => setLocalTextAlign(v)}
              options={[...TEXT_ALIGN_OPTIONS]}
            />
            <Label className="mt-3 block">Display Text</Label>
            <div className="w-full mt-1 bg-background border border-input rounded-md px-3 py-2 transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 overflow-hidden">
              <textarea
                value={localContent}
                wrap="off"
                rows={10}
                onChange={(e) => setLocalContent(e.target.value)}
                className="w-full bg-transparent text-text-primary resize-none outline-none whitespace-pre custom-scroll overscroll-none block"
                placeholder="Enter text to display..."
              />
            </div>
          </div>
        )}

        {localAction === 'play_sound' && (
          <div className="space-y-1 p-3 bg-surface rounded-lg border border-border">
            {audioFiles.length === 0 ? (
              <>
                <Label>Audio Asset</Label>
                <p className="text-xs text-text-secondary">No audio in Assets.</p>
              </>
            ) : (
              <>
                <Label>Play Mode</Label>
                <Select
                  value={localAutoPlay ? 'auto' : 'click'}
                  onChange={(v) => setLocalAutoPlay(v === 'auto')}
                  options={[
                    { value: 'click', label: 'Click to Play' },
                    ...(localAutoPlay ? [] : [{ value: 'auto', label: 'Auto Play' }]),
                  ]}
                />
                <Label className="mt-3 block">Audio Asset</Label>
                <Select
                  value={localAudio}
                  onChange={(v) => setLocalAudio(v)}
                  placeholder="Select audio..."
                  options={audioFiles.map(a => ({ value: a.path, label: a.name }))}
                />
              </>
            )}
          </div>
        )}

        <div className="space-y-6 pt-4 border-t border-border">
          <h4 className="text-sm font-semibold text-text-primary">Appearance</h4>
          
          <div className="space-y-4 bg-surface/50 p-3 rounded-lg border border-border">
            <h5 className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2">
              <Info className="w-3.5 h-3.5" /> Icon Settings
            </h5>
            
            <div className="space-y-1">
              <Label>Icon</Label>
              <Select
                value={localStyle.icon || 'info'}
                onChange={(v) => applyStylePatch({ icon: v })}
                options={[{ value: 'info', label: 'Default' }, ...HOTSPOT_ICONS.map(i => ({
                  value: i.value,
                  label: (
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: LUCIDE_ICONS[i.value] }} />
                      <span>{i.label}</span>
                    </div>
                  )
                }))]}
              />
            </div>

            <ColorPickerMenu
              label="Icon Color"
              bgType="solid"
              bgColor={localStyle.iconColor || '#ffffff'}
              onChange={(_type, c) => applyStylePatch({ iconColor: c })}
              disableGradient
            />

          </div>

          <div className="space-y-4 bg-surface/50 p-3 rounded-lg border border-border">
            <h5 className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2">
              <span className="text-sm">A</span> Text Settings
            </h5>
            
            <div className="space-y-1">
              <Label>Custom Font</Label>
              {fontFiles.length === 0 ? (
                <p className="text-xs text-text-secondary">No custom fonts in Assets. Upload a .ttf file first.</p>
              ) : (
                <Select
                  value={localStyle.fontFamilyAssetId || ''}
                  onChange={(v) => applyStylePatch({ fontFamilyAssetId: v })}
                  placeholder="Select a font..."
                  options={[{ value: '', label: 'Default System Font' }, ...fontFiles.map(f => ({ value: f.id, label: f.name }))]}
                />
              )}
            </div>

            <ColorPickerMenu
              label="Text Color"
              bgType="solid"
              bgColor={localStyle.textColor || '#ffffff'}
              onChange={(_type, c) => applyStylePatch({ textColor: c })}
              disableGradient
            />
          </div>

          <div className="space-y-4 bg-surface/50 p-3 rounded-lg border border-border">
            <h5 className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-sm border border-text-secondary"></div> Background Box
            </h5>

            <ColorPickerMenu
              label="Background Color"
              bgType={localStyle.bgType || 'solid'}
              bgColor={localStyle.bgColor || '#000000'}
              bgGradient={localStyle.bgGradient || 'linear-gradient(90deg, rgba(255,0,0,1) 0%, rgba(0,0,255,1) 100%)'}
              onChange={(type, c, g) => applyStylePatch({ bgType: type, bgColor: c, bgGradient: g })}
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Box Opacity</Label>
                <div className="relative">
                  <Input 
                    type="number"
                    min="10"
                    max="100"
                    value={localStyle.opacity !== undefined ? Math.round(localStyle.opacity * 100) : 60} 
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (!isNaN(v)) {
                        applyStylePatch({ opacity: Math.max(10, Math.min(100, v)) / 100 });
                      }
                    }}
                    className="pr-6"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary text-xs pointer-events-none">%</span>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Border Radius</Label>
                <div className="relative">
                  <Input 
                    type="number"
                    min="0"
                    max="100"
                    value={localStyle.radius ? parseInt(localStyle.radius) : 50} 
                    onChange={(e) => applyStylePatch({ radius: e.target.value + '%' })}
                    className="pr-6"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary text-xs pointer-events-none">%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-border flex gap-2">
          <Button variant="danger" size="sm" className="w-full" onClick={() => setDeleteTarget(hotspotId)}>
            <Trash2 className="w-4 h-4 mr-2" /> Delete Hotspot
          </Button>
        </div>
      </div>
      
      <ConfirmModal
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Hotspot"
        description="Are you sure you want to delete this hotspot? This action cannot be undone."
        confirmLabel="Delete"
        isDanger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}