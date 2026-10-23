"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, X } from "lucide-react";
import { useState } from "react";
import { api, type Activity, type Photo } from "@/lib/api";
import { isApiError } from "@/lib/errors";
import { useUser } from "@/lib/user-context";
import { cn } from "@/lib/utils";

export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const PHOTO_LIMIT = 6;
const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

export type StagedPhoto = { id: string; file: File; url: string };
export type UploadProgress = { index: number; fraction: number };

export function checkPhoto(file: File) {
  if (!ACCEPT.includes(file.type)) return "Photos need to be JPG, PNG or WebP.";
  if (file.size > PHOTO_MAX_BYTES) return "This one's over 10 MB. Try a smaller photo.";
  return null;
}

/** Photos chosen before the activity exists. Previews live in object URLs; the create page uploads them after publishing. */
export function PhotoPicker({ photos, onChange, uploading = null, disabled = false }: { photos: StagedPhoto[]; onChange: (next: StagedPhoto[]) => void; uploading?: UploadProgress | null; disabled?: boolean }) {
  const [problem, setProblem] = useState<string | null>(null);

  const add = (files: File[]) => {
    setProblem(null);
    const next = [...photos];
    for (const file of files) {
      const reason = checkPhoto(file) ?? (next.length >= PHOTO_LIMIT ? "That's the limit of 6 photos." : null);
      if (reason) {
        setProblem(reason);
        continue;
      }
      next.push({ id: `${file.name}-${file.size}-${file.lastModified}-${next.length}`, file, url: URL.createObjectURL(file) });
    }
    onChange(next);
  };

  const remove = (photo: StagedPhoto) => {
    URL.revokeObjectURL(photo.url);
    onChange(photos.filter((p) => p.id !== photo.id));
  };

  const reorder = (from: number, to: number) => {
    const next = [...photos];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    onChange(next);
  };

  return (
    <PhotoGrid problem={problem} onAdd={add} canAdd={!disabled && photos.length < PHOTO_LIMIT && !uploading} onReorder={disabled ? undefined : reorder}>
      {photos.map((p, i) =>
        uploading && i === uploading.index ? (
          <UploadingTile key={p.id} fraction={uploading.fraction} />
        ) : (
          <PhotoTile key={p.id} url={p.url} index={i} dimmed={!!uploading && i > uploading.index} onRemove={disabled ? undefined : () => remove(p)} />
        ),
      )}
    </PhotoGrid>
  );
}

/** Photos on an activity that already exists. Every change goes to the API straight away. */
export function PhotoUploader({ activity, onChange }: { activity: Activity; onChange?: (photos: Photo[]) => void }) {
  const { userId } = useUser();
  const queryClient = useQueryClient();
  const [photos, setPhotos] = useState<Photo[]>(activity.photos);
  const [progress, setProgress] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const update = (next: Photo[]) => {
    setPhotos(next);
    onChange?.(next);
    queryClient.setQueryData<{ activity: Activity }>(["activity", activity.id], (old) => (old ? { activity: { ...old.activity, photos: next } } : old));
  };

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      let current = photos;
      for (const file of files) {
        const reason = checkPhoto(file) ?? (current.length >= PHOTO_LIMIT ? "That's the limit of 6 photos." : null);
        if (reason) throw new Error(reason);
        setProgress(0);
        const { photo } = await api.uploadPhoto(userId!, activity.id, file, setProgress);
        current = [...current, photo];
        update(current);
      }
    },
    onSettled: () => setProgress(null),
    onError: (err) => setProblem(isApiError(err) ? err.message : err.message),
  });

  const remove = useMutation({
    mutationFn: (photo: Photo) => api.deletePhoto(userId!, activity.id, photo.id),
    onSuccess: (_, photo) => update(photos.filter((p) => p.id !== photo.id).map((p, i) => ({ ...p, position: i }))),
  });

  const move = useMutation({
    mutationFn: (ids: string[]) => api.reorderPhotos(userId!, activity.id, ids),
    onSuccess: ({ photos }) => update(photos),
  });

  const reorder = (from: number, to: number) => {
    const ids = photos.map((p) => p.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved!);
    move.mutate(ids);
  };

  return (
    <PhotoGrid
      problem={problem}
      onAdd={(files) => {
        setProblem(null);
        upload.mutate(files);
      }}
      canAdd={photos.length < PHOTO_LIMIT && progress === null}
      onReorder={reorder}
    >
      {photos.map((p, i) => (
        <PhotoTile key={p.id} url={p.url} index={i} onRemove={() => remove.mutate(p)} />
      ))}
      {progress !== null && <UploadingTile fraction={progress} />}
    </PhotoGrid>
  );
}

function PhotoGrid({ children, problem, onAdd, canAdd, onReorder }: { children: React.ReactNode; problem: string | null; onAdd: (files: File[]) => void; canAdd: boolean; onReorder?: (from: number, to: number) => void }) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState(false);

  const files = (list: FileList | null) => Array.from(list ?? []).filter((f) => f.type.startsWith("image/") || f.type === "");

  return (
    <div
      className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-3"
      onDragStart={(e) => {
        const tile = (e.target as HTMLElement).closest<HTMLElement>("[data-index]");
        if (tile && onReorder) setDragging(Number(tile.dataset.index));
      }}
      onDragEnd={() => setDragging(null)}
      onDragOver={(e) => {
        if (dragging !== null || e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDrop={(e) => {
        const tile = (e.target as HTMLElement).closest<HTMLElement>("[data-index]");
        if (dragging !== null && tile && onReorder) {
          e.preventDefault();
          const to = Number(tile.dataset.index);
          if (to !== dragging) onReorder(dragging, to);
          setDragging(null);
        }
      }}
    >
      {children}
      {problem && (
        <div role="alert" className="flex aspect-square items-center justify-center rounded-2xl border-[1.5px] border-scarcity-dot bg-warning-bg p-3 text-center text-[13px] font-semibold leading-snug text-warning-text">
          {problem}
        </div>
      )}
      {canAdd && (
        <label
          className={cn("flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-dashed border-[#C9CDD3] bg-surface text-[15px] font-bold text-brand", over && "border-brand bg-brand-tint")}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("Files")) {
              e.preventDefault();
              setOver(true);
            }
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            if (!e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            setOver(false);
            onAdd(files(e.dataTransfer.files));
          }}
        >
          <Camera className="size-6" />
          Add photos
          <span className="text-xs font-semibold text-muted-ink">or drop them here</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={(e) => {
              const picked = files(e.target.files);
              e.target.value = "";
              if (picked.length) onAdd(picked);
            }}
          />
        </label>
      )}
    </div>
  );
}

function PhotoTile({ url, index, onRemove, dimmed = false }: { url: string; index: number; onRemove?: () => void; dimmed?: boolean }) {
  return (
    <div data-index={index} draggable={!!onRemove} className={cn("relative aspect-square overflow-hidden rounded-2xl bg-ground", onRemove && "cursor-grab", dimmed && "opacity-60")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" draggable={false} className="h-full w-full object-cover" />
      {index === 0 && <span className="absolute bottom-2.5 left-2.5 rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-white">Cover</span>}
      {onRemove && (
        <button type="button" aria-label={index === 0 ? "Remove cover photo" : `Remove photo ${index + 1}`} onClick={onRemove} className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-full bg-surface text-ink shadow-[0_2px_8px_rgba(21,23,26,0.18)]">
          <X className="size-[18px]" />
        </button>
      )}
    </div>
  );
}

function UploadingTile({ fraction }: { fraction: number }) {
  const pct = Math.round(fraction * 100);
  return (
    <div role="status" aria-label={`Uploading photo, ${pct} percent`} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl bg-line text-body">
      <span className="text-base font-bold text-ink">Uploading</span>
      <span className="text-sm font-semibold">{pct}%</span>
      <span className="mt-1 h-1.5 w-3/5 overflow-hidden rounded-full bg-surface">
        <span className="block h-full rounded-full bg-brand transition-[width]" style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}
