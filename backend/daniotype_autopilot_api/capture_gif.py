#!/usr/bin/env python3
"""
Timelapse capturer for the daniotype_kasperov AutoPilot run.

Drives a headless Chromium on the EC2 box through the wizard's CAPTURE MODE
(`?capture=1&dataset=<id>&model=<m>`), which auto-runs the in-browser AutoPilot
so the whole 2-3 hour sweep can be filmed. Screenshots the page on an interval
into an EBS folder, then squeezes every frame into one ~60s GIF timelapse.

Run standalone:
  /data/.venv/bin/python capture_gif.py --dataset zscape --model gpt-5-mini \
      --base https://www.zeroshot.bio --out /data/daniotype_runs/gifs/<id>

Writes <out>/frames/frame_NNNNN.png, <out>/timelapse.gif, and <out>/status.json
(progress, polled by the worker / readable by the user).
"""
import argparse, json, os, sys, time, traceback

TARGET_SECONDS = 60.0       # final GIF length
GIF_WIDTH = 1280            # GIF downscale width — the frames→GIF step is where
GIF_COLORS = 256            # crispness is won (ffmpeg optimal palette, max colors)
MAX_GIF_FRAMES = 800        # bound the GIF size (a multi-hour run captures 1000s of frames)


def write_status(out, **kw):
    kw["t"] = int(time.time())
    try:
        with open(os.path.join(out, "status.json"), "w") as f:
            json.dump(kw, f)
    except Exception:
        pass


def _ffmpeg_exe():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def _pick_frames(frame_dir):
    frames = sorted(f for f in os.listdir(frame_dir) if f.endswith(".png"))
    if len(frames) > MAX_GIF_FRAMES:  # keep an evenly-spaced subset to bound size
        step = len(frames) / MAX_GIF_FRAMES
        frames = [frames[int(i * step)] for i in range(MAX_GIF_FRAMES)]
    return frames


def assemble(frame_dir, gif_path, mp4_path, status_out, width=GIF_WIDTH, colors=GIF_COLORS):
    import shutil, subprocess, tempfile
    frames = _pick_frames(frame_dir)
    if not frames:
        write_status(status_out, phase="error", error="no frames captured")
        return None
    n = len(frames)
    fps = int(max(2, min(20, round(n / TARGET_SECONDS))))  # GIF-friendly playback rate
    ff = _ffmpeg_exe()
    if ff:
        # symlink the chosen frames as a contiguous sequence for ffmpeg
        seq = tempfile.mkdtemp(prefix="kseq_")
        for i, name in enumerate(frames):
            os.symlink(os.path.join(frame_dir, name), os.path.join(seq, "f_%05d.png" % i))
        inp = os.path.join(seq, "f_%05d.png")
        try:
            write_status(status_out, phase="encoding", frames=n, fps=fps, gif=gif_path)
            # CRISP GIF: 2-pass with a full-stats optimal palette + lanczos downscale
            pal = os.path.join(seq, "pal.png")
            subprocess.run([ff, "-y", "-framerate", str(fps), "-i", inp,
                            "-vf", "scale=%d:-1:flags=lanczos,palettegen=max_colors=%d:stats_mode=diff" % (width, colors),
                            pal], check=True, capture_output=True)
            subprocess.run([ff, "-y", "-framerate", str(fps), "-i", inp, "-i", pal,
                            "-lavfi", "scale=%d:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" % width,
                            gif_path], check=True, capture_output=True)
            # BONUS MP4: full-res, tiny, perfectly crisp (H.264)
            try:
                subprocess.run([ff, "-y", "-framerate", str(fps), "-i", inp,
                                "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264",
                                "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "veryfast", "-movflags", "+faststart",
                                mp4_path], check=True, capture_output=True)
            except Exception:
                mp4_path = None
        except subprocess.CalledProcessError as e:
            write_status(status_out, phase="error", error="ffmpeg: " + (e.stderr or b"").decode("utf-8", "ignore")[-300:])
            shutil.rmtree(seq, ignore_errors=True)
            return None
        shutil.rmtree(seq, ignore_errors=True)
    else:
        # Pillow fallback (no ffmpeg): lower quality, still works
        from PIL import Image
        per_ms = int(round(1000 / fps))
        imgs = []
        for name in frames:
            try:
                im = Image.open(os.path.join(frame_dir, name)).convert("RGB")
                if im.width > width:
                    im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
                imgs.append(im.quantize(colors=min(colors, 256), method=Image.MEDIANCUT))
            except Exception:
                continue
        if not imgs:
            write_status(status_out, phase="error", error="no decodable frames")
            return None
        imgs[0].save(gif_path, save_all=True, append_images=imgs[1:], duration=per_ms, loop=0, optimize=True, disposal=2)
        mp4_path = None
    size_mb = round(os.path.getsize(gif_path) / 1e6, 1)
    st = dict(phase="done", frames=n, fps=fps, gif=gif_path, size_mb=size_mb, encoder=("ffmpeg" if ff else "pillow"))
    if mp4_path and os.path.exists(mp4_path):
        st["mp4"] = mp4_path
        st["mp4_mb"] = round(os.path.getsize(mp4_path) / 1e6, 1)
    write_status(status_out, **st)
    return gif_path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", required=True)
    ap.add_argument("--model", required=True)
    ap.add_argument("--base", default="https://www.zeroshot.bio")
    ap.add_argument("--out", required=True)
    ap.add_argument("--interval", type=float, default=10.0)   # seconds between frames
    ap.add_argument("--max-hours", type=float, default=5.0)
    ap.add_argument("--max-clusters", type=int, default=0)    # >0: stop after N clusters (preview)
    ap.add_argument("--width", type=int, default=1600)        # browser viewport (CSS px)
    ap.add_argument("--height", type=int, default=900)
    ap.add_argument("--scale", type=float, default=1.0)       # device_scale_factor (1 = original capture res)
    ap.add_argument("--gif-width", type=int, default=GIF_WIDTH)
    ap.add_argument("--colors", type=int, default=GIF_COLORS)
    a = ap.parse_args()

    frame_dir = os.path.join(a.out, "frames")
    os.makedirs(frame_dir, exist_ok=True)
    gif_path = os.path.join(a.out, "timelapse.gif")
    mp4_path = os.path.join(a.out, "timelapse.mp4")
    url = f"{a.base}/daniotype_kasperov?capture=1&dataset={a.dataset}&model={a.model}"
    write_status(a.out, phase="starting", url=url, dataset=a.dataset, model=a.model)

    from playwright.sync_api import sync_playwright
    deadline = time.time() + a.max_hours * 3600
    frame_i = 0
    done_seen = 0  # capture a few extra frames after "done" before stopping
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage", "--force-color-profile=srgb"])
            page = browser.new_page(viewport={"width": a.width, "height": a.height}, device_scale_factor=a.scale)
            page.on("dialog", lambda d: d.dismiss())  # never block on a confirm()
            page.goto(url, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(2500)
            last_phase, last_done, last_total = "loading", 0, 0
            while time.time() < deadline:
                try:
                    page.screenshot(path=os.path.join(frame_dir, f"frame_{frame_i:05d}.png"))
                    frame_i += 1
                except Exception:
                    pass
                try:
                    st = page.evaluate("() => window.__kasperov || {phase:'loading',done:0,total:0}")
                    last_phase = st.get("phase", last_phase)
                    last_done = st.get("done", last_done)
                    last_total = st.get("total", last_total)
                except Exception:
                    pass
                if frame_i % 5 == 0:
                    write_status(a.out, phase="capturing", run_phase=last_phase, done=last_done, total=last_total, frames=frame_i, gif=gif_path)
                reached = last_phase == "done" or (a.max_clusters and last_done >= a.max_clusters)
                if reached:
                    done_seen += 1
                    if done_seen >= 4:   # ~4 trailing frames showing the finished state
                        break
                page.wait_for_timeout(int(a.interval * 1000))
            browser.close()
    except Exception as e:
        write_status(a.out, phase="capture_error", error=str(e)[:300], frames=frame_i, traceback=traceback.format_exc()[-800:])

    return assemble(frame_dir, gif_path, mp4_path, a.out, width=a.gif_width, colors=a.colors)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        sys.stderr.write("capture_gif fatal: %s\n%s\n" % (e, traceback.format_exc()))
        sys.exit(1)
