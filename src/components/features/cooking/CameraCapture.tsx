"use client";

import { Camera, ImageUp } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Button, Sheet, Spinner } from "@/components/ui";

export interface CameraCaptureProps {
  open: boolean;
  onClose(): void;
  /** Called with the captured (or chosen) JPEG. */
  onCapture(blob: Blob): void;
  title?: string;
  description?: string;
  /** Blocks the buttons while the caller is uploading / asking the model. */
  busy?: boolean;
}

const FALLBACK_MESSAGE =
  "Camera unavailable here — choose a photo from your device instead.";

/**
 * Bottom-sheet camera: a live `getUserMedia` preview (rear camera) with a
 * still-image file input as the fallback for browsers that block it.
 */
export function CameraCapture({
  open,
  onClose,
  onCapture,
  title = "Take a photo",
  description,
  busy,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const video = videoRef.current;

    const start = async () => {
      setError(null);
      setStarting(true);
      const media =
        typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
      if (!media?.getUserMedia) {
        if (!cancelled) {
          setError(FALLBACK_MESSAGE);
          setStarting(false);
        }
        return;
      }
      try {
        const stream = await media.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
      } catch {
        if (!cancelled) setError(FALLBACK_MESSAGE);
      } finally {
        if (!cancelled) setStarting(false);
      }
    };

    void start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (video) video.srcObject = null;
    };
  }, [open]);

  const shoot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setError(FALLBACK_MESSAGE);
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError(FALLBACK_MESSAGE);
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob);
      },
      "image/jpeg",
      0.85,
    );
  };

  const pickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onCapture(file);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="lg"
            className="flex-1"
            leftIcon={<ImageUp size={18} />}
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            Photo
          </Button>
          <Button
            size="lg"
            className="flex-1"
            leftIcon={<Camera size={18} />}
            loading={busy}
            disabled={Boolean(error)}
            onClick={shoot}
          >
            Capture
          </Button>
        </div>
      }
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-green-900">
        {open && (
          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            className="h-full w-full object-cover"
          />
        )}
        {starting && (
          <span className="absolute inset-0 flex items-center justify-center text-primary-fg">
            <Spinner size={24} label="Starting the camera" />
          </span>
        )}
        {error && (
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-[13px] leading-relaxed text-primary-fg">
            {error}
          </p>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={pickFile}
      />
    </Sheet>
  );
}
