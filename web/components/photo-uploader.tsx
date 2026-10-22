"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, X } from "lucide-react";
import { useState } from "react";
import { api, type Activity, type Photo } from "@/lib/api";
import { isApiError } from "@/lib/errors";
import { useUser } from "@/lib/user-context";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

/** Uploads one file at a time with its own progress bar. Before the activity exists it only explains itself. */
export function PhotoUploader({ activity, onChange }: { activity: Activity | null; onChange?: (photos: Photo[]) => void }) {
  const { userId } = useUser();
  const queryClient = useQueryClient();
  const [photos, setPhotos] = useState<Photo[]>(activity?.photos ?? []);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = (next: Photo[]) => {
    setPhotos(next);
    onChange?.(next);
    if (activity) queryClient.setQueryData<{ activity: Activity }>(["activity", activity.id], (old) => (old ? { activity: { ...old.activity, photos: next } } : old));
  };

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        if (!ACCEPT.includes(file.type)) throw new Error("Photos need to be JPG, PNG or WebP.");
        if (file.size > MAX_BYTES) throw new Error("This one's over 10 MB. Try a smaller photo.");
        if (photos.length >= 6) throw new Error("That's the limit of 6 photos.");
        setProgress(0);
        const { photo } = await api.uploadPhoto(userId!, activity!.id, file, setProgress);
        update([...photos, photo]);
      }
    },
    onSettled: () => setProgress(null),
    onError: (err) => setError(isApiError(err) ? err.message : err.message),
  });

  const remove = useMutation({
    mutationFn: (photo: Photo) => api.deletePhoto(userId!, activity!.id, photo.id),
    onSuccess: (_, photo) => update(photos.filter((p) => p.id !== photo.id).map((p, i) => ({ ...p, position: i }))),
  });

  const move = useMutation({
    mutationFn: (ids: string[]) => api.reorderPhotos(userId!, activity!.id, ids),
    onSuccess: ({ photos }) => update(photos),
  });

  if (!activity) {
    return <div className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted-ink">Photos are added right after publishing. No photos? We&apos;ll use an illustrated cover for your activity&apos;s category.</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {photos.map((p, i) => (
          <div key={p.id} className="relative aspect-square overflow-hidden rounded-2xl bg-ground">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="h-full w-full object-cover" />
            {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-surface/95 px-2 py-0.5 text-xs font-bold">Cover</span>}
            <button type="button" aria-label={i === 0 ? "Remove cover photo" : `Remove photo ${i + 1}`} onClick={() => remove.mutate(p)} className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-ink/80 text-white">
              <X className="size-4" />
            </button>
            {i > 0 && (
              <button type="button" onClick={() => move.mutate([p.id, ...photos.filter((x) => x.id !== p.id).map((x) => x.id)])} className="absolute bottom-2 left-2 rounded-full bg-surface/95 px-2 py-0.5 text-xs font-bold">
                Make cover
              </button>
            )}
          </div>
        ))}
        {progress !== null && (
          <div role="status" aria-label={`Uploading photo, ${Math.round(progress * 100)} percent`} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl bg-ground text-xs font-bold text-muted-ink">
            Uploading
            <span>{Math.round(progress * 100)}%</span>
            <span className="h-1 w-3/4 overflow-hidden rounded-full bg-line">
              <span className="block h-full bg-brand" style={{ width: `${Math.round(progress * 100)}%` }} />
            </span>
          </div>
        )}
        {photos.length < 6 && progress === null && (
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-[#C9CDD3] text-xs font-bold text-brand">
            <ImagePlus className="size-5" />
            Add photos
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={(e) => {
                setError(null);
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (files.length) upload.mutate(files);
              }}
            />
          </label>
        )}
      </div>
      {error && (
        <div role="alert" className="rounded-2xl bg-warning-bg px-4 py-3 text-sm font-semibold text-warning-text">
          {error}
        </div>
      )}
      <span className="text-xs text-muted-ink">JPG, PNG or WebP, up to 10 MB each. The first is the cover.</span>
    </div>
  );
}
